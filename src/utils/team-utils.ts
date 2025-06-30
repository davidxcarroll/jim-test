import { Team } from '@/types/mlb'
import { espnApi } from '@/lib/espn-api'
import { getTeamDisplayNameFromTeam } from './team-names'

// Cache for team data to avoid repeated API calls
let teamsCache: Team[] | null = null
let teamsCacheTime: number = 0
const CACHE_DURATION = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Get all teams with caching
 */
export async function getTeams(): Promise<Team[]> {
  const now = Date.now()
  
  // Return cached data if still valid
  if (teamsCache && (now - teamsCacheTime) < CACHE_DURATION) {
    return teamsCache
  }
  
  // Fetch fresh data
  try {
    teamsCache = await espnApi.getTeams()
    teamsCacheTime = now
    return teamsCache
  } catch (error) {
    console.error('Error fetching teams:', error)
    return teamsCache || []
  }
}

/**
 * Get team data by abbreviation
 */
export async function getTeamByAbbreviation(abbreviation: string): Promise<Team | null> {
  const teams = await getTeams()
  return teams.find(team => team.abbreviation === abbreviation) || null
}

/**
 * Convert hex color to CSS color with # prefix
 */
export function formatHexColor(hex: string): string {
  if (!hex) return ''
  return hex.startsWith('#') ? hex : `#${hex}`
}

/**
 * Determine if a team name is long, medium, or short for choosing circle-team SVG size
 * @param team - The team object with abbreviation property
 * @returns 'lg' for long names, 'md' for medium, 'sm' for short names
 */
export function getTeamCircleSize(team: { abbreviation: string }): 'lg' | 'md' | 'sm' {
  const displayName = getTeamDisplayNameFromTeam(team)
  if (displayName.length <= 4) return 'sm'
  if (displayName.length <= 7) return 'md'
  return 'lg'
} 