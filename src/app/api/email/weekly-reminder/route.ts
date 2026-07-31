import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  getBearerToken,
  hasCronSecret,
  verifyFirebaseIdToken,
} from '@/lib/api-auth'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const { email, displayName, weekNumber, weekLabel, sendToAll } = body || {}

    const token = getBearerToken(request)
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const labelOrNumber = weekLabel ?? weekNumber

    // Blast / arbitrary recipient: cron secret only
    if (hasCronSecret(request)) {
      if (sendToAll) {
        if (!db) {
          return NextResponse.json(
            { error: 'Firebase not initialized' },
            { status: 500 }
          )
        }

        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('emailNotifications', '==', true))
        const querySnapshot = await getDocs(q)

        const recipients: Array<{ email: string; displayName?: string }> = []
        for (const docSnap of querySnapshot.docs) {
          const userData = docSnap.data()
          if (typeof userData.email !== 'string' || !userData.email) continue
          recipients.push({
            email: userData.email,
            displayName:
              typeof userData.displayName === 'string'
                ? userData.displayName
                : undefined,
          })
        }

        const weekText =
          typeof labelOrNumber === 'string' || typeof labelOrNumber === 'number'
            ? String(labelOrNumber)
            : 'New Week'

        const { sent, failed } = await emailService.sendWeeklyRemindersBatch(
          recipients,
          weekText
        )

        return NextResponse.json({
          success: true,
          sentTo: sent,
          failed,
        })
      }

      if (!email || typeof email !== 'string') {
        return NextResponse.json(
          { error: 'Email is required (or pass sendToAll: true)' },
          { status: 400 }
        )
      }

      await emailService.sendWeeklyReminder(email, displayName, labelOrNumber)
      return NextResponse.json({ success: true })
    }

    // Firebase ID token: test send to self only
    const verified = await verifyFirebaseIdToken(token)
    if (!verified) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (email && email.toLowerCase() !== verified.email.toLowerCase()) {
      return NextResponse.json(
        { error: 'Email must match the signed-in user' },
        { status: 403 }
      )
    }

    await emailService.sendWeeklyReminder(
      verified.email,
      displayName,
      labelOrNumber
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error sending weekly reminder emails:', error)
    return NextResponse.json(
      { error: 'Failed to send weekly reminder emails' },
      { status: 500 }
    )
  }
}
