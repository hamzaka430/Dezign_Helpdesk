// ============================================================
// SupportIQ — Billing Routes (Phase 4)
// GET  /api/billing/plans         — Available plans
// GET  /api/billing/subscription  — Current subscription
// POST /api/billing/checkout      — Create Stripe checkout session
// POST /api/billing/portal        — Stripe billing portal
// POST /api/billing/webhook       — Stripe webhook handler
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { Env, Variables, authMiddleware } from '../lib/middleware'

const billing = new Hono<{ Bindings: Env; Variables: Variables }>()

// ---- Plan definitions (hard-coded, UI-facing) --------------

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    price_monthly: 0,
    price_yearly: 0,
    stripe_price_monthly: null,
    stripe_price_yearly: null,
    features: {
      tickets_per_month: 100,
      ai_conversations: 200,
      agents: 2,
      knowledge_bases: 1,
      analytics: false,
      api_access: false,
      custom_domain: false,
      sso: false,
    },
  },
  {
    id: 'pro',
    name: 'Pro',
    price_monthly: 49,
    price_yearly: 490,
    stripe_price_monthly: process.env?.STRIPE_PRO_MONTHLY_PRICE_ID || 'price_pro_monthly',
    stripe_price_yearly: process.env?.STRIPE_PRO_YEARLY_PRICE_ID || 'price_pro_yearly',
    features: {
      tickets_per_month: 5000,
      ai_conversations: 10000,
      agents: 10,
      knowledge_bases: 10,
      analytics: true,
      api_access: true,
      custom_domain: false,
      sso: false,
    },
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price_monthly: 199,
    price_yearly: 1990,
    stripe_price_monthly: process.env?.STRIPE_ENT_MONTHLY_PRICE_ID || 'price_ent_monthly',
    stripe_price_yearly: process.env?.STRIPE_ENT_YEARLY_PRICE_ID || 'price_ent_yearly',
    features: {
      tickets_per_month: -1, // unlimited
      ai_conversations: -1,
      agents: -1,
      knowledge_bases: -1,
      analytics: true,
      api_access: true,
      custom_domain: true,
      sso: true,
    },
  },
]

// ---- GET /api/billing/plans --------------------------------

billing.get('/plans', (c) => {
  return c.json({ plans: PLANS })
})

// ---- GET /api/billing/subscription -------------------------

billing.get('/subscription', authMiddleware, async (c) => {
  const user = c.get('user')
  try {
    const db = new DB(c.env.DB)
    const tenant = await db.getTenantById(user.tenant_id)
    const plan = PLANS.find(p => p.id === tenant?.plan) || PLANS[0]

    // Get usage stats for current billing period
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const ticketCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM tickets WHERE tenant_id = ? AND created_at >= ?`
    ).bind(user.tenant_id, startOfMonth).first<{ count: number }>()

    const convCount = await c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM conversations WHERE tenant_id = ? AND created_at >= ?`
    ).bind(user.tenant_id, startOfMonth).first<{ count: number }>()

    return c.json({
      tenant,
      plan,
      usage: {
        tickets_this_month: ticketCount?.count || 0,
        conversations_this_month: convCount?.count || 0,
      },
      billing_portal_available: !!c.env.STRIPE_SECRET_KEY,
    })
  } catch (err) {
    console.error('[GET /billing/subscription]', err)
    return c.json({ error: 'Failed to fetch subscription' }, 500)
  }
})

// ---- POST /api/billing/checkout ----------------------------

billing.post('/checkout', authMiddleware, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Billing not configured. Set STRIPE_SECRET_KEY secret.' }, 503)
  }

  const user = c.get('user')
  const body = await c.req.json<{ plan_id: string; interval?: 'monthly' | 'yearly'; success_url?: string; cancel_url?: string }>()

  const plan = PLANS.find(p => p.id === body.plan_id)
  if (!plan || plan.id === 'free') return c.json({ error: 'Invalid plan' }, 422)

  const priceId = body.interval === 'yearly' ? plan.stripe_price_yearly : plan.stripe_price_monthly
  if (!priceId) return c.json({ error: 'Price not configured for this plan' }, 503)

  try {
    const appUrl = c.env.APP_URL || 'https://supportiq.pages.dev'
    const payload = new URLSearchParams({
      'mode': 'subscription',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': body.success_url || `${appUrl}/dashboard/settings?billing=success`,
      'cancel_url': body.cancel_url || `${appUrl}/dashboard/settings?billing=cancelled`,
      'client_reference_id': user.tenant_id,
      'customer_email': user.email,
      'metadata[tenant_id]': user.tenant_id,
      'metadata[plan_id]': plan.id,
    })

    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    })

    if (!res.ok) {
      const err = await res.json() as { error: { message: string } }
      return c.json({ error: err.error?.message || 'Stripe error' }, 500)
    }

    const session = await res.json() as { id: string; url: string }
    return c.json({ checkout_url: session.url, session_id: session.id })
  } catch (err) {
    console.error('[POST /billing/checkout]', err)
    return c.json({ error: 'Failed to create checkout session' }, 500)
  }
})

