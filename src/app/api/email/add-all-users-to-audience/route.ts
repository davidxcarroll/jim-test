import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(request: NextRequest) {
  try {
    // Check if Firebase is initialized
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      )
    }

    // Get all users from Firestore
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const results = []
    
    for (const userDoc of usersSnapshot.docs) {
      const userData = userDoc.data()
      const email = userData.email
      const displayName = userData.displayName
      
      if (email) {
        try {
          await emailService.addToAudience(email, displayName)
          results.push({ email, success: true })
        } catch (error) {
          console.error(`Failed to add ${email} to audience:`, error)
          results.push({ email, success: false, error: error.message })
        }
      }
    }

    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    return NextResponse.json({ 
      success: true,
      totalUsers: results.length,
      successCount,
      failureCount,
      results
    })
  } catch (error) {
    console.error('Error adding all users to audience:', error)
    return NextResponse.json(
      { error: 'Failed to add users to audience' },
      { status: 500 }
    )
  }
}
