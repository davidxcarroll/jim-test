import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'

export async function POST(request: NextRequest) {
  try {
    const { email, displayName } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    await emailService.addToAudience(email, displayName)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding user to audience:', error)
    return NextResponse.json(
      { error: 'Failed to add user to audience' },
      { status: 500 }
    )
  }
}
