import { Team, Game } from '@/types/nfl'
import { espnApi } from '@/lib/espn-api'
import { getTeamDisplayNameFromTeam } from './team-names'
import { getTeamColorMappings } from '@/store/team-color-mapping-store'
import { getTeamBackgroundColor, getTeamLogoType } from './team-color-mapping'

// Helper function to get the best logo for a given context
export function getTeamLogo(team: Team, context: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' = 'default'): string | undefined {
  // If the team has the new logos object with variations, use that
  if (team.logos) {
    switch (context) {
      case 'dark':
        return team.logos.dark || team.logos.default || team.logo
      case 'scoreboard':
        return team.logos.scoreboard || team.logos.default || team.logo
      case 'darkScoreboard':
        return team.logos.darkScoreboard || team.logos.dark || team.logos.scoreboard || team.logos.default || team.logo
      case 'default':
      default:
        return team.logos.default || team.logo
    }
  }
  
  // Fallback to the legacy logo field
  return team.logo
}

// Helper function to determine if a color is white or very light
function isLightColor(color: string): boolean {
  if (!color) return false
  
  // Remove # if present
  const hex = color.replace('#', '')
  
  // Convert hex to RGB
  const r = parseInt(hex.substr(0, 2), 16)
  const g = parseInt(hex.substr(2, 2), 16)
  const b = parseInt(hex.substr(4, 2), 16)
  
  // Calculate brightness (0-255)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000
  
  // Consider colors with brightness > 200 as "light"
  return brightness > 200
}

// Helper function to get the best background color and logo type for a team
export function getTeamBackgroundAndLogo(team: Team): {
  background: string
  logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard'
  useGradient: boolean
} {
  const mappings = getTeamColorMappings()
  // Get background color and logo type from manual mapping
  const background = getTeamBackgroundColor(team, mappings)
  const logoType = getTeamLogoType(team, mappings)
  return {
    background,
    logoType,
    useGradient: false // No gradients for simplicity
  }
}

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
    if (teamsCache && teamsCache.length > 0) {
    }
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

/**
 * Fetch team records (wins/losses/ties) from ESPN NFL standings endpoint
 */
export async function fetchTeamRecordsFromStandings() {
  const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/football/nfl/standings')
  const data = await response.json()
  // Find the first team entry for debugging
  if (data.standings && data.standings.entries && data.standings.entries.length > 0) {
  } else {
    console.error('Standings API response missing expected structure:', JSON.stringify(data, null, 2));
  }
  // Build a map of abbreviation -> { wins, losses, ties }
  const records: Record<string, { wins: number, losses: number, ties: number }> = {}
  for (const entry of data.standings.entries) {
    const team = entry.team
    const stats = entry.stats
    const abbreviation = team.abbreviation
    const wins = stats.find((s: any) => s.name === 'wins')?.value
    const losses = stats.find((s: any) => s.name === 'losses')?.value
    const ties = stats.find((s: any) => s.name === 'ties')?.value
    if (abbreviation && typeof wins === 'number' && typeof losses === 'number') {
      records[abbreviation] = { wins, losses, ties: ties || 0 }
    }
  }
  return records
} 

/**
 * Generate Phil's picks for a given week.
 * Phil picks the betting favorite. Games with no favorite are skipped so a missing line cannot become a home pick.
 */
export function generatePhilPicks(games: Game[]): Record<string, { pickedTeam: 'home' | 'away', pickedAt: any }> {
  const philPicks: Record<string, { pickedTeam: 'home' | 'away', pickedAt: any }> = {}
  
  games.forEach(game => {
    if (game.favoriteTeam !== 'home' && game.favoriteTeam !== 'away') return
    philPicks[game.id] = {
      pickedTeam: game.favoriteTeam,
      pickedAt: new Date()
    }
  })
  
  return philPicks
} 

/**
 * Get team display name with favorite indicator
 * @param team - The team object
 * @param game - The game object containing favoriteTeam information
 * @param isHome - Whether this is the home team
 * @returns Team name with • indicator if favored
 */
export function getTeamDisplayNameWithFavorite(team: Team, game: Game, isHome: boolean): string {
  const baseName = getTeamDisplayNameFromTeam(team)
  
  // Check if this team is the favorite
  if (game.favoriteTeam === (isHome ? 'home' : 'away')) {
    return `• ${baseName}`
  }
  
  return baseName
} 