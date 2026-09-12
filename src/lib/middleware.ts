// ============================================================
// SupportIQ — Hono Middleware
// Auth guard, CORS, error handler
// ============================================================

import { Context, Next } from 'hono'
import { verifyToken, extractToken, JWTPayload } from './auth'

export type Env = {
  DB: D1Database
  STORAGE: R2Bucket
  JWT_SECRET: string
  ENVIRONMENT?: string
}

export type Variables = {
  user: JWTPayload
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

// ---- CORS Middleware ----------------------------------------

export function corsHeaders(origin = '*') {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
