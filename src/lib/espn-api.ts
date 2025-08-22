import { Game, Team } from '@/types/nfl'
import { format as formatDate } from 'date-fns'
import { getFavoriteTeam } from '@/utils/team-utils'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl'

// Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 5000,  // 5 seconds
}

/**
 * Fetch with retry logic
 */
async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      return response;
    } catch (error: any) {
      lastError = error;
      
      if (attempt === RETRY_CONFIG.maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(2, attempt),
        RETRY_CONFIG.maxDelay
      );
      
      console.warn(`ESPN API attempt ${attempt + 1} failed, retrying in ${delay}ms:`, error.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Request failed after all retries');
}

// Helper function to extract logo variations from ESPN API response
function extractLogoVariations(logos: any[]): { default?: string; dark?: string; scoreboard?: string; darkScoreboard?: string } {
  const variations: { default?: string; dark?: string; scoreboard?: string; darkScoreboard?: string } = {}
  
  logos.forEach(logo => {
    const href = logo.href || ''
    const rel = logo.rel || []
    
    if (rel.includes('default')) {
      variations.default = href
    }
    if (rel.includes('dark') && rel.includes('scoreboard')) {
      variations.darkScoreboard = href
    } else if (rel.includes('dark')) {
      variations.dark = href
    } else if (rel.includes('scoreboard')) {
      variations.scoreboard = href
    }
  })
  
  return variations
}

// New interfaces for live data
export interface LiveGameSituation {
  down: number
  distance: number
  fieldPosition: string
  quarter: number
  timeRemaining: string
  lastPlay?: {
    id: string
    text?: string
  }
}

export interface Play {
  id: string
  sequenceNumber: string
  type: {
    id: string
    text: string
    type: string
  }
  text: string
  awayScore: number
  homeScore: number
  period: {
    type: string
    number: number
    displayValue: string
  }
  scoringPlay: boolean
  wallclock: string
  down?: number
  distance?: number
  fieldPosition?: string
}

export interface LiveGameDetails extends Game {
  situation?: LiveGameSituation
  plays?: Play[]
  lastUpdated?: string
}

export const espnApi = {
  // Get today's games
  async getTodaysGames(): Promise<Game[]> {
    try {
      const response = await fetchWithRetry(`${ESPN_BASE_URL}/scoreboard`)
      const data = await response.json()
      
      return data.events?.map((event: any) => {
        const competition = event.competitions?.[0] || {}
        const home = competition.competitors?.find((c: any) => c.homeAway === 'home') || { team: {} }
        const away = competition.competitors?.find((c: any) => c.homeAway === 'away') || { team: {} }
        const homeTeam = home.team || {}
        const awayTeam = away.team || {}
        const status = event.status || {}
        
        const homeTeamData = {
          id: homeTeam.id || '',
          name: homeTeam.name || '',
          abbreviation: homeTeam.abbreviation || '',
          city: homeTeam.location || '',
          division: '',
          conference: '',
          logo: homeTeam.logos?.[0]?.href || '',
          logos: extractLogoVariations(homeTeam.logos || []),
          color: homeTeam.color || '',
          alternateColor: homeTeam.alternateColor || ''
        }
        
        const awayTeamData = {
          id: awayTeam.id || '',
          name: awayTeam.name || '',
          abbreviation: awayTeam.abbreviation || '',
          city: awayTeam.location || '',
          division: '',
          conference: '',
          logo: awayTeam.logos?.[0]?.href || '',
          logos: extractLogoVariations(awayTeam.logos || []),
          color: awayTeam.color || '',
          alternateColor: awayTeam.alternateColor || ''
        }
        
        return {
          id: event.id,
          date: event.date,
          homeTeam: homeTeamData,
          awayTeam: awayTeamData,
          homeScore: home.score || 0,
          awayScore: away.score || 0,
          status: status.type?.state === 'in' ? 'live' : status.type?.state === 'pre' ? 'scheduled' : status.type?.state || 'unknown',
          quarter: status.period || 0,
          venue: competition.venue?.fullName || '',
          startTime: event.date,
          favoriteTeam: getFavoriteTeam(homeTeamData, awayTeamData)
        }
      }) || []
    } catch (error) {
      console.error('Error fetching today\'s games:', error)
      return []
    }
  },

  // Get specific game details
  async getGameDetails(gameId: string): Promise<Game | null> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.header) return null

    // Defensive: competitions and competitors
    const competition = data.header.competitions?.[0] || {}
    const competitors = competition.competitors || []
    const home = competitors.find((c: any) => c.homeAway === 'home') || { team: {} }
    const away = competitors.find((c: any) => c.homeAway === 'away') || { team: {} }
    const homeTeam = home.team || {}
    const awayTeam = away.team || {}

    // Inning info from status
    const status = competition.status || {}
    const inning = status.period || 0
    const topInning = status.periodPrefix ? (status.periodPrefix.toLowerCase().startsWith('top') ? true : status.periodPrefix.toLowerCase().startsWith('bot') ? false : undefined) : undefined
    // Optionally, displayPeriod (e.g. "3rd") and detail (e.g. "Top 3rd")

    const homeTeamData = {
      id: homeTeam.id || '',
      name: homeTeam.name || '',
      abbreviation: homeTeam.abbreviation || '',
      city: homeTeam.location || '',
      division: '',
      conference: '',
      logo: homeTeam.logos?.[0]?.href || '',
      logos: extractLogoVariations(homeTeam.logos || []),
      color: homeTeam.color || '',
      alternateColor: homeTeam.alternateColor || ''
    }

    const awayTeamData = {
      id: awayTeam.id || '',
      name: awayTeam.name || '',
      abbreviation: awayTeam.abbreviation || '',
      city: awayTeam.location || '',
      division: '',
      conference: '',
      logo: awayTeam.logos?.[0]?.href || '',
      logos: extractLogoVariations(awayTeam.logos || []),
      color: awayTeam.color || '',
      alternateColor: awayTeam.alternateColor || ''
    }

    return {
      id: data.header.id || '',
      date: data.header.date || '',
      homeTeam: homeTeamData,
      awayTeam: awayTeamData,
      homeScore: home.score || 0,
      awayScore: away.score || 0,
      status: data.header.status?.type?.state
        ? data.header.status.type.state
        : 'unknown',
      quarter: status.period || 0,
      venue: competition.venue?.fullName || '',
      startTime: data.header.date || '',
      favoriteTeam: getFavoriteTeam(homeTeamData, awayTeamData)
    }
  },

  // NEW: Get live game details with current situation and plays
  async getLiveGameDetails(gameId: string): Promise<LiveGameDetails | null> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.header) return null
    
    const baseGame = await this.getGameDetails(gameId)
    if (!baseGame) return null
    
    // Inning info from status (again, for propagation)
    const competition = data.header.competitions?.[0] || {}
    const status = competition.status || {}
    const inning = status.period || 0
    const topInning = status.periodPrefix ? (status.periodPrefix.toLowerCase().startsWith('top') ? true : status.periodPrefix.toLowerCase().startsWith('bot') ? false : undefined) : undefined

    // Extract live situation data for NFL
    const situation: LiveGameSituation | undefined = data.situation ? {
      down: data.situation.down || 1,
      distance: data.situation.distance || 10,
      fieldPosition: data.situation.possessionText || data.situation.yardLine || '',
      quarter: data.situation.period || status.period || 1,
      timeRemaining: data.situation.clock ? `${Math.floor(data.situation.clock / 60)}:${(data.situation.clock % 60).toString().padStart(2, '0')}` : '',
      lastPlay: data.situation.lastPlay ? {
        id: data.situation.lastPlay.id,
        text: data.situation.lastPlay.text
      } : undefined
    } : undefined

    // Extract recent plays (last 10 plays for live updates)
    const plays: Play[] = data.plays ? data.plays.slice(-10).map((play: any) => ({
      id: play.id || '',
      sequenceNumber: play.sequenceNumber || '',
      type: {
        id: play.type?.id || '',
        text: play.type?.text || '',
        type: play.type?.type || ''
      },
      text: play.text || '',
      awayScore: play.awayScore || 0,
      homeScore: play.homeScore || 0,
      period: {
        type: play.period?.type || '',
        number: play.period?.number || 0,
        displayValue: play.period?.displayValue || ''
      },
      scoringPlay: play.scoringPlay || false,
      wallclock: play.wallclock || '',
      atBatId: play.atBatId,
      pitchCount: play.pitchCount,
      resultCount: play.resultCount,
      outs: play.outs || 0
    })) : []

    return {
      ...baseGame,
      quarter: status.period || 0,
      situation,
      plays,
      lastUpdated: new Date().toISOString()
    }
  },

  // NEW: Get current game situation only (for frequent updates)
  async getGameSituation(gameId: string): Promise<LiveGameSituation | null> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.situation) return null
    
    return {
      down: data.situation.down || 1,
      distance: data.situation.distance || 10,
      fieldPosition: data.situation.possessionText || data.situation.yardLine || '',
      quarter: data.situation.period || 1,
      timeRemaining: data.situation.clock ? `${Math.floor(data.situation.clock / 60)}:${(data.situation.clock % 60).toString().padStart(2, '0')}` : '',
      lastPlay: data.situation.lastPlay ? {
        id: data.situation.lastPlay.id,
        text: data.situation.lastPlay.text
      } : undefined
    }
  },

  // NEW: Get recent plays for a game
  async getGamePlays(gameId: string, limit: number = 20): Promise<Play[]> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.plays) return []
    
    return data.plays.slice(-limit).map((play: any) => ({
      id: play.id || '',
      sequenceNumber: play.sequenceNumber || '',
      type: {
        id: play.type?.id || '',
        text: play.type?.text || '',
        type: play.type?.type || ''
      },
      text: play.text || '',
      awayScore: play.awayScore || 0,
      homeScore: play.homeScore || 0,
      period: {
        type: play.period?.type || '',
        number: play.period?.number || 0,
        displayValue: play.period?.displayValue || ''
      },
      scoringPlay: play.scoringPlay || false,
      wallclock: play.wallclock || '',
      atBatId: play.atBatId,
      pitchCount: play.pitchCount,
      resultCount: play.resultCount,
      outs: play.outs || 0
    }))
  },

  // NEW: Get all live games (games currently in progress)
  async getLiveGames(): Promise<Game[]> {
    const todaysGames = await this.getTodaysGames()
    return todaysGames.filter(game => game.status === 'live')
  },

  // Get all teams
  async getTeams(): Promise<Team[]> {
    try {
      const response = await fetchWithRetry(`${ESPN_BASE_URL}/teams`)
      const data = await response.json()
      
      if (!data.sports || !data.sports[0] || !data.sports[0].leagues || !data.sports[0].leagues[0] || !data.sports[0].leagues[0].teams) {
        throw new Error('Invalid data structure from ESPN API')
      }
      
      if (data.sports[0].leagues[0].teams.length > 0) {
        // Print the raw ESPN team.team object for debugging
        console.log('Raw ESPN team.team object:', JSON.stringify(data.sports[0].leagues[0].teams[0].team, null, 2));
      }
      
      return data.sports[0].leagues[0].teams.map((team: any) => ({
        id: team.team.id,
        name: team.team.name,
        abbreviation: team.team.abbreviation,
        city: team.team.location,
        division: team.team.division?.name || '',
        conference: team.team.conference?.name || '',
        logo: team.team.logos?.[0]?.href || '',
        logos: extractLogoVariations(team.team.logos || []),
        color: team.team.color || '',
        alternateColor: team.team.alternateColor || '',
        wins: team.team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || team.team.record?.items?.[0]?.summary?.split('-')[0] || undefined,
        losses: team.team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || team.team.record?.items?.[0]?.summary?.split('-')[1] || undefined,
        ties: team.team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'ties')?.value || 0,
      }))
    } catch (error) {
      console.error('Error fetching teams from ESPN API:', error)
      // Return empty array instead of throwing to prevent app crashes
      return []
    }
  },

  // Get games for a date range (week)
  async getGamesForDateRange(startDate: Date, endDate: Date): Promise<Game[]> {
    const games: Game[] = [];
    let current = new Date(startDate);
    
    while (current <= endDate) {
      const dateStr = formatDate(current, 'yyyyMMdd'); // YYYYMMDD
      const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${dateStr}`);
      const data = await response.json();
      if (data.events) {
        games.push(...data.events.map((event: any) => {
          const competition = event.competitions?.[0] || {}
          const home = competition.competitors?.find((c: any) => c.homeAway === 'home') || { team: {} }
          const away = competition.competitors?.find((c: any) => c.homeAway === 'away') || { team: {} }
          const homeTeam = home.team || {}
          const awayTeam = away.team || {}
          const status = event.status || {}
          
          const homeTeamData = {
            id: homeTeam.id || '',
            name: homeTeam.name || '',
            abbreviation: homeTeam.abbreviation || '',
            city: homeTeam.location || '',
            division: '',
            conference: '',
            logo: homeTeam.logos?.[0]?.href || '',
            color: homeTeam.color || '',
            alternateColor: homeTeam.alternateColor || ''
          }
          
          const awayTeamData = {
            id: awayTeam.id || '',
            name: awayTeam.name || '',
            abbreviation: awayTeam.abbreviation || '',
            city: awayTeam.location || '',
            division: '',
            conference: '',
            logo: awayTeam.logos?.[0]?.href || '',
            color: awayTeam.color || '',
            alternateColor: awayTeam.alternateColor || ''
          }
          
          return {
            id: event.id,
            date: event.date,
            homeTeam: homeTeamData,
            awayTeam: awayTeamData,
            homeScore: home.score || 0,
            awayScore: away.score || 0,
            status: status.type?.state === 'in' ? 'live' : status.type?.state === 'pre' ? 'scheduled' : status.type?.state || 'unknown',
            quarter: status.period || 0,
            venue: competition.venue?.fullName || '',
            startTime: event.date,
            favoriteTeam: getFavoriteTeam(homeTeamData, awayTeamData)
          }
        }));
      }
      current.setDate(current.getDate() + 1);
    }
    return games;
  }
} 