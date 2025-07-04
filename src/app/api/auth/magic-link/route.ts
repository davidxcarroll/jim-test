import { NextRequest, NextResponse } from 'next/server'
import { sendSignInLinkToEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    const actionCodeSettings = {
      url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth-complete`,
      handleCodeInApp: true,
    }

    await sendSignInLinkToEmail(auth, email, actionCodeSettings)
    
    return NextResponse.json({ 
      success: true, 
      message: 'Magic link sent successfully' 
    })
  } catch (error: any) {
    console.error('Error sending magic link:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to send magic link' },
      { status: 500 }
    )
  }
} 