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
 * Uses caching to ensure consistency
 */
export function getPhilPicks(games: Game[], weekKey?: string): Record<string, { pickedTeam: 'home' | 'away', pickedAt: any }> {
  // If no weekKey provided, generate picks without caching
  if (!weekKey) {
    return generatePhilPicks(games)
  }
  
  // Check cache first
  if (philPicksCache[weekKey]) {
    console.log('🏈 Using cached Phil picks for week:', weekKey)
    return philPicksCache[weekKey]
  }
  
  // Generate new picks and cache them
  const philPicks = generatePhilPicks(games)
  philPicksCache[weekKey] = philPicks
  console.log('🏈 Generated and cached Phil picks for week:', weekKey)
  
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