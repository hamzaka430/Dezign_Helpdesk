// ============================================================
// SupportIQ — Hono Middleware
// Auth guard, CORS, error handler
// ============================================================

import { Context, Next } from 'hono'
import { verifyToken, extractToken, JWTPayload } from './auth'

export type Env = {
  // Cloudflare bindings
  DB: D1Database
  STORAGE: R2Bucket
  // Secrets (set via wrangler secret put)
  JWT_SECRET: string
  OPENAI_API_KEY?: string
  QDRANT_URL?: string
  QDRANT_API_KEY?: string
  STRIPE_SECRET_KEY?: string
  STRIPE_WEBHOOK_SECRET?: string
  RESEND_API_KEY?: string
  SLACK_BOT_TOKEN?: string
  // Non-secret vars
  ENVIRONMENT?: string
  APP_URL?: string
  // Multi-tenant
  TENANT_SUBDOMAIN_ENABLED?: string   // 'true' to enable subdomain routing
}

export type Variables = {
  user: JWTPayload
  /** resolved tenant_id from subdomain or X-Tenant-ID header (Phase 6) */
  resolved_tenant_id?: string
}

// ---- Auth Middleware (protect routes) ----------------------

export async function authMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const token = extractToken(c.req.raw)

  if (!token) {
    return c.json({ error: 'Unauthorized', message: 'No token provided' }, 401)
  }

  const payload = await verifyToken(token, c.env)
  if (!payload) {
    return c.json({ error: 'Unauthorized', message: 'Invalid or expired token' }, 401)
  }

  c.set('user', payload)
  await next()
}

// ---- API Key Middleware (for widget/external calls) --------

export async function apiKeyMiddleware(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const apiKey = c.req.header('X-API-Key') || c.req.query('api_key')
  if (!apiKey) {
    return c.json({ error: 'Unauthorized', message: 'No API key provided' }, 401)
  }

  // Look up API key in DB
  const result = await c.env.DB.prepare(
    `SELECT ak.*, u.tenant_id, u.role FROM api_keys ak
     JOIN users u ON u.id = ak.created_by
     WHERE ak.key_prefix = ? AND ak.is_active = 1`
  ).bind(apiKey.slice(0, 8)).first() as Record<string, unknown> | null

  if (!result) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401)
  }

  // Verify hash
  const { hashApiKey } = await import('./auth')
  const hash = await hashApiKey(apiKey)
  if (hash !== result.key_hash) {
    return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401)
  }

  // Update last_used_at
  await c.env.DB.prepare('UPDATE api_keys SET last_used_at = ? WHERE id = ?')
    .bind(new Date().toISOString(), result.id).run()

  // Set a minimal user context for API key callers
  c.set('user', {
    sub: result.created_by as string,
    tenant_id: result.tenant_id as string,
    role: result.role as string,
    email: '',
    iat: Math.floor(Date.now() / 1000),
  })
  await next()
}

// ---- CORS helper -------------------------------------------

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    'Access-Control-Max-Age': '86400',
  }
}

// ---- JSON error helper -------------------------------------

export function jsonError(message: string, status: 400 | 401 | 403 | 404 | 409 | 422 | 500 = 400) {
  return Response.json({ error: message }, { status })
}

// ---- Admin only guard --------------------------------------

export async function adminOnly(c: Context<{ Bindings: Env; Variables: Variables }>, next: Next) {
  const user = c.get('user')
  if (!user || user.role !== 'admin') {
    return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403)
  }
  await next()
}

// ---- Validate request body helper --------------------------

export function validateBody<T extends Record<string, unknown>>(
  body: Partial<T>,
  required: (keyof T)[]
): string | null {
  for (const field of required) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `Field '${String(field)}' is required`
    }
  }
  return null
}

// ---- Multi-tenant resolver (Phase 6) -----------------------
// Resolves tenant from: X-Tenant-ID header → subdomain → JWT.
// Run BEFORE authMiddleware on routes that need tenant context
// without requiring login (e.g. public widget API).

export async function tenantMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next
) {
  // 1. Explicit header (for server-to-server or tests)
  let tenantId = c.req.header('X-Tenant-ID')

  // 2. Subdomain routing (e.g. acme.supportiq.io)
  if (!tenantId && c.env.TENANT_SUBDOMAIN_ENABLED === 'true') {
    const host = c.req.header('Host') || ''
    const baseDomain = (c.env.APP_URL || '').replace(/^https?:\/\//, '')
    if (host.endsWith('.' + baseDomain)) {
      const subdomain = host.slice(0, host.length - baseDomain.length - 1)
      if (subdomain && subdomain !== 'www' && subdomain !== 'api') {
        // Look up tenant by subdomain slug
        const tenant = await c.env.DB.prepare(
          "SELECT id FROM tenants WHERE slug = ?"
        ).bind(subdomain).first<{ id: string }>()
        if (tenant) tenantId = tenant.id
      }
    }
  }

  // 3. Fall through to JWT (authMiddleware will set user.tenant_id)
  if (tenantId) {
    c.set('resolved_tenant_id', tenantId)
  }

  await next()
}

// ---- Rate limiting helper (basic in-memory token bucket) ---
// For production use Cloudflare Rate Limiting rules instead.

const rateBuckets = new Map<string, { count: number; resetAt: number }>()

export function rateLimit(maxRequests: number, windowMs: number) {
  return async function(
    c: Context<{ Bindings: Env; Variables: Variables }>,
    next: Next
  ) {
    const ip = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For') || 'unknown'
    const key = `${c.req.path}:${ip}`
    const now = Date.now()

    let bucket = rateBuckets.get(key)
    if (!bucket || bucket.resetAt < now) {
      bucket = { count: 0, resetAt: now + windowMs }
      rateBuckets.set(key, bucket)
    }

    bucket.count++
    if (bucket.count > maxRequests) {
      return c.json({ error: 'Too many requests', retry_after: Math.ceil((bucket.resetAt - now) / 1000) }, 429)
    }

    c.res.headers.set('X-RateLimit-Limit', String(maxRequests))
    c.res.headers.set('X-RateLimit-Remaining', String(Math.max(0, maxRequests - bucket.count)))
    await next()
  }
}
