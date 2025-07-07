import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'

console.log("RESEND_API_KEY:", process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    await emailService.sendWelcomeEmail(email, displayName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending welcome email:', error)
    return NextResponse.json(
      { error: 'Failed to send welcome email' },
      { status: 500 }
    )
  }
} 