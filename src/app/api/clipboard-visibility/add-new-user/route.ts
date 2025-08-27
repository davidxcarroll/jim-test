import { NextRequest, NextResponse } from 'next/server'
import { collection, getDocs, doc, getDoc, writeBatch } from 'firebase/firestore'
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

    const { newUserId } = await request.json()

    if (!newUserId) {
      return NextResponse.json(
        { error: 'New user ID is required' },
        { status: 400 }
      )
    }

    // Get all existing users
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const batch = writeBatch(db)
    
    // For each existing user, add the new user to their visible users (always show new users by default)
    for (const userDoc of usersSnapshot.docs) {
      const existingUserId = userDoc.id
      
      // Skip the new user themselves
      if (existingUserId === newUserId) continue
      
      const settingsRef = doc(db, 'users', existingUserId, 'settings', 'clipboard-visibility')
      const settingsDoc = await getDoc(settingsRef)
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data()
        const currentVisibleUsers = new Set((data.visibleUsers || []) as string[])
        currentVisibleUsers.add(newUserId)
        
        batch.update(settingsRef, {
          visibleUsers: Array.from(currentVisibleUsers),
          lastUpdated: new Date()
        })
      } else {
        // If no settings exist, create them with the new user visible by default
        batch.set(settingsRef, {
          visibleUsers: [newUserId],
          lastUpdated: new Date(),
          showNewUsersByDefault: true
        })
      }
    }
    
    await batch.commit()

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error adding new user to all users visibility settings:', error)
    return NextResponse.json(
      { error: 'Failed to add new user to all users visibility settings' },
      { status: 500 }
    )
  }
}

