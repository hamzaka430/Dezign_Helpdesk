// ============================================================
// SupportIQ — Phase 6: Integrations & Webhooks
// POST /api/integrations/slack/test    — test Slack webhook
// POST /api/integrations/slack/notify  — send Slack alert (internal)
// GET  /api/integrations/webhooks      — list webhooks
// POST /api/integrations/webhooks      — register outbound webhook
// DEL  /api/integrations/webhooks/:id  — remove webhook
// POST /api/integrations/webhooks/:id/test — fire test event
// GET  /api/integrations/sso/config    — SSO/SAML config
// POST /api/integrations/sso/config    — save SSO config
// ============================================================

import { Hono } from 'hono'
import { authMiddleware, adminOnly, Env, Variables } from '../lib/middleware'
import { generateId } from '../lib/auth'

const integrations = new Hono<{ Bindings: Env; Variables: Variables }>()

integrations.use('*', authMiddleware)

// ── Helpers ────────────────────────────────────────────────

/**
 * Send a message to a Slack Incoming Webhook URL.
 * Works entirely with fetch — no SDK needed.
 */
async function sendSlackMessage(webhookUrl: string, payload: object): Promise<boolean> {
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Send a message via Slack Bot Token to a channel.
 */
async function sendSlackBotMessage(token: string, channel: string, text: string, blocks?: object[]): Promise<boolean> {
  try {
    const body: Record<string, unknown> = { channel, text }
    if (blocks) body.blocks = blocks
    const res = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    })
    const data = await res.json() as { ok: boolean; error?: string }
    return data.ok
  } catch {
    return false
  }
}

/**
 * Fire all registered outbound webhooks for a tenant + event.
 * Called internally when tickets/conversations change state.
 */
export async function fireWebhooks(
  db: D1Database,
  tenantId: string,
  event: string,
  payload: object
): Promise<void> {
  const rows = await db.prepare(
    `SELECT url, secret FROM webhooks WHERE tenant_id = ? AND is_active = 1
     AND (events = '*' OR events LIKE '%' || ? || '%')`
  ).bind(tenantId, event).all()

  const webhooks = rows.results as { url: string; secret: string | null }[]

  for (const wh of webhooks) {
    try {
      const body = JSON.stringify({ event, timestamp: new Date().toISOString(), data: payload })
      const headers: HeadersInit = { 'Content-Type': 'application/json', 'X-SupportIQ-Event': event }

      // Sign payload if secret configured
      if (wh.secret) {
        const key = await crypto.subtle.importKey(
          'raw',
          new TextEncoder().encode(wh.secret),
          { name: 'HMAC', hash: 'SHA-256' },
          false,
          ['sign']
        )
        const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
        const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
        ;(headers as Record<string, string>)['X-SupportIQ-Signature'] = `sha256=${sigHex}`
      }

      await fetch(wh.url, { method: 'POST', headers, body })
    } catch { /* non-fatal */ }
  }
}

// ── Slack: test webhook URL ────────────────────────────────

integrations.post('/slack/test', adminOnly, async (c) => {
  try {
    const body = await c.req.json<{ webhook_url?: string }>()
    if (!body.webhook_url?.startsWith('https://hooks.slack.com/')) {
      return c.json({ error: 'Invalid Slack webhook URL' }, 422)
    }

    const ok = await sendSlackMessage(body.webhook_url, {
      text: '✅ *SupportIQ connected!* Your Slack integration is working correctly.',
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: '✅ *SupportIQ Slack Integration Active*\n\nYou will now receive alerts for new escalations, tickets, and other important events.'
          }
        }
      ]
    })

    return c.json({ success: ok, message: ok ? 'Test message sent' : 'Failed to send test message' })
  } catch (err) {
    return c.json({ error: 'Slack test failed' }, 500)
  }
})

// ── Slack: send escalation alert (internal helper route) ───

integrations.post('/slack/notify', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      type: 'escalation' | 'new_ticket' | 'sla_breach' | 'custom'
      title?: string
      message?: string
      url?: string
      priority?: string
    }>()

    // Get webhook URL from settings
    const settings = await c.env.DB.prepare(
      'SELECT slack_webhook_url FROM workspace_settings WHERE tenant_id = ?'
    ).bind(user.tenant_id).first() as { slack_webhook_url?: string } | null

    if (!settings?.slack_webhook_url) {
      // Try bot token + channel
      if (c.env.SLACK_BOT_TOKEN) {
        const colorMap: Record<string, string> = { escalation: '#ff7a3d', new_ticket: '#6a4cf5', sla_breach: '#ef4444', custom: '#0099ff' }
        const ok = await sendSlackBotMessage(c.env.SLACK_BOT_TOKEN, '#support', body.message || body.title || 'SupportIQ Alert')
        return c.json({ success: ok })
      }
      return c.json({ error: 'Slack not configured. Add a webhook URL in Settings → Integrations.' }, 422)
    }

    const colorMap: Record<string, string> = { escalation: '#ff7a3d', new_ticket: '#6a4cf5', sla_breach: '#ef4444', custom: '#0099ff' }
    const emojiMap: Record<string, string> = { escalation: '🔥', new_ticket: '🎫', sla_breach: '⏰', custom: '📢' }
    const emoji = emojiMap[body.type] || '📢'
    const color = colorMap[body.type] || '#6a4cf5'

    const ok = await sendSlackMessage(settings.slack_webhook_url, {
      attachments: [{
        color,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `${emoji} *${body.title || 'SupportIQ Alert'}*\n${body.message || ''}`
            }
          },
          ...(body.url ? [{
            type: 'actions',
            elements: [{
              type: 'button',
              text: { type: 'plain_text', text: 'View in Dashboard' },
              url: body.url,
              style: 'primary'
            }]
          }] : []),
          {
            type: 'context',
            elements: [{ type: 'mrkdwn', text: `SupportIQ · ${new Date().toLocaleString()}` }]
          }
        ]
      }]
    })

    return c.json({ success: ok })
  } catch (err) {
    return c.json({ error: 'Notification failed' }, 500)
  }
})

// ── Outbound Webhooks CRUD ─────────────────────────────────

integrations.get('/webhooks', async (c) => {
  const user = c.get('user')
  const rows = await c.env.DB.prepare(
    'SELECT id, name, url, events, is_active, created_at FROM webhooks WHERE tenant_id = ? ORDER BY created_at DESC'
  ).bind(user.tenant_id).all()
  return c.json({ webhooks: rows.results })
})

integrations.post('/webhooks', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      name?: string
      url?: string
      events?: string   // e.g. "ticket.created,conversation.escalated,*"
      secret?: string
    }>()

    if (!body.url) return c.json({ error: 'url is required' }, 422)
    if (!body.url.startsWith('https://')) return c.json({ error: 'url must use HTTPS' }, 422)

    const id = generateId('wh')
    await c.env.DB.prepare(
      `INSERT INTO webhooks (id, tenant_id, name, url, events, secret, is_active, created_at)
       VALUES (?, ?, ?, ?, ?, ?, 1, datetime('now'))`
    ).bind(id, user.tenant_id, body.name || 'Webhook', body.url, body.events || '*', body.secret || null).run()

    const wh = await c.env.DB.prepare('SELECT id, name, url, events, is_active, created_at FROM webhooks WHERE id = ?').bind(id).first()
    return c.json({ webhook: wh }, 201)
  } catch (err) {
    return c.json({ error: 'Failed to create webhook' }, 500)
  }
})

integrations.delete('/webhooks/:id', adminOnly, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  await c.env.DB.prepare('DELETE FROM webhooks WHERE id = ? AND tenant_id = ?').bind(id, user.tenant_id).run()
  return c.json({ message: 'Webhook deleted' })
})

integrations.post('/webhooks/:id/test', adminOnly, async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const wh = await c.env.DB.prepare('SELECT * FROM webhooks WHERE id = ? AND tenant_id = ?').bind(id, user.tenant_id).first() as Record<string, string> | null
  if (!wh) return c.json({ error: 'Webhook not found' }, 404)

  const testPayload = {
    event: 'webhook.test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test event from SupportIQ',
      webhook_id: id
    }
  }

  try {
    const headers: HeadersInit = { 'Content-Type': 'application/json', 'X-SupportIQ-Event': 'webhook.test' }
    const body = JSON.stringify(testPayload)

    if (wh.secret) {
      const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(wh.secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
      const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
      const sigHex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('')
      ;(headers as Record<string, string>)['X-SupportIQ-Signature'] = `sha256=${sigHex}`
    }

    const res = await fetch(wh.url, { method: 'POST', headers, body })
    return c.json({ success: res.ok, status: res.status, message: res.ok ? 'Test delivered successfully' : `Endpoint returned ${res.status}` })
  } catch (err) {
    return c.json({ success: false, message: 'Failed to reach endpoint: ' + String(err) })
  }
})

// ── SSO / SAML Configuration ───────────────────────────────

