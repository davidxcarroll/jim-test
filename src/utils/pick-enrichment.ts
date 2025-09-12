import { Game } from '@/types/nfl'

/**
 * Utility functions for enriching pick data with team information
 */

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

/**
 * Look up team information for a specific game ID using ESPN API
 */
export async function getGameTeams(gameId: string): Promise<{
  homeTeam: {
    id: string
    name: string
    abbreviation: string
    city: string
  }
  awayTeam: {
    id: string
    name: string
    abbreviation: string
    city: string
  }
  date: string
  status: string
} | null> {
  try {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.header) {
      return null
    }

    const competition = data.header.competitions?.[0] || {}
    const competitors = competition.competitors || []
    const home = competitors.find((c: any) => c.homeAway === 'home') || { team: {} }
    const away = competitors.find((c: any) => c.homeAway === 'away') || { team: {} }
    
    const homeTeam = home.team || {}
    const awayTeam = away.team || {}

    return {
      homeTeam: {
        id: homeTeam.id || '',
        name: homeTeam.name || '',
        abbreviation: homeTeam.abbreviation || '',
        city: homeTeam.location || '',
      },
      awayTeam: {
        id: awayTeam.id || '',
        name: awayTeam.name || '',
        abbreviation: awayTeam.abbreviation || '',
        city: awayTeam.location || '',
      },
      date: data.header.competitions?.[0]?.date || '',
      status: data.header.competitions?.[0]?.status?.type?.name || 'unknown'
    }
    
  } catch (error) {
    console.error(`Error looking up game ${gameId}:`, error)
    return null
  }
}

/**
 * Create enriched pick data with team information
 * This should be used when saving new picks to include team details
 */
export async function createEnrichedPick(
  gameId: string, 
  pickedTeam: 'home' | 'away', 
  pickedAt: any
): Promise<{
  pickedTeam: 'home' | 'away'
  pickedAt: any
  homeTeam?: any
  awayTeam?: any
  gameDate?: string
  gameStatus?: string
}> {
  const basePick = {
    pickedTeam,
    pickedAt
  }

  try {
    const gameTeams = await getGameTeams(gameId)
    
    if (gameTeams) {
      return {
        ...basePick,
        homeTeam: gameTeams.homeTeam,
        awayTeam: gameTeams.awayTeam,
        gameDate: gameTeams.date,
        gameStatus: gameTeams.status
      }
    }
  } catch (error) {
    console.error(`Failed to enrich pick for game ${gameId}:`, error)
  }

  // Return base pick if enrichment fails
  return basePick
}

/**
 * Get team information from a game object (if available)
 * This is a fallback when you already have the full game data
 */
export function getTeamsFromGame(game: Game): {
  homeTeam: {
    id: string
    name: string
    abbreviation: string
    city: string
  }
  awayTeam: {
    id: string
    name: string
    abbreviation: string
    city: string
  }
} | null {
  if (!game.homeTeam || !game.awayTeam) {
    return null
  }

  return {
    homeTeam: {
      id: game.homeTeam.id,
      name: game.homeTeam.name,
      abbreviation: game.homeTeam.abbreviation,
      city: game.homeTeam.city,
    },
    awayTeam: {
      id: game.awayTeam.id,
      name: game.awayTeam.name,
      abbreviation: game.awayTeam.abbreviation,
      city: game.awayTeam.city,
    }
  }
}

/**
 * Create enriched pick data from existing game data
 * This is more efficient than making an API call when you already have the game
 */
export function createEnrichedPickFromGame(
  game: Game,
  pickedTeam: 'home' | 'away',
  pickedAt: any
): {
  pickedTeam: 'home' | 'away'
  pickedAt: any
  homeTeam: any
  awayTeam: any
  gameDate: string
  gameStatus: string
} {
  const teams = getTeamsFromGame(game)
  
  return {
    pickedTeam,
    pickedAt,
    homeTeam: teams?.homeTeam || game.homeTeam,
    awayTeam: teams?.awayTeam || game.awayTeam,
    gameDate: game.date,
    gameStatus: game.status
  }
}

/**
 * Format team matchup for display
 */
export function formatTeamMatchup(pickData: any): string {
  if (pickData.homeTeam && pickData.awayTeam) {
    return `${pickData.awayTeam.abbreviation} @ ${pickData.homeTeam.abbreviation}`
  }
  return 'Unknown matchup'
}

/**
 * Get the picked team name from enriched pick data
 */
export function getPickedTeamName(pickData: any): string {
  if (!pickData.homeTeam || !pickData.awayTeam) {
    return pickData.pickedTeam || 'Unknown'
  }
  
  if (pickData.pickedTeam === 'home') {
    return pickData.homeTeam.abbreviation || pickData.homeTeam.name || 'Home'
  } else {
    return pickData.awayTeam.abbreviation || pickData.awayTeam.name || 'Away'
  }
}