// ---- POST /api/billing/portal ------------------------------

billing.post('/portal', authMiddleware, async (c) => {
  if (!c.env.STRIPE_SECRET_KEY) {
    return c.json({ error: 'Billing not configured' }, 503)
  }

  const user = c.get('user')
  try {
    // Fetch tenant to get stripe_customer_id
    const tenant = await c.env.DB.prepare(
      `SELECT stripe_customer_id FROM tenants WHERE id = ?`
    ).bind(user.tenant_id).first<{ stripe_customer_id: string | null }>()

    if (!tenant?.stripe_customer_id) {
      return c.json({ error: 'No billing account found. Subscribe to a plan first.' }, 404)
    }

    const appUrl = c.env.APP_URL || 'https://supportiq.pages.dev'
    const payload = new URLSearchParams({
      'customer': tenant.stripe_customer_id,
      'return_url': `${appUrl}/dashboard/settings`,
    })

    const res = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: payload.toString(),
    })

    if (!res.ok) {
      const err = await res.json() as { error: { message: string } }
      return c.json({ error: err.error?.message || 'Stripe portal error' }, 500)
    }

    const portal = await res.json() as { url: string }
    return c.json({ portal_url: portal.url })
  } catch (err) {
    console.error('[POST /billing/portal]', err)
    return c.json({ error: 'Failed to create billing portal session' }, 500)
  }
})

// ---- POST /api/billing/webhook ----------------------------
// Stripe webhook — verifies signature, handles plan upgrades

billing.post('/webhook', async (c) => {
  if (!c.env.STRIPE_SECRET_KEY || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Webhook not configured' }, 503)
  }

  const sig = c.req.header('stripe-signature')
  const body = await c.req.text()

  // Verify Stripe webhook signature using Web Crypto
  let event: Record<string, unknown>
  try {
    event = await verifyStripeWebhook(body, sig || '', c.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('[Stripe webhook verify]', err)
    return c.json({ error: 'Invalid signature' }, 400)
  }

  try {
    const type = event.type as string
    const data = (event.data as { object: Record<string, unknown> }).object

    if (type === 'checkout.session.completed') {
      const tenantId = (data.metadata as Record<string, string>)?.tenant_id
      const planId = (data.metadata as Record<string, string>)?.plan_id
      const customerId = data.customer as string

      if (tenantId && planId) {
        // Update tenant plan
        await c.env.DB.prepare(
          `UPDATE tenants SET plan = ?, updated_at = ? WHERE id = ?`
        ).bind(planId, new Date().toISOString(), tenantId).run()

        // Save stripe_customer_id
        if (customerId) {
          await c.env.DB.prepare(
            `UPDATE tenants SET stripe_customer_id = ? WHERE id = ?`
          ).bind(customerId, tenantId).run()
        }
      }
    }

    if (type === 'customer.subscription.deleted') {
      // Downgrade to free on cancellation
      const customerId = data.customer as string
      await c.env.DB.prepare(
        `UPDATE tenants SET plan = 'free', updated_at = ? WHERE stripe_customer_id = ?`
      ).bind(new Date().toISOString(), customerId).run()
    }

    return c.json({ received: true })
  } catch (err) {
    console.error('[Stripe webhook handler]', err)
    return c.json({ error: 'Webhook handler error' }, 500)
  }
})

// ── Stripe webhook signature verification ───────────────────
async function verifyStripeWebhook(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<Record<string, unknown>> {
  const parts = sigHeader.split(',')
  const tsEntry = parts.find(p => p.startsWith('t='))
  const v1Entry = parts.find(p => p.startsWith('v1='))
  if (!tsEntry || !v1Entry) throw new Error('Invalid signature header')

  const timestamp = tsEntry.slice(2)
  const signature = v1Entry.slice(3)
  const signedPayload = `${timestamp}.${payload}`

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sigBytes = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(signedPayload)
  )

  const expectedSig = Array.from(new Uint8Array(sigBytes))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  if (expectedSig !== signature) throw new Error('Signature mismatch')

  return JSON.parse(payload)
}

export default billing
