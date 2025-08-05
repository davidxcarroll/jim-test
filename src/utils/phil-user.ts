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

/**
 * Get Phil's picks for a given week
 * Phil always picks the favorite team for each matchup
 */
export function getPhilPicks(games: Game[]): Record<string, { pickedTeam: 'home' | 'away', pickedAt: any }> {
  return generatePhilPicks(games)
}

/**
 * Check if a user is Phil
 */
export function isPhil(userId: string): boolean {
  return userId === PHIL_USER.id
} 