import { Game, Team } from '@/types/nfl'
import { format as formatDate } from 'date-fns'
import { getFavoriteTeam } from '@/utils/team-utils'
import { normalizeRoundName } from '@/utils/date-helpers'

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

// Helper function to determine favorite based on betting odds
function getFavoriteFromOdds(odds: any[]): 'home' | 'away' | null {
  if (!odds || odds.length === 0) return null
  
  const firstOdds = odds[0]
  if (firstOdds.homeTeamOdds?.favorite === true) {
    return 'home'
  } else if (firstOdds.awayTeamOdds?.favorite === true) {
    return 'away'
  }
  
  return null
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
  // Get current NFL week from ESPN API schedule
  async getCurrentNFLWeek(): Promise<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string } | { offSeason: true } | null> {
    try {
      const today = new Date()
      const dateStr = formatDate(today, 'yyyyMMdd')
      const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${dateStr}`)
      const data = await response.json()
      
      if (data.leagues && data.leagues.length > 0) {
        const league = data.leagues[0]
        const season = league.season?.year || new Date().getFullYear()

        // Season conclusion: ESPN exposes league.season.endDate. If we're past it, treat as off-season immediately.
        const seasonEndDate = league.season?.endDate ? new Date(league.season.endDate) : null
        if (seasonEndDate && today > seasonEndDate) {
          console.log('📅 ESPN API: Season over (past league.season.endDate) — treating as off-season')
          return null
        }
        
        // Find current week from calendar; if we're in Pro Bowl, skip to the next week (postseason continues)
        if (league.calendar && league.calendar.length > 0) {
          type CalendarEntry = { startDate: Date; endDate: Date; value: string; label?: string; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl' }
          const allEntries: CalendarEntry[] = []
          for (const seasonType of league.calendar) {
            // Skip Off Season block (value "4" / label "Off Season") — we never treat it as a "current week"
            if (seasonType.label === 'Off Season' || seasonType.value === '4') continue
            if (seasonType.entries) {
              for (const entry of seasonType.entries) {
                let weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl' = 'regular'
                if (seasonType.label === 'Preseason') weekType = 'preseason'
                else if (seasonType.label === 'Postseason') weekType = 'postseason'
                else if (seasonType.label?.toLowerCase().includes('pro bowl')) weekType = 'pro-bowl'
                allEntries.push({
                  startDate: new Date(entry.startDate),
                  endDate: new Date(entry.endDate),
                  value: entry.value,
                  label: entry.label,
                  weekType
                })
              }
            }
          }
          allEntries.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
          const nowUTC = new Date(today.toISOString())
          const currentIndex = allEntries.findIndex(e => nowUTC >= e.startDate && nowUTC <= e.endDate)
          if (currentIndex >= 0) {
            const entry = allEntries[currentIndex]
            // Week turns over on Wednesday. If we're in the last calendar entry (season over) and it's Wednesday, treat as off-season so dashboard/stats redirect.
            const isWednesday = today.getDay() === 3
            const isLastEntry = currentIndex === allEntries.length - 1
            if (isWednesday && isLastEntry) {
              console.log('📅 ESPN API: Wednesday and in last season week — treating as off-season')
              return { offSeason: true as const }
            }
            // If we're in Pro Bowl week, use the next calendar week (e.g. Super Bowl) so we don't redirect to off-season
            const useEntry = entry.weekType === 'pro-bowl' && currentIndex + 1 < allEntries.length
              ? allEntries[currentIndex + 1]
              : entry
            if (entry.weekType === 'pro-bowl' && useEntry !== entry) {
              console.log(`📅 ESPN API: In Pro Bowl week; using next week as current: ${useEntry.value} (${useEntry.weekType})`)
            } else {
              console.log(`📅 ESPN API: Found current week ${useEntry.value} (${useEntry.weekType}) - ${useEntry.startDate.toISOString()} to ${useEntry.endDate.toISOString()}`)
            }
            const weekNumber = parseInt(useEntry.value)
            const normalizedLabel = useEntry.label ? normalizeRoundName(useEntry.label) : undefined
            return { week: weekNumber, season, weekType: useEntry.weekType, startDate: useEntry.startDate, endDate: useEntry.endDate, label: normalizedLabel }
          }
        }
      }
      
      console.log('📅 ESPN API: No current week found')
      return null
    } catch (error) {
      console.error('Error fetching current NFL week:', error)
      return null
    }
  },

  // Get today's games
  async getTodaysGames(): Promise<Game[]> {
    try {
      const response = await fetchWithRetry(`${ESPN_BASE_URL}/scoreboard`)
      const data = await response.json()
      
      // Fetch team records to enrich game data
      let teamRecords: Record<string, { wins: number, losses: number, ties: number }> = {}
      try {
        const teams = await this.getTeams()
        teamRecords = teams.reduce((acc, team) => {
          if (team.abbreviation && team.wins !== undefined && team.losses !== undefined) {
            acc[team.abbreviation] = {
              wins: team.wins,
              losses: team.losses,
              ties: team.ties || 0
            }
          }
          return acc
        }, {} as Record<string, { wins: number, losses: number, ties: number }>)
      } catch (error) {
        console.warn('Failed to fetch team records for today\'s games, favorites may default to home:', error)
      }
      
      return data.events?.map((event: any) => {
        const competition = event.competitions?.[0] || {}
        const home = competition.competitors?.find((c: any) => c.homeAway === 'home') || { team: {} }
        const away = competition.competitors?.find((c: any) => c.homeAway === 'away') || { team: {} }
        const homeTeam = home.team || {}
        const awayTeam = away.team || {}
        const status = event.status || {}
        
        // Enrich team data with records
        const homeTeamRecord = teamRecords[homeTeam.abbreviation] || {}
        const awayTeamRecord = teamRecords[awayTeam.abbreviation] || {}
        
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
          alternateColor: homeTeam.alternateColor || '',
          wins: homeTeamRecord.wins,
          losses: homeTeamRecord.losses,
          ties: homeTeamRecord.ties
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
          alternateColor: awayTeam.alternateColor || '',
          wins: awayTeamRecord.wins,
          losses: awayTeamRecord.losses,
          ties: awayTeamRecord.ties
        }
        
        // Use betting odds to determine favorite, fallback to win-loss records
        const bettingFavorite = getFavoriteFromOdds(competition.odds)
        const favoriteTeam = bettingFavorite || getFavoriteTeam(homeTeamData, awayTeamData)
        
        // Debug logging for favorites
        if (homeTeamData.abbreviation === 'SEA' || awayTeamData.abbreviation === 'SEA' || 
            homeTeamData.abbreviation === 'CHI' || awayTeamData.abbreviation === 'CHI') {
          console.log(`🏈 Today's Game ${homeTeamData.abbreviation} vs ${awayTeamData.abbreviation}:`, {
            bettingFavorite,
            homeRecord: `${homeTeamData.wins}-${homeTeamData.losses}-${homeTeamData.ties}`,
            awayRecord: `${awayTeamData.wins}-${awayTeamData.losses}-${awayTeamData.ties}`,
            favoriteTeam,
            odds: competition.odds
          })
        }
        
        return {
          id: String(event.id ?? ''),
          date: event.date,
          homeTeam: homeTeamData,
          awayTeam: awayTeamData,
          homeScore: parseInt(home.score) || 0,
          awayScore: parseInt(away.score) || 0,
          status: status.type?.state === 'in' ? 'live' : status.type?.state === 'pre' ? 'scheduled' : status.type?.state || 'unknown',
          quarter: status.period || 0,
          venue: competition.venue?.fullName || '',
          startTime: event.date,
          favoriteTeam: favoriteTeam
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

    // Use betting odds to determine favorite, fallback to win-loss records
    const bettingFavorite = getFavoriteFromOdds(competition.odds)
    const favoriteTeam = bettingFavorite || getFavoriteTeam(homeTeamData, awayTeamData)

    return {
      id: data.header.id || '',
      date: data.header.date || '',
      homeTeam: homeTeamData,
      awayTeam: awayTeamData,
      homeScore: parseInt(home.score) || 0,
      awayScore: parseInt(away.score) || 0,
      status: status.type?.state === 'in' ? 'live' : status.type?.state === 'pre' ? 'scheduled' : status.type?.state || 'unknown',
      quarter: status.period || 0,
      venue: competition.venue?.fullName || '',
      startTime: data.header.date || '',
      favoriteTeam: favoriteTeam
    }
  },

  // NEW: Get live game details with current situation and plays
  async getLiveGameDetails(gameId: string): Promise<LiveGameDetails | null> {
    const response = await fetch(`${ESPN_BASE_URL}/summary?event=${gameId}`)
    const data = await response.json()
    
    if (!data.header) return null
    
    // Debug: Log the raw ESPN API response to understand the data structure
    console.log('🔍 ESPN API Raw Response for gameId', gameId, ':', {
      hasSituation: !!data.situation,
      situation: data.situation,
      status: data.header?.competitions?.[0]?.status,
      gameStatus: data.header?.status,
      // Let's see what other data is available
      hasPlays: !!data.plays,
      playsCount: data.plays?.length || 0,
      lastPlay: data.plays?.[data.plays.length - 1],
      // Check for alternative situation data sources
      competition: data.header?.competitions?.[0],
      // Look for any time/clock data
      clock: data.header?.competitions?.[0]?.status?.clock,
      period: data.header?.competitions?.[0]?.status?.period
    })
    
    const baseGame = await this.getGameDetails(gameId)
    if (!baseGame) return null
    
    // Inning info from status (again, for propagation)
    const competition = data.header.competitions?.[0] || {}
    const status = competition.status || {}
    const inning = status.period || 0
    const topInning = status.periodPrefix ? (status.periodPrefix.toLowerCase().startsWith('top') ? true : status.periodPrefix.toLowerCase().startsWith('bot') ? false : undefined) : undefined

    // Extract live situation data for NFL
    let situation: LiveGameSituation | undefined = undefined
    
    if (data.situation) {
      // Primary source: data.situation
      situation = {
        down: data.situation.down || 1,
        distance: data.situation.distance || 10,
        fieldPosition: data.situation.possessionText || data.situation.yardLine || '',
        quarter: data.situation.period || status.period || 1,
        timeRemaining: data.situation.clock ? `${Math.floor(data.situation.clock / 60)}:${(data.situation.clock % 60).toString().padStart(2, '0')}` : '',
        lastPlay: data.situation.lastPlay ? {
          id: data.situation.lastPlay.id,
          text: data.situation.lastPlay.text
        } : undefined
      }
    } else {
      // Fallback: Try to extract from other parts of the response
      console.log('🔍 No data.situation found, checking for alternative sources...')
      
      // Check if there's situation data in the plays or other sections
      const lastPlay = data.plays && data.plays.length > 0 ? data.plays[data.plays.length - 1] : null
      
      // Try to get time from status.clock or status.displayClock
      const clock = status.clock || status.displayClock
      let timeRemaining = ''
      if (clock && typeof clock === 'number') {
        timeRemaining = `${Math.floor(clock / 60)}:${(clock % 60).toString().padStart(2, '0')}`
      } else if (clock && typeof clock === 'string') {
        timeRemaining = clock
      }
      
      if (lastPlay && (lastPlay.down || lastPlay.distance || lastPlay.fieldPosition)) {
        console.log('🔍 Found situation data in last play:', lastPlay)
        situation = {
          down: lastPlay.down || 1,
          distance: lastPlay.distance || 10,
          fieldPosition: lastPlay.fieldPosition || '',
          quarter: status.period || 1,
          timeRemaining: timeRemaining,
          lastPlay: {
            id: lastPlay.id || '',
            text: lastPlay.text || ''
          }
        }
      } else if (timeRemaining) {
        // Even if we don't have down/distance, we might have time
        console.log('🔍 Found time data in status:', { clock, timeRemaining })
        situation = {
          down: 1,
          distance: 10,
          fieldPosition: '',
          quarter: status.period || 1,
          timeRemaining: timeRemaining,
          lastPlay: undefined
        }
      } else {
        console.log('🔍 No alternative situation data found in:', {
          lastPlay: lastPlay ? 'exists' : 'none',
          clock: clock,
          status: status
        })
      }
    }

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
      // Override status to use the same logic as other functions
      status: status.type?.state === 'in' ? 'live' : status.type?.state === 'pre' ? 'scheduled' : status.type?.state || 'unknown',
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

  // Get week information for a specific week and season (optionally filter by weekType so we get Regular week 1, not Preseason week 1)
  async getWeekInfo(season: number, week: number, filterWeekType?: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'): Promise<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string } | null> {
    try {
      // Get the schedule for the season to find the specific week
      const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${season}0901`) // September 1st of the season
      const data = await response.json()
      
      if (data.leagues && data.leagues.length > 0) {
        const league = data.leagues[0]
        
        // Find the specific week from calendar (match week number and optionally weekType)
        if (league.calendar && league.calendar.length > 0) {
          for (const seasonType of league.calendar) {
            if (seasonType.entries) {
              for (const entry of seasonType.entries) {
                const weekNumber = parseInt(entry.value)
                if (weekNumber !== week) continue

                let weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl' = 'regular'
                if (seasonType.label === 'Preseason') {
                  weekType = 'preseason'
                } else if (seasonType.label === 'Postseason') {
                  weekType = 'postseason'
                } else if (seasonType.label?.toLowerCase().includes('pro bowl')) {
                  weekType = 'pro-bowl'
                }

                if (filterWeekType != null && weekType !== filterWeekType) continue

                const startDate = new Date(entry.startDate)
                const endDate = new Date(entry.endDate)
                console.log(`📅 ESPN API: Found week ${weekNumber} (${weekType}) for season ${season} - ${startDate.toISOString()} to ${endDate.toISOString()}`)
                const normalizedLabel = entry.label ? normalizeRoundName(entry.label) : undefined
                return { week: weekNumber, season, weekType, startDate, endDate, label: normalizedLabel }
              }
            }
          }
        }
      }
      
      console.log(`📅 ESPN API: No week ${week} found for season ${season}`)
      return null
    } catch (error) {
      console.error(`Error fetching week ${week} for season ${season}:`, error)
      return null
    }
  },

  // Get all available weeks for a season (excluding preseason and pro bowl)
  async getAllAvailableWeeks(season: number): Promise<Array<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string }>> {
    try {
      // Get the schedule for the season
      const response = await fetch(`${ESPN_BASE_URL}/scoreboard?dates=${season}0901`) // September 1st of the season
      const data = await response.json()
      
      const weeks: Array<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string }> = []
      
      if (data.leagues && data.leagues.length > 0) {
        const league = data.leagues[0]
        
        // Find all weeks from calendar
        if (league.calendar && league.calendar.length > 0) {
          for (const seasonType of league.calendar) {
            if (seasonType.entries) {
              for (const entry of seasonType.entries) {
                let weekNumber = parseInt(entry.value, 10)
                // ESPN API can occasionally return a negative value (e.g. -17), which would produce "week--17" in getWeekKey
                if (weekNumber < 0) {
                  weekNumber = Math.abs(weekNumber)
                }
                const startDate = new Date(entry.startDate)
                const endDate = new Date(entry.endDate)
                let weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl' = 'regular'
                
                if (seasonType.label === 'Preseason') {
                  weekType = 'preseason'
                } else if (seasonType.label === 'Postseason') {
                  weekType = 'postseason'
                } else if (seasonType.label?.toLowerCase().includes('pro bowl')) {
                  weekType = 'pro-bowl'
                }
                // Also treat as pro-bowl if entry label says so (ESPN may list Pro Bowl under Postseason)
                const entryLabelProBowl = entry.label?.toLowerCase().includes('pro bowl') ?? false
                if (entryLabelProBowl) weekType = 'pro-bowl'

                // Skip preseason and pro bowl weeks (inconsequential for team records / stats)
                if (weekType !== 'preseason' && weekType !== 'pro-bowl') {
                  // NFL regular season is 18 weeks only (272 games). ESPN may expose a 19th entry; exclude it.
                  if (weekType === 'regular' && (weekNumber < 1 || weekNumber > 18)) continue
                  // Normalize the label for consistent naming
                  const normalizedLabel = entry.label ? normalizeRoundName(entry.label) : undefined
                  weeks.push({ 
                    week: weekNumber, 
                    season, 
                    weekType, 
                    startDate, 
                    endDate, 
                    label: normalizedLabel 
                  })
                }
              }
            }
          }
        }
      }
      
      // Sort by start date (oldest first)
      weeks.sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
      
      console.log(`📅 ESPN API: Found ${weeks.length} available weeks (excluding preseason and pro bowl) for season ${season}`)
      return weeks
    } catch (error) {
      console.error(`Error fetching all weeks for season ${season}:`, error)
      return []
    }
  },

  // Get games for a date range (week)
  async getGamesForDateRange(startDate: Date, endDate: Date): Promise<Game[]> {
    const games: Game[] = [];
    let current = new Date(startDate);
    
    // Fetch team records once to enrich game data
    let teamRecords: Record<string, { wins: number, losses: number, ties: number }> = {}
    try {
      const teams = await this.getTeams()
      teamRecords = teams.reduce((acc, team) => {
        if (team.abbreviation && team.wins !== undefined && team.losses !== undefined) {
          acc[team.abbreviation] = {
            wins: team.wins,
            losses: team.losses,
            ties: team.ties || 0
          }
        }
        return acc
      }, {} as Record<string, { wins: number, losses: number, ties: number }>)
    } catch (error) {
      console.warn('Failed to fetch team records for games, favorites may default to home:', error)
    }
    
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
          
          // Enrich team data with records
          const homeTeamRecord = teamRecords[homeTeam.abbreviation] || {}
          const awayTeamRecord = teamRecords[awayTeam.abbreviation] || {}
          
          const homeTeamData = {
            id: homeTeam.id || '',
            name: homeTeam.name || '',
            abbreviation: homeTeam.abbreviation || '',
            city: homeTeam.location || '',
            division: '',
            conference: '',
            logo: homeTeam.logos?.[0]?.href || '',
            color: homeTeam.color || '',
            alternateColor: homeTeam.alternateColor || '',
            wins: homeTeamRecord.wins,
            losses: homeTeamRecord.losses,
            ties: homeTeamRecord.ties
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
            alternateColor: awayTeam.alternateColor || '',
            wins: awayTeamRecord.wins,
            losses: awayTeamRecord.losses,
            ties: awayTeamRecord.ties
          }
          
          // Use betting odds to determine favorite, fallback to win-loss records
          const bettingFavorite = getFavoriteFromOdds(competition.odds)
          const favoriteTeam = bettingFavorite || getFavoriteTeam(homeTeamData, awayTeamData)
          
          // Debug logging for favorites
          if (homeTeamData.abbreviation === 'SEA' || awayTeamData.abbreviation === 'SEA' || 
              homeTeamData.abbreviation === 'CHI' || awayTeamData.abbreviation === 'CHI') {
            console.log(`🏈 Game ${homeTeamData.abbreviation} vs ${awayTeamData.abbreviation}:`, {
              bettingFavorite,
              homeRecord: `${homeTeamData.wins}-${homeTeamData.losses}-${homeTeamData.ties}`,
              awayRecord: `${awayTeamData.wins}-${awayTeamData.losses}-${awayTeamData.ties}`,
              favoriteTeam,
              odds: competition.odds
            })
          }
          
          return {
            id: String(event.id ?? ''),
            date: event.date,
            homeTeam: homeTeamData,
            awayTeam: awayTeamData,
            homeScore: parseInt(home.score) || 0,
            awayScore: parseInt(away.score) || 0,
            status: status.type?.state === 'in' ? 'live' : status.type?.state === 'pre' ? 'scheduled' : status.type?.state || 'unknown',
            quarter: status.period || 0,
            venue: competition.venue?.fullName || '',
            startTime: event.date,
            favoriteTeam: favoriteTeam
          }
        }));
      }
      current.setDate(current.getDate() + 1);
    }
    // Deduplicate by game id (same game can appear on multiple days in the range)
    const seen = new Set<string>()
    return games.filter((g) => {
      const id = String(g?.id ?? '')
      if (seen.has(id)) return false
      seen.add(id)
      return true
    })
  }
} 