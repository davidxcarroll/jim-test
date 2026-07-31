import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import {
  getBearerToken,
  hasCronSecret,
  verifyFirebaseIdToken,
} from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json()

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Cron secret: allow admin/test sends to any address
    if (hasCronSecret(request)) {
      await emailService.sendWelcomeEmail(email, displayName)
      return NextResponse.json({ success: true })
    }

    // Firebase ID token: only send to the authenticated user's own email
    const verified = await verifyFirebaseIdToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (verified.email.toLowerCase() !== email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email must match the signed-in user' },
        { status: 403 }
      )
    }

    await emailService.sendWelcomeEmail(verified.email, displayName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    )
  }
}