integrations.get('/sso/config', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const row = await c.env.DB.prepare(
      `SELECT sso_enabled, sso_provider, sso_metadata_url, sso_entity_id, sso_acs_url, sso_enforce
       FROM workspace_settings WHERE tenant_id = ?`
    ).bind(user.tenant_id).first() as Record<string, unknown> | null

    // Return ACS URL for this tenant (where IdP posts the SAML response)
    const appUrl = c.env.APP_URL || `https://supportiq.pages.dev`
    const acsUrl = `${appUrl}/api/integrations/sso/acs/${user.tenant_id}`

    return c.json({
      config: row || {},
      acs_url: acsUrl,
      entity_id: `${appUrl}/api/integrations/sso`,
      metadata_url: `${appUrl}/api/integrations/sso/metadata/${user.tenant_id}`,
    })
  } catch (err) {
    return c.json({ error: 'Failed to get SSO config' }, 500)
  }
})

integrations.post('/sso/config', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      sso_enabled?: boolean
      sso_provider?: string          // 'okta' | 'azure_ad' | 'google' | 'generic_saml'
      sso_metadata_url?: string      // IdP metadata URL
      sso_entity_id?: string         // IdP entity ID
      sso_enforce?: boolean          // Force SSO (disable password login)
    }>()

    await c.env.DB.prepare(
      `UPDATE workspace_settings SET
         sso_enabled = ?, sso_provider = ?, sso_metadata_url = ?,
         sso_entity_id = ?, sso_enforce = ?, updated_at = datetime('now')
       WHERE tenant_id = ?`
    ).bind(
      body.sso_enabled ? 1 : 0,
      body.sso_provider || null,
      body.sso_metadata_url || null,
      body.sso_entity_id || null,
      body.sso_enforce ? 1 : 0,
      user.tenant_id
    ).run()

    return c.json({ message: 'SSO configuration saved' })
  } catch (err) {
    return c.json({ error: 'Failed to save SSO config' }, 500)
  }
})

// ── SSO Metadata XML (for IdP configuration) ──────────────

integrations.get('/sso/metadata/:tenantId', async (c) => {
  const appUrl = c.env.APP_URL || 'https://supportiq.pages.dev'
  const tenantId = c.req.param('tenantId')
  const acsUrl = `${appUrl}/api/integrations/sso/acs/${tenantId}`
  const entityId = `${appUrl}/api/integrations/sso`

  const xml = `<?xml version="1.0"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata"
  entityID="${entityId}">
  <SPSSODescriptor
    AuthnRequestsSigned="false"
    WantAssertionsSigned="true"
    protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService
      Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST"
      Location="${acsUrl}"
      index="1"/>
  </SPSSODescriptor>
</EntityDescriptor>`

  return new Response(xml, { headers: { 'Content-Type': 'application/xml' } })
})

// ── SSO Assertion Consumer Service (ACS) endpoint ─────────
// This receives the SAML POST from the IdP.
// Full SAML assertion parsing requires a SAML library;
// here we provide a skeleton that can be extended.

integrations.post('/sso/acs/:tenantId', async (c) => {
  try {
    const tenantId = c.req.param('tenantId')
    const body = await c.req.parseBody()
    const samlResponse = body['SAMLResponse'] as string

    if (!samlResponse) {
      return c.json({ error: 'Missing SAMLResponse' }, 400)
    }

    // Decode base64 SAML response
    const xml = atob(samlResponse)

    // ⚠ Production: validate signature with IdP public cert (use a SAML library)
    // Extract email from SAML assertion (NameID or attribute)
    const emailMatch = xml.match(/<(?:saml:|saml2:)?NameID[^>]*>([^<]+)</)
    const email = emailMatch?.[1]?.trim()

    if (!email) {
      return new Response('SSO Error: could not extract email from SAML assertion', { status: 400 })
    }

    // Look up user in D1
    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ? AND tenant_id = ?'
    ).bind(email.toLowerCase(), tenantId).first() as Record<string, unknown> | null

    if (!user) {
      // Auto-provision user if SSO enforce is enabled
      return new Response(`SSO Error: no user found for ${email}. Ask your admin to provision your account.`, { status: 403 })
    }

    // Issue a JWT for the user
    const { signToken } = await import('../lib/auth')
    const token = await signToken({ sub: user.id as string, tenant_id: user.tenant_id as string, email: user.email as string, role: user.role as string }, c.env)

    // Redirect to dashboard with token (stored in localStorage via JS)
    const appUrl = c.env.APP_URL || ''
    const html = `<!DOCTYPE html><html><body>
    <script>
      localStorage.setItem('siq_token', ${JSON.stringify(token)});
      localStorage.setItem('siq_user', JSON.stringify({ email: ${JSON.stringify(email)}, role: ${JSON.stringify(user.role)} }));
      window.location.href = '/dashboard';
    </script>
    <noscript>SSO login successful. <a href="/dashboard">Click here to continue</a>.</noscript>
    </body></html>`

    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  } catch (err) {
    console.error('[SSO ACS]', err)
    return new Response('SSO authentication failed', { status: 500 })
  }
})

export default integrations
