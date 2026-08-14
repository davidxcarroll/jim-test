import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getCurrentNFLWeekFromAPI, getRoundDisplayName } from '@/utils/date-helpers'
import { assertCronAuthorized } from '@/lib/api-auth'

/**
 * Manual / legacy weekly reminder endpoint.
 * Production schedule uses /api/cron/daily-tasks on the week start day.
 */
export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request)
  if (authError) return authError

  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      )
    }

    let manualWeekLabel: string | undefined
    try {
      const body = await request.json()
      if (body && typeof body.weekLabel === 'string') {
        manualWeekLabel = body.weekLabel
      } else if (body && typeof body.weekNumber === 'number') {
        manualWeekLabel = `Week ${body.weekNumber}`
      }
    } catch {
      // Ignore if no body or invalid JSON
    }

    const currentWeekResult = await getCurrentNFLWeekFromAPI()
    if (!currentWeekResult || 'offSeason' in currentWeekResult) {
      return NextResponse.json({
        success: true,
        sentTo: 0,
        skipped: true,
        reason: 'off-season or no current week',
        timestamp: new Date().toISOString(),
      })
    }

    const weekLabel =
      manualWeekLabel ||
      getRoundDisplayName(
        currentWeekResult.label,
        currentWeekResult.weekType,
        currentWeekResult.week
      )

    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('emailNotifications', '==', true))
    const querySnapshot = await getDocs(q)

    const recipients = []
    for (const userDoc of querySnapshot.docs) {
      const userData = userDoc.data()
      if (!userData.email) {
        console.warn('Skipping user without email:', userDoc.id)
        continue
      }
      recipients.push({
        email: userData.email as string,
        displayName: userData.displayName as string | undefined,
      })
    }

    const { sent, failed } = await emailService.sendWeeklyRemindersBatch(
      recipients,
      weekLabel
    )

    return NextResponse.json({
      success: true,
      sentTo: sent,
      failed,
      weekLabel,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error sending weekly reminder emails:', error)
    return NextResponse.json(
      { error: 'Failed to send weekly reminder emails' },
      { status: 500 }
    )
  }
}
