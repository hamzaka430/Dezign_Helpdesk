// ============================================================
// SupportIQ — Auth Routes
// POST /api/auth/signup
// POST /api/auth/login
// POST /api/auth/logout
// GET  /api/auth/me
// ============================================================

import { Hono } from 'hono'
import { DB } from '../lib/db'
import { hashPassword, verifyPassword, signToken, verifyToken, extractToken, generateId } from '../lib/auth'
import { Env, Variables, validateBody } from '../lib/middleware'

const auth = new Hono<{ Bindings: Env; Variables: Variables }>()

// ---- POST /api/auth/signup ---------------------------------

auth.post('/signup', async (c) => {
  try {
    const body = await c.req.json<{
      email?: string; password?: string; first_name?: string; last_name?: string
      company_name?: string; subdomain?: string
    }>()

    const err = validateBody(body, ['email', 'password', 'first_name', 'last_name', 'company_name'])
    if (err) return c.json({ error: err }, 422)

    const { email, password, first_name, last_name, company_name } = body as Required<typeof body>

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 422)
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ error: 'Invalid email address' }, 422)
    }

    const db = new DB(c.env.DB)

    // Check if email already registered
    const existing = await db.getUserByEmail(email)
    if (existing) {
      return c.json({ error: 'An account with this email already exists' }, 409)
    }

    // Generate subdomain from company name if not provided
    let subdomain = body.subdomain ||
      company_name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 32)
    if (!subdomain) subdomain = `workspace-${Date.now()}`

    // Make subdomain unique
    const existingTenant = await db.getTenantBySubdomain(subdomain)
    if (existingTenant) subdomain = `${subdomain}-${Date.now().toString().slice(-4)}`

    // Create tenant
    const tenantId = generateId('tenant')
    await db.createTenant({ id: tenantId, name: company_name, subdomain, plan: 'free' })

    // Hash password and create user
    const passwordHash = await hashPassword(password)
    const userId = generateId('user')
    await db.createUser({
      id: userId, tenant_id: tenantId,
      email, password_hash: passwordHash,
      first_name, last_name, role: 'admin'
    })

    // ── Seed demo data for new tenant ───────────────────────
    try {
      const now = new Date().toISOString()
      const ticketIds = [generateId('ticket'), generateId('ticket'), generateId('ticket')]

      // Sample tickets
      const sampleTickets = [
        {
          id: ticketIds[0], tenant_id: tenantId,
          subject: 'Cannot reset my password — email not arriving',
          description: 'I requested a password reset 30 minutes ago but no email arrived. Checked spam folder too.',
          status: 'open', priority: 'high',
          customer_name: 'Sarah Johnson', customer_email: 'sarah.j@example.com',
          channel: 'email', created_at: now, updated_at: now
        },
        {
          id: ticketIds[1], tenant_id: tenantId,
          subject: 'How do I export my data to CSV?',
          description: 'I need to export all my records to CSV for quarterly reporting. Cannot find the option.',
          status: 'resolved', priority: 'medium',
          customer_name: 'Marcus Lee', customer_email: 'marcus.lee@techcorp.io',
          channel: 'widget', created_at: now, updated_at: now
        },
        {
          id: ticketIds[2], tenant_id: tenantId,
          subject: 'Billing charge question — unexpected amount',
          description: 'My last invoice shows $149 but I am on the $99 plan. Please clarify.',
          status: 'in_progress', priority: 'urgent',
          customer_name: 'Priya Sharma', customer_email: 'priya@startup.co',
          channel: 'email', created_at: now, updated_at: now
        }
      ]

      for (const ticket of sampleTickets) {
        await c.env.DB.prepare(
          `INSERT INTO tickets (id, tenant_id, subject, description, status, priority, customer_name, customer_email, channel, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).bind(
          ticket.id, ticket.tenant_id, ticket.subject, ticket.description,
          ticket.status, ticket.priority, ticket.customer_name, ticket.customer_email,
          ticket.channel, ticket.created_at, ticket.updated_at
        ).run()
      }

      // Sample conversation
      const convId = generateId('conv')
      await c.env.DB.prepare(
        `INSERT INTO conversations (id, tenant_id, customer_name, customer_email, channel, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(convId, tenantId, 'Demo Customer', 'demo@example.com', 'widget', 'resolved', now, now).run()

      // Sample knowledge base article
      const kbId = generateId('kb')
      await c.env.DB.prepare(
        `INSERT INTO knowledge_bases (id, tenant_id, name, description, article_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      ).bind(kbId, tenantId, 'Getting Started Guide', 'Core documentation for new customers', 3, now, now).run()

    } catch (seedErr) {
      // Seed failure is non-fatal — user still gets their account
      console.warn('[signup seed]', seedErr)
    }

    // Sign JWT
    const token = await signToken({
      sub: userId, tenant_id: tenantId,
      email, role: 'admin', first_name, last_name
    }, c.env)

    return c.json({
      message: 'Account created successfully',
      token,
      user: { id: userId, email, first_name, last_name, role: 'admin', tenant_id: tenantId },
      tenant: { id: tenantId, name: company_name, subdomain, plan: 'free' }
    }, 201)

  } catch (err) {
    console.error('[signup error]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---- POST /api/auth/login ----------------------------------

auth.post('/login', async (c) => {
  try {
    const body = await c.req.json<{ email?: string; password?: string }>()
    const err = validateBody(body, ['email', 'password'])
    if (err) return c.json({ error: err }, 422)

    const { email, password } = body as Required<typeof body>
    const db = new DB(c.env.DB)

    const user = await db.getUserByEmail(email)
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    const valid = await verifyPassword(password, user.password_hash)
    if (!valid) {
      return c.json({ error: 'Invalid email or password' }, 401)
    }

    // Update last login
    await db.updateUserLastLogin(user.id)

    const tenant = await db.getTenantById(user.tenant_id)

    const token = await signToken({
      sub: user.id, tenant_id: user.tenant_id,
      email: user.email, role: user.role,
      first_name: user.first_name, last_name: user.last_name
    }, c.env)

    return c.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id, email: user.email,
        first_name: user.first_name, last_name: user.last_name,
        role: user.role, tenant_id: user.tenant_id,
        avatar_url: user.avatar_url
      },
      tenant
    })

  } catch (err) {
    console.error('[login error]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---- GET /api/auth/me --------------------------------------

auth.get('/me', async (c) => {
  try {
    const token = extractToken(c.req.raw)
    if (!token) return c.json({ error: 'Unauthorized' }, 401)

    const payload = await verifyToken(token, c.env)
    if (!payload) return c.json({ error: 'Invalid or expired token' }, 401)

    const db = new DB(c.env.DB)
    const user = await db.getUserById(payload.sub)
    if (!user) return c.json({ error: 'User not found' }, 404)

    const tenant = await db.getTenantById(user.tenant_id)

    return c.json({
      user: {
        id: user.id, email: user.email,
        first_name: user.first_name, last_name: user.last_name,
        role: user.role, tenant_id: user.tenant_id,
        avatar_url: user.avatar_url, last_login_at: user.last_login_at
      },
      tenant
    })
  } catch (err) {
    console.error('[me error]', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

// ---- POST /api/auth/logout ---------------------------------

auth.post('/logout', async (c) => {
  // JWT is stateless — client should delete the token.
  // If we add session table support later, invalidate here.
  return c.json({ message: 'Logged out successfully' })
})

export default auth
