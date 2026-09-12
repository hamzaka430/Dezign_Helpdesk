// ============================================================
// SupportIQ — Auth Utilities
// JWT signing/verification using jose (CF Workers compatible)
// Password hashing using Web Crypto API (no bcrypt in Workers)
// ============================================================

import { SignJWT, jwtVerify } from 'jose'

export interface JWTPayload {
  sub: string          // user id
  tenant_id: string
  email: string
  role: string
  first_name: string
  last_name: string
  iat?: number
  exp?: number
}

// ---- Password Hashing (Web Crypto, no Node.js bcrypt) ------

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder()
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const derived = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  const hashArray = new Uint8Array(derived)
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split(':')
    if (parts.length !== 3 || parts[0] !== 'pbkdf2') return false
    const salt = new Uint8Array(parts[1].match(/.{2}/g)!.map(h => parseInt(h, 16)))
    const expectedHash = parts[2]
    const encoder = new TextEncoder()
    const keyMaterial = await crypto.subtle.importKey(
      'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
    )
    const derived = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
      keyMaterial,
      256
    )
    const hashArray = new Uint8Array(derived)
    const hashHex = Array.from(hashArray).map(b => b.toString(16).padStart(2, '0')).join('')
    return hashHex === expectedHash
  } catch {
    return false
  }
}

// ---- JWT ---------------------------------------------------

function getSecret(env: { JWT_SECRET?: string }): Uint8Array {
  const secret = env.JWT_SECRET || 'supportiq_dev_secret_change_in_production_32chars'
  return new TextEncoder().encode(secret)
}

export async function signToken(payload: JWTPayload, env: { JWT_SECRET?: string }): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(getSecret(env))
}

export async function verifyToken(
  token: string,
  env: { JWT_SECRET?: string }
): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(env))
    return payload as unknown as JWTPayload
  } catch {
    return null
  }
}

// ---- Token extraction from request -------------------------

export function extractToken(req: Request): string | null {
  const authHeader = req.headers.get('Authorization')
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice(7)
  const url = new URL(req.url)
  return url.searchParams.get('token')
}

// ---- Generate secure random ID  ----------------------------

export function generateId(prefix = ''): string {
  const arr = crypto.getRandomValues(new Uint8Array(16))
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  return prefix ? `${prefix}_${hex}` : hex
}

// ---- Generate API key (sk_live_...) ------------------------

export function generateApiKey(): { key: string; prefix: string } {
  const arr = crypto.getRandomValues(new Uint8Array(24))
  const hex = Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('')
  const key = `sk_live_${hex}`
  return { key, prefix: `sk_live_${hex.slice(0, 8)}` }
}

export async function hashApiKey(key: string): Promise<string> {
  const data = new TextEncoder().encode(key)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('')
}
