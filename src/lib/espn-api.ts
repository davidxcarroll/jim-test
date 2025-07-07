import { Game, Team } from '@/types/mlb'
import { format as formatDate } from 'date-fns'

const ESPN_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/baseball/mlb'

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
  balls: number
  strikes: number
  outs: number
  pitcher?: {
    playerId: string
    name?: string
    summary?: string
  }
  batter?: {
    playerId: string
    name?: string
    summary?: string
  }
  onFirst?: boolean
  onSecond?: boolean
  onThird?: boolean
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
  atBatId?: string
  pitchCount?: {
    balls: number
    strikes: number
  }
  resultCount?: {
    balls: number
    strikes: number
  }
  outs: number
}

export interface LiveGameDetails extends Game {
  situation?: LiveGameSituation
  plays?: Play[]
  lastUpdated?: string
}

export const espnApi = {
  // Get today's games
  async getTodaysGames(): Promise<Game[]> {
    const response = await fetch(`${ESPN_BASE_URL}/scoreboard`)
    const data = await response.json()
    
    return data.events?.map((event: any) => ({
      id: event.id,
      date: event.date,
      homeTeam: {
        id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.id,
        name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.name,
        abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.abbreviation,
        city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.location,
        division: '',
        league: '',
                                logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos?.[0]?.href || '',
            logos: extractLogoVariations(event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos || []),
        color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.color || '',
        alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.alternateColor || ''
      },
      awayTeam: {
        id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.id,
        name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.name,
        abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.abbreviation,
        city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.location,
        division: '',
        league: '',
                                logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos?.[0]?.href || '',
            logos: extractLogoVariations(event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos || []),
        color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.color || '',
        alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.alternateColor || ''
      },
      homeScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
      awayScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
      status: event.status.type.state === 'in' ? 'live' : event.status.type.state === 'pre' ? 'scheduled' : event.status.type.state,
      venue: event.competitions[0].venue?.fullName,
      startTime: event.date
    })) || []
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

    return {
      id: data.header.id || '',
      date: data.header.date || '',
      homeTeam: {
        id: homeTeam.id || '',
        name: homeTeam.name || '',
        abbreviation: homeTeam.abbreviation || '',
        city: homeTeam.location || '',
        division: '',
        league: '',
        logo: homeTeam.logos?.[0]?.href || '',
        logos: extractLogoVariations(homeTeam.logos || []),
        color: homeTeam.color || '',
        alternateColor: homeTeam.alternateColor || ''
      },
      awayTeam: {
        id: awayTeam.id || '',
        name: awayTeam.name || '',
        abbreviation: awayTeam.abbreviation || '',
        city: awayTeam.location || '',
        division: '',
        league: '',
        logo: awayTeam.logos?.[0]?.href || '',
        logos: extractLogoVariations(awayTeam.logos || []),
        color: awayTeam.color || '',
        alternateColor: awayTeam.alternateColor || ''
      },
      homeScore: home.score || 0,
      awayScore: away.score || 0,
      status: data.header.status?.type?.state
        ? data.header.status.type.state
        : 'unknown',
      inning,
      topInning,
      venue: competition.venue?.fullName || '',
      startTime: data.header.date || ''
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

    // Extract live situation data
    const situation: LiveGameSituation | undefined = data.situation ? {
      balls: data.situation.balls || 0,
      strikes: data.situation.strikes || 0,
      outs: data.situation.outs || 0,
      pitcher: data.situation.pitcher ? {
        playerId: data.situation.pitcher.playerId,
        name: data.situation.pitcher.athlete?.displayName,
        summary: data.situation.pitcher.summary
      } : undefined,
      batter: data.situation.batter ? {
        playerId: data.situation.batter.playerId,
        name: data.situation.batter.athlete?.displayName,
        summary: data.situation.batter.summary
      } : undefined,
      onFirst: data.situation.onFirst || false,
      onSecond: data.situation.onSecond || false,
      onThird: data.situation.onThird || false,
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
      inning,
      topInning,
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
      balls: data.situation.balls || 0,
      strikes: data.situation.strikes || 0,
      outs: data.situation.outs || 0,
      pitcher: data.situation.pitcher ? {
        playerId: data.situation.pitcher.playerId,
        name: data.situation.pitcher.athlete?.displayName,
        summary: data.situation.pitcher.summary
      } : undefined,
      batter: data.situation.batter ? {
        playerId: data.situation.batter.playerId,
        name: data.situation.batter.athlete?.displayName,
        summary: data.situation.batter.summary
      } : undefined,
      onFirst: data.situation.onFirst || false,
      onSecond: data.situation.onSecond || false,
      onThird: data.situation.onThird || false,
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
    const response = await fetch(`${ESPN_BASE_URL}/teams`)
    const data = await response.json()
    if (data.sports && data.sports[0] && data.sports[0].leagues && data.sports[0].leagues[0] && data.sports[0].leagues[0].teams) {
      // Print the raw ESPN team.team object for debugging
      console.log('Raw ESPN team.team object:', JSON.stringify(data.sports[0].leagues[0].teams[0].team, null, 2));
    }
    return data.sports[0].leagues[0].teams.map((team: any) => ({
      id: team.team.id,
      name: team.team.name,
      abbreviation: team.team.abbreviation,
      city: team.team.location,
      division: team.team.division?.name || '',
      league: team.team.league?.name || '',
      logo: team.team.logos?.[0]?.href || '',
      logos: extractLogoVariations(team.team.logos || []),
      color: team.team.color || '',
      alternateColor: team.team.alternateColor || '',
      wins: team.team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'wins')?.value || team.team.record?.items?.[0]?.summary?.split('-')[0] || undefined,
      losses: team.team.record?.items?.[0]?.stats?.find((s: any) => s.name === 'losses')?.value || team.team.record?.items?.[0]?.summary?.split('-')[1] || undefined,
    }))
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
        games.push(...data.events.map((event: any) => ({
          id: event.id,
          date: event.date,
          homeTeam: {
            id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.id,
            name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.name,
            abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.abbreviation,
            city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.location,
            division: '',
            league: '',
            logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.logos?.[0]?.href || '',
            color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.color || '',
            alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').team.alternateColor || ''
          },
          awayTeam: {
            id: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.id,
            name: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.name,
            abbreviation: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.abbreviation,
            city: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.location,
            division: '',
            league: '',
            logo: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.logos?.[0]?.href || '',
            color: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.color || '',
            alternateColor: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').team.alternateColor || ''
          },
          homeScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'home').score,
          awayScore: event.competitions[0].competitors.find((c: any) => c.homeAway === 'away').score,
          status: event.status.type.state === 'in' ? 'live' : event.status.type.state === 'pre' ? 'scheduled' : event.status.type.state,
          venue: event.competitions[0].venue?.fullName,
          startTime: event.date
        })));
      }
      current.setDate(current.getDate() + 1);
    }
    return games;
  }
} 