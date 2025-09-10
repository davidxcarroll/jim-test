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

  // Get week range for weekly picks (Tuesday-based)
  getWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 2 }) // Tuesday
    const end = endOfWeek(date, { weekStartsOn: 2 }) // Monday
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

  // Get Tuesday-based week range (new primary method)
  getTuesdayWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 2 }) // Tuesday
    const end = endOfWeek(date, { weekStartsOn: 2 }) // Monday
    return { start, end }
  },

  // Check if today is Tuesday (pick day)
  isPickDay(date: Date = new Date()): boolean {
    return date.getDay() === 2 // Tuesday is day 2 (0 = Sunday, 1 = Monday, 2 = Tuesday)
  },

  // Get the next Tuesday (next pick day)
  getNextPickDay(date: Date = new Date()): Date {
    const today = date
    const daysUntilTuesday = (2 - today.getDay() + 7) % 7
    return addDays(today, daysUntilTuesday)
  },

  // Get the current Tuesday-based week start
  getCurrentWeekStart(date: Date = new Date()): Date {
    const { start } = this.getTuesdayWeekRange(date)
    return start
  },

  // Check if a date is in the current Tuesday-based week
  isInCurrentWeek(date: Date, currentDate: Date = new Date()): boolean {
    const { start, end } = this.getTuesdayWeekRange(currentDate)
    return date >= start && date <= end
  }
} 

// NFL season start (update this for each new season)
export function getNFLSeasonStart() {
  // Change this date when a new NFL season starts
  // 2025 NFL season: Starting September 4, 2025 (Thursday - first game)
  return new Date(2025, 8, 4); // Month is 0-indexed, so 8 = September
}

// NFL preseason start (update this for each new season)
export function getNFLPreseasonStart() {
  // 2025 NFL preseason: Ended September 3, 2025
  // Regular season starts September 4, 2025
  return new Date('2025-08-01T00:00:00.000Z')
}

// Check if we're currently in preseason
export function isPreseason(date: Date = new Date()): boolean {
  const preseasonStart = getNFLPreseasonStart()
  const regularSeasonStart = getNFLSeasonStart()
  return date >= preseasonStart && date < regularSeasonStart
}

// Get preseason week number (negative numbers for preseason)
export function getPreseasonWeek(date: Date = new Date()): number {
  const preseasonStart = getNFLPreseasonStart()
  const daysSinceStart = Math.floor((date.getTime() - preseasonStart.getTime()) / (24 * 60 * 60 * 1000))
  const weekNumber = Math.floor(daysSinceStart / 7) + 1
  return -weekNumber // Negative to indicate preseason
}

// Get preseason week number for display (positive numbers)
export function getPreseasonWeekDisplay(date: Date = new Date()): number {
  const preseasonStart = getNFLPreseasonStart()
  const daysSinceStart = Math.floor((date.getTime() - preseasonStart.getTime()) / (24 * 60 * 60 * 1000))
  const weekNumber = Math.floor(daysSinceStart / 7) + 1
  return weekNumber
}

// Get regular season week number
export function getRegularSeasonWeek(date: Date = new Date()): number {
  const seasonStart = getNFLSeasonStart()
  const weekNumber = Math.ceil((date.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return weekNumber
}

// Get the appropriate week number (preseason or regular season)
export function getCurrentWeekNumber(date: Date = new Date()): number {
  if (isPreseason(date)) {
    return getPreseasonWeek(date)
  } else {
    return getRegularSeasonWeek(date)
  }
} 

// Returns { season, week } for any date
export function getSeasonAndWeek(date: Date) {
  const seasonStart = getNFLSeasonStart()
  const season = String(seasonStart.getFullYear())
  const weekNumber = getCurrentWeekNumber(date)
  const week = weekNumber < 0 ? `preseason-${Math.abs(weekNumber)}` : `week-${weekNumber}`
  return { season, week }
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