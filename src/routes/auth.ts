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
