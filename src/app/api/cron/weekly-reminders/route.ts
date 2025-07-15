import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getMLBSeasonStart, getSeasonAndWeek } from '@/utils/date-helpers'

export async function POST(request: NextRequest) {
  // Verify the request is from a legitimate cron service
  const authHeader = request.headers.get('authorization')
  
  // Verify the request is from Vercel cron
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Check if Firebase is initialized
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      )
    }

    const today = new Date()
    const seasonStart = getMLBSeasonStart()
    const { season, week } = getSeasonAndWeek(today)

    // Accept weekNumber from request body if provided (for manual override)
    let manualWeekNumber: number | undefined = undefined
    try {
      const body = await request.json()
      if (body && typeof body.weekNumber === 'number') {
        manualWeekNumber = body.weekNumber
      }
    } catch (e) {
      // Ignore if no body or invalid JSON
    }

    // Use manual week number if provided, otherwise use calculated week number
    const finalWeekNumber = manualWeekNumber || week

    // Get all users who have opted in to email notifications
    const usersRef = collection(db, 'users')
    const q = query(usersRef, where('emailNotifications', '==', true))
    const querySnapshot = await getDocs(q)
    
    const emailPromises = querySnapshot.docs.map(doc => {
      const userData = doc.data()
      return emailService.sendWeeklyReminder(
        userData.email,
        userData.displayName,
        finalWeekNumber
      )
    })

    await Promise.all(emailPromises)
    
    return NextResponse.json({ 
      success: true, 
      sentTo: querySnapshot.size,
      weekNumber: finalWeekNumber,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error sending weekly reminder emails:', error)
    return NextResponse.json(
      { error: 'Failed to send weekly reminder emails' },
      { status: 500 }
    )
  }
} 