// ============================================================
// SupportIQ — Settings Routes
// GET   /api/settings
// PATCH /api/settings
// GET   /api/settings/team
// POST  /api/settings/team/invite
// GET   /api/stats        (analytics)
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { authMiddleware, adminOnly, Env, Variables, validateBody } from '../lib/middleware'
import { generateId, generateApiKey, hashApiKey, hashPassword } from '../lib/auth'

const settings = new Hono<{ Bindings: Env; Variables: Variables }>()

settings.use('*', authMiddleware)

// ---- GET /api/settings -------------------------------------

settings.get('/', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const s = await db.getSettings(user.tenant_id)
    const tenant = await db.getTenantById(user.tenant_id)

    // Mask the api_key
    const masked = s ? {
      ...s,
      api_key: s.api_key ? `sk_live_${'•'.repeat(24)}` : null
    } : null

    return c.json({ settings: masked, tenant })
  } catch (err) {
    return c.json({ error: 'Failed to fetch settings' }, 500)
  }
})

// ---- PATCH /api/settings -----------------------------------

settings.patch('/', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      ai_confidence_threshold?: number
      escalation_keywords?: string
      ai_welcome_message?: string
      allow_human_request?: boolean
      widget_color?: string
      widget_primary_color?: string
      widget_greeting?: string
      widget_placeholder?: string
      widget_position?: string
      email_notifications?: boolean
      notification_email?: string
      slack_webhook_url?: string
      timezone?: string
      workspace_name?: string
      sso_enabled?: boolean
      sso_provider?: string
      sso_metadata_url?: string
      sso_entity_id?: string
      sso_enforce?: boolean
    }>()

    const db = new DB(c.env.DB)

    // Update workspace name on tenant if provided
    if (body.workspace_name) {
      await c.env.DB.prepare(
        "UPDATE tenants SET name = ?, updated_at = datetime('now') WHERE id = ?"
      ).bind(body.workspace_name, user.tenant_id).run()
    }

    const { workspace_name, ...settingsUpdate } = body
    if (Object.keys(settingsUpdate).length > 0) {
      await db.upsertSettings(user.tenant_id, settingsUpdate as any)
    }

    const s = await db.getSettings(user.tenant_id)
    const tenant = await db.getTenantById(user.tenant_id)
    return c.json({ message: 'Settings saved', settings: s, tenant })
  } catch (err) {
    console.error('[PATCH /settings]', err)
    return c.json({ error: 'Failed to save settings' }, 500)
  }
})

// ---- POST /api/settings/api-key (generate new API key) -----

settings.post('/api-key', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const { key, prefix } = generateApiKey()
    const keyHash = await hashApiKey(key)

    const db = new DB(c.env.DB)
    const id = generateId('apikey')

    // Store key hash (not plain key)
    await c.env.DB.prepare(
      'INSERT INTO api_keys (id, tenant_id, name, key_hash, key_prefix) VALUES (?, ?, ?, ?, ?)'
    ).bind(id, user.tenant_id, 'Default API Key', keyHash, prefix).run()

    // Also save prefix in workspace_settings for embed code display
    await db.upsertSettings(user.tenant_id, { api_key: prefix })

    return c.json({
      message: 'API key generated. Save it now — it will not be shown again.',
      key,   // Only shown ONCE
      prefix
    }, 201)
  } catch (err) {
    console.error('[POST /settings/api-key]', err)
    return c.json({ error: 'Failed to generate API key' }, 500)
  }
})

// ---- GET /api/settings/team --------------------------------

settings.get('/team', async (c) => {
  try {
    const user = c.get('user')
    const db = new DB(c.env.DB)
    const members = await db.listUsersByTenant(user.tenant_id)

    // Strip password hashes before returning
    const safe = members.map(({ password_hash, ...rest }) => rest)
    return c.json({ team: safe, total: safe.length })
  } catch (err) {
    return c.json({ error: 'Failed to fetch team' }, 500)
  }
})

// ---- POST /api/settings/team/invite (create agent) ---------

settings.post('/team/invite', adminOnly, async (c) => {
  try {
    const user = c.get('user')
    const body = await c.req.json<{
      email?: string; first_name?: string; last_name?: string
      role?: string; password?: string
    }>()

    const err = validateBody(body, ['email', 'first_name', 'last_name'])
    if (err) return c.json({ error: err }, 422)

    const db = new DB(c.env.DB)
    const existing = await db.getUserByEmail(body.email!)
    if (existing) return c.json({ error: 'A user with this email already exists' }, 409)

    const tmpPassword = body.password || `SupportIQ@${Math.random().toString(36).slice(2, 10)}`
    const passwordHash = await hashPassword(tmpPassword)
    const userId = generateId('user')

    await db.createUser({
      id: userId,
      tenant_id: user.tenant_id,
      email: body.email!,
      password_hash: passwordHash,
      first_name: body.first_name!,
      last_name: body.last_name!,
      role: (body.role as any) || 'agent'
    })

    const members = await db.listUsersByTenant(user.tenant_id)
    const safe = members.map(({ password_hash, ...rest }) => rest)

    return c.json({
      message: `Team member ${body.email} added`,
      temp_password: body.password ? undefined : tmpPassword,  // Only return if auto-generated
      team: safe
    }, 201)
  } catch (err) {
    console.error('[POST /settings/team/invite]', err)
    return c.json({ error: 'Failed to invite team member' }, 500)
  }
})

export default settings
