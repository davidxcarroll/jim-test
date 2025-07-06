import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/email'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (email) {
      // Send to specific user
      await emailService.sendWeeklyReminder(email)
      return NextResponse.json({ success: true })
    } else {
      // Check if Firebase is initialized
      if (!db) {
        return NextResponse.json(
          { error: 'Firebase not initialized' },
          { status: 500 }
        )
      }

      // Send to all users who have opted in
      const usersRef = collection(db, 'users')
      const q = query(usersRef, where('emailNotifications', '==', true))
      const querySnapshot = await getDocs(q)
      
      const emailPromises = querySnapshot.docs.map(doc => {
        const userData = doc.data()
        return emailService.sendWeeklyReminder(
          userData.email,
          userData.displayName
        )
      })

      await Promise.all(emailPromises)
      
      return NextResponse.json({ 
        success: true, 
        sentTo: querySnapshot.size 
      })
    }
  } catch (error) {
    console.error('Error sending weekly reminder emails:', error)
    return NextResponse.json(
      { error: 'Failed to send weekly reminder emails' },
      { status: 500 }
    )
  }
} 