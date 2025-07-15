import { format, parseISO, isToday, isTomorrow, isYesterday, addDays, startOfWeek, endOfWeek } from 'date-fns'
import { utcToZonedTime, zonedTimeToUtc } from 'date-fns-tz'

// MLB timezone (Pacific Time as default)
const MLB_TIMEZONE = 'America/Los_Angeles'

export const dateHelpers = {
  // Format game date for display
  formatGameDate(dateString: string): string {
    const date = parseISO(dateString)
    const zonedDate = utcToZonedTime(date, MLB_TIMEZONE)
    
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
    const zonedDate = utcToZonedTime(date, MLB_TIMEZONE)
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

  // Get week range for weekly picks
  getWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 1 }) // Monday
    const end = endOfWeek(date, { weekStartsOn: 1 }) // Sunday
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
    const zonedGameStart = utcToZonedTime(gameStart, MLB_TIMEZONE)
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
    const zonedDate = utcToZonedTime(date, MLB_TIMEZONE)
    return format(zonedDate, 'h:mm a zzz')
  },

  // Get week range starting on Sunday
  getSundayWeekRange(date: Date = new Date()) {
    const start = startOfWeek(date, { weekStartsOn: 0 }) // Sunday
    const end = endOfWeek(date, { weekStartsOn: 0 }) // Saturday
    return { start, end }
  }
} 

// MLB season start (update this for each new season)
export function getMLBSeasonStart() {
  // Change this date when a new MLB season starts
  // 2024 MLB season: March 28, 2024
  return new Date('2024-03-28')
}

// Returns { season, week } for any date
export function getSeasonAndWeek(date: Date) {
  const seasonStart = getMLBSeasonStart()
  const season = String(seasonStart.getFullYear())
  const week = Math.ceil((date.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return { season, week: `week-${week}` }
} 