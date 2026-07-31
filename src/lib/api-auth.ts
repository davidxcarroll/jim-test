import { NextRequest, NextResponse } from 'next/server'

/** True when this deploy should require CRON_SECRET on cron/email admin routes. */
export function isProductionRuntime(): boolean {
  return (
    process.env.VERCEL_ENV === 'production' ||
    process.env.NODE_ENV === 'production'
  )
}

/**
 * Cron / admin API auth.
 * - Production: CRON_SECRET must be set and match Bearer token.
 * - Non-production: if CRON_SECRET is set, it must match; if unset, allow (local convenience).
 */
export function assertCronAuthorized(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization')
  const secret = process.env.CRON_SECRET

  if (isProductionRuntime()) {
    if (!secret || authHeader !== `Bearer ${secret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    return null
  }

  if (secret && authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return null
}

/** True only when Authorization matches a configured CRON_SECRET. */
export function hasCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get('authorization') === `Bearer ${secret}`
}

export type VerifiedFirebaseUser = {
  email: string
  uid: string
}

/** Verify a Firebase ID token via Identity Toolkit (no Admin SDK). */
export async function verifyFirebaseIdToken(
  idToken: string
): Promise<VerifiedFirebaseUser | null> {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY
  if (!apiKey || !idToken) return null

  try {
    const res = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      }
    )
    if (!res.ok) return null
    const data = await res.json()
    const user = data.users?.[0]
    if (!user?.email || !user?.localId) return null
    return { email: String(user.email), uid: String(user.localId) }
  } catch {
    return null
  }
}

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.startsWith('Bearer ')) return null
  return authHeader.slice('Bearer '.length).trim() || null
}
