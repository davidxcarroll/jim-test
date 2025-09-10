import { generatePhilPicks } from './team-utils'
import { Game } from '@/types/nfl'

// Phil's hardcoded user data
export const PHIL_USER = {
  id: 'phil-hardcoded',
  uid: 'phil-hardcoded',
  displayName: 'Phil',
  email: 'phil@example.com',
  superBowlPick: 'CAR', // Carolina Panthers
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01')
}

// Simple cache for Phil's picks by week
const philPicksCache: Record<string, Record<string, { pickedTeam: 'home' | 'away', pickedAt: any }>> = {}

/**
 * Get Phil's picks for a given week
 * Phil always picks the favorite team for each matchup
 * Uses caching to ensure consistency, but always generates fresh picks for the provided games
 */
export function getPhilPicks(games: Game[], weekKey?: string): Record<string, { pickedTeam: 'home' | 'away', pickedAt: any }> {
  // Always generate fresh picks based on the provided games data
  // This ensures Phil's picks are always consistent with the games being displayed
  const philPicks = generatePhilPicks(games)
  
  // Cache the picks for this week if a weekKey is provided
  if (weekKey) {
    philPicksCache[weekKey] = philPicks
    console.log('🏈 Generated and cached Phil picks for week:', weekKey, 'with', games.length, 'games')
  }
  
  return philPicks
}

/**
 * Clear Phil's picks cache (useful for testing or when team records change)
 */
export function clearPhilPicksCache(): void {
  Object.keys(philPicksCache).forEach(key => delete philPicksCache[key])
  console.log('🏈 Cleared Phil picks cache')
}

/**
 * Check if a user is Phil
 */
export function isPhil(userId: string): boolean {
  return userId === PHIL_USER.id
}

/**
 * Ensure Phil's user document exists in the database
 */
export async function ensurePhilUserExists(): Promise<void> {
  const { db } = await import('@/lib/firebase')
  const { doc, getDoc, setDoc } = await import('firebase/firestore')
  
  if (!db) {
    console.warn('Firebase not initialized, cannot ensure Phil user exists')
    return
  }

  try {
    // Check if Phil's user document exists
    const philUserDoc = await getDoc(doc(db, 'users', PHIL_USER.id))
    
    if (!philUserDoc.exists()) {
      // Create Phil's user document
      await setDoc(doc(db, 'users', PHIL_USER.id), PHIL_USER)
      console.log('🏈 Created Phil user document in database')
    } else {
      console.log('🏈 Phil user document already exists')
    }
  } catch (error) {
    console.error('Error ensuring Phil user exists:', error)
  }
}

/**
 * Generate and store Phil's picks for a given week
 * This should be called when a new week starts (typically on Tuesday)
 */
export async function generateAndStorePhilPicks(games: Game[], weekKey: string): Promise<void> {
  const { db } = await import('@/lib/firebase')
  const { doc, getDoc, setDoc, serverTimestamp } = await import('firebase/firestore')
  
  if (!db) {
    console.warn('Firebase not initialized, cannot store Phil picks')
    return
  }

  try {
    // Ensure Phil's user document exists first
    await ensurePhilUserExists()

    // Check if Phil's picks already exist for this week
    const philPicksDoc = await getDoc(doc(db, 'users', PHIL_USER.id, 'picks', weekKey))
    
    if (philPicksDoc.exists()) {
      console.log('🏈 Phil picks already exist for week:', weekKey)
      return
    }

    // Generate Phil's picks for this week
    const philPicks = generatePhilPicks(games)
    
    // Add timestamp to each pick
    const picksWithTimestamp = Object.fromEntries(
      Object.entries(philPicks).map(([gameId, pick]) => [
        gameId,
        {
          ...pick,
          pickedAt: serverTimestamp()
        }
      ])
    )

    // Store Phil's picks in the database
    await setDoc(doc(db, 'users', PHIL_USER.id, 'picks', weekKey), picksWithTimestamp)
    
    console.log('🏈 Generated and stored Phil picks for week:', weekKey, 'with', games.length, 'games')
  } catch (error) {
    console.error('Error generating and storing Phil picks:', error)
  }
} 