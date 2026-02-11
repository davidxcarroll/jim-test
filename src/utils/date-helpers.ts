import { format, parseISO, isToday, isTomorrow, isYesterday, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'

// NFL timezone (Pacific Time as default per user preference)
const NFL_TIMEZONE = 'America/Los_Angeles'

export const dateHelpers = {
  // Format game date for display
  formatGameDate(dateString: string): string {
    const date = parseISO(dateString)
    const zonedDate = utcToZonedTime(date, NFL_TIMEZONE)
    
    if (isToday(zonedDate)) {
      return `Today at ${format(zonedDate, 'h:mm a')}`
    } else if (isTomorrow(zonedDate)) {
      return `Tomorrow at ${format(zonedDate, 'h:mm a')}`
    } else if (isYesterday(zonedDate)) {
      return `Yesterday at ${format(zonedDate, 'h:mm a')}`
    } else {
      return format(zonedDate, 'MMM d, yyyy h:mm a')
    }
  },

  // Get relative time for live games
  getRelativeTime(dateString: string): string {
    const date = parseISO(dateString)
    const zonedDate = utcToZonedTime(date, NFL_TIMEZONE)
    const now = new Date()
    
    const diffInMinutes = Math.floor((now.getTime() - zonedDate.getTime()) / (1000 * 60))
    
    if (diffInMinutes < 1) {
      return 'Just started'
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`
    } else {
      const hours = Math.floor(diffInMinutes / 60)
      const minutes = diffInMinutes % 60
      return `${hours}h ${minutes}m ago`
    }
  },

  // Get week range for weekly picks (Wednesday-based to align with ESPN API)
  getWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 3 }) // Wednesday
    const end = endOfWeek(date, { weekStartsOn: 3 }) // Tuesday
    return { start, end }
  },

  // Format date range for display
  formatDateRange(start: Date, end: Date): string {
    return `${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`
  },

  // Check if game is live
  isGameLive(startTime: string, status: string): boolean {
    if (status === 'live') return true
    
    const gameStart = parseISO(startTime)
    const zonedGameStart = utcToZonedTime(gameStart, NFL_TIMEZONE)
    const now = new Date()
    
    // Game is live if it started within the last 4 hours
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000)
    return zonedGameStart > fourHoursAgo && zonedGameStart < now
  },

  // Get next game day
  getNextGameDay(): Date {
    const today = new Date()
    const tomorrow = addDays(today, 1)
    return tomorrow
  },

  // Format timezone-aware time
  formatTimeWithTimezone(dateString: string): string {
    const date = parseISO(dateString)
    const zonedDate = utcToZonedTime(date, NFL_TIMEZONE)
    return format(zonedDate, 'h:mm a zzz')
  },

  // Get week range starting on Sunday (legacy - keeping for backward compatibility)
  getSundayWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 0 }) // Sunday
    const end = endOfWeek(date, { weekStartsOn: 0 }) // Saturday
    return { start, end }
  },

  // Get Wednesday-based week range (aligns with ESPN API)
  getWednesdayWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 3 }) // Wednesday
    const end = endOfWeek(date, { weekStartsOn: 3 }) // Tuesday
    return { start, end }
  },

  // Check if today is Wednesday (new week start day)
  isNewWeekDay(date: Date = new Date()): boolean {
    return date.getDay() === 3 // Wednesday is day 3 (0 = Sunday, 1 = Monday, 2 = Tuesday, 3 = Wednesday)
  },

  // Get the next Wednesday (next week start day)
  getNextWeekStartDay(date: Date = new Date()): Date {
    const today = date
    const daysUntilWednesday = (3 - today.getDay() + 7) % 7
    return addDays(today, daysUntilWednesday)
  },

  // Get the current Wednesday-based week start
  getCurrentWeekStart(date: Date = new Date()): Date {
    const { start } = this.getWednesdayWeekRange(date)
    return start
  },

  // Check if a date is in the current Wednesday-based week
  isInCurrentWeek(date: Date, currentDate: Date = new Date()): boolean {
    const { start, end } = this.getWednesdayWeekRange(currentDate)
    return date >= start && date <= end
  }
} 

// Result can be week data, off-season sentinel (so UI redirects instead of showing error), or null (API/network failure)
export type CurrentNFLWeekResult =
  | { week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date }
  | { offSeason: true }
  | null

// Get current NFL week from ESPN API (primary method - no hardcoded dates)
export async function getCurrentNFLWeekFromAPI(): Promise<CurrentNFLWeekResult> {
  try {
    // Import espnApi dynamically to avoid circular dependencies
    const { espnApi } = await import('@/lib/espn-api')
    const result = await espnApi.getCurrentNFLWeek()
    // Pass through week data or off-season; null stays null (failure)
    if (result && 'offSeason' in result) return { offSeason: true }
    return result
  } catch (error) {
    console.error('Error getting current NFL week from API:', error)
    return null
  }
}

// Get current week number using ESPN API (async version)
export async function getCurrentWeekNumberFromAPI(): Promise<number> {
  try {
    const result = await getCurrentNFLWeekFromAPI()
    if (result && 'week' in result) {
      const nflWeek = result
      // Return negative for preseason and pro bowl (excluded from stats), positive for regular/postseason
      if (nflWeek.weekType === 'preseason' || nflWeek.weekType === 'pro-bowl') {
        return -nflWeek.week
      } else {
        return nflWeek.week
      }
    }
  } catch (error) {
    console.error('Error getting week from API:', error)
  }
  
  // No fallback - we want to fail if API is unavailable or off-season
  throw new Error('Unable to determine current NFL week - ESPN API unavailable')
} 

// Returns { season, week } for any date using ESPN API
export async function getSeasonAndWeek(date: Date = new Date()) {
  try {
    const result = await getCurrentNFLWeekFromAPI()
    if (result && 'week' in result) {
      const nflWeek = result
      const season = String(nflWeek.season)
      const week = nflWeek.weekType === 'preseason' ? `preseason-${nflWeek.week}` : nflWeek.weekType === 'pro-bowl' ? `pro-bowl-${nflWeek.week}` : `week-${nflWeek.week}`
      return { season, week }
    }
  } catch (error) {
    console.error('Error getting season and week from API:', error)
  }
  
  // Fallback - this should rarely happen
  throw new Error('Unable to determine season and week - ESPN API unavailable')
}

// Check if a week is complete (all games finished)
export function isWeekComplete(games: any[]): boolean {
  if (!games || games.length === 0) return false
  
  // Check if all games are finished (final or post status)
  return games.every(game => game.status === 'final' || game.status === 'post')
}

// Get the most recent completed week
export function getMostRecentCompletedWeek(gamesByWeek: Record<string, any[]>): string | null {
  const weekKeys = Object.keys(gamesByWeek).sort().reverse()
  
  for (const weekKey of weekKeys) {
    const games = gamesByWeek[weekKey]
    if (isWeekComplete(games)) {
      return weekKey
    }
  }
  
  return null
}

// Check if we should wait until next morning before showing a completed week
export function shouldWaitUntilNextMorning(games: any[]): boolean {
  if (!games || games.length === 0) return false
  
  // Check if all games are finished
  const allFinished = isWeekComplete(games)
  if (!allFinished) return false
  
  // Get the latest game end time
  const latestGameEnd = games
    .filter(game => game.status === 'final' || game.status === 'post')
    .map(game => new Date(game.date))
    .sort((a, b) => b.getTime() - a.getTime())[0]
  
  if (!latestGameEnd) return false
  
  // Check if it's been less than 12 hours since the last game ended
  const now = new Date()
  const hoursSinceLastGame = (now.getTime() - latestGameEnd.getTime()) / (1000 * 60 * 60)
  
  return hoursSinceLastGame < 12
}

/**
 * Normalize NFL round names to short, consistent format
 * Converts ESPN API labels like "Wild Card Round", "Divisional Round", 
 * "Conference Championship" to short names: "wild card", "divisional", "conference", "super bowl"
 */
export function normalizeRoundName(label: string | undefined | null): string | undefined {
  if (!label) return undefined
  
  const normalized = label.toLowerCase().trim()
  
  // Match various ESPN API label formats and normalize to short names
  if (normalized.includes('wild card')) {
    return 'wild card'
  }
  if (normalized.includes('divisional')) {
    return 'divisional'
  }
  if (normalized.includes('conference')) {
    return 'conference'
  }
  if (normalized.includes('super bowl')) {
    return 'super bowl'
  }
  
  // Return original if no match (shouldn't happen for valid postseason rounds)
  return normalized
}

/**
 * Get display name for a round (uppercase for UI)
 */
export function getRoundDisplayName(label: string | undefined | null, weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl', weekNumber: number): string {
  if (weekType === 'preseason') {
    return `PRESEASON ${weekNumber}`
  }
  // Pro bowl is excluded from UI/stats; display name not used in selectable weeks
  if (weekType === 'pro-bowl') {
    return `WEEK ${weekNumber}`
  }
  
  if (weekType === 'postseason' && label) {
    const normalized = normalizeRoundName(label)
    // Never show "Pro Bowl" in the UI
    if (normalized?.toLowerCase().includes('pro bowl')) return `WEEK ${weekNumber}`
    return normalized ? normalized.toUpperCase() : `POSTSEASON ${weekNumber}`
  }
  
  // Regular season
  return `WEEK ${weekNumber}`
}

/**
 * Get week key for a round (used in database keys)
 */
export function getWeekKey(weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl', weekNumber: number, label?: string | null): string {
  if (weekType === 'preseason') {
    return `preseason-${Math.abs(weekNumber)}`
  }
  if (weekType === 'pro-bowl') {
    return `pro-bowl-${Math.abs(weekNumber)}`
  }
  
  if (weekType === 'postseason' && label) {
    const normalized = normalizeRoundName(label)
    return normalized ? normalized.replace(/\s+/g, '-') : `postseason-${weekNumber}`
  }
  
  // Regular season (use Math.abs so negative week numbers from API never produce "week--17")
  return `week-${Math.abs(weekNumber)}`
} 