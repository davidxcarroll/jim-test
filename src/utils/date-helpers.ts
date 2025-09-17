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

// Get current NFL week from ESPN API (primary method - no hardcoded dates)
export async function getCurrentNFLWeekFromAPI(): Promise<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason'; startDate: Date; endDate: Date } | null> {
  try {
    // Import espnApi dynamically to avoid circular dependencies
    const { espnApi } = await import('@/lib/espn-api')
    return await espnApi.getCurrentNFLWeek()
  } catch (error) {
    console.error('Error getting current NFL week from API:', error)
    return null
  }
}

// Get current week number using ESPN API (async version)
export async function getCurrentWeekNumberFromAPI(): Promise<number> {
  try {
    const nflWeek = await getCurrentNFLWeekFromAPI()
    if (nflWeek) {
      // Return negative for preseason, positive for regular season
      if (nflWeek.weekType === 'preseason') {
        return -nflWeek.week
      } else {
        return nflWeek.week
      }
    }
  } catch (error) {
    console.error('Error getting week from API:', error)
  }
  
  // No fallback - we want to fail if API is unavailable
  throw new Error('Unable to determine current NFL week - ESPN API unavailable')
} 

// Returns { season, week } for any date using ESPN API
export async function getSeasonAndWeek(date: Date = new Date()) {
  try {
    const nflWeek = await getCurrentNFLWeekFromAPI()
    if (nflWeek) {
      const season = String(nflWeek.season)
      const week = nflWeek.weekType === 'preseason' ? `preseason-${nflWeek.week}` : `week-${nflWeek.week}`
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