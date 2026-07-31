import { getCurrentNFLWeekFromAPI } from '@/utils/date-helpers'
import { getLikelyCompletedSeasonYear } from '@/utils/season-champions'
import { espnApi } from '@/lib/espn-api'

export type RecapSeasonContext = {
  season: number
  /** Present when ESPN reports an in-season current week. */
  currentWeek?: Exclude<
    Awaited<ReturnType<typeof getCurrentNFLWeekFromAPI>>,
    { offSeason: true } | null
  >
  offSeason: boolean
}

/**
 * Resolve which NFL season year week-recap crons should process.
 * In-season: current ESPN season. Off-season: last completed season so late
 * Super Bowl / unfinished weeks can still be snapshotted.
 */
export async function resolveRecapSeasonContext(): Promise<RecapSeasonContext | null> {
  const currentWeekResult = await getCurrentNFLWeekFromAPI()

  if (currentWeekResult && !('offSeason' in currentWeekResult)) {
    return {
      season: currentWeekResult.season,
      currentWeek: currentWeekResult,
      offSeason: false,
    }
  }

  if (currentWeekResult && 'offSeason' in currentWeekResult) {
    const candidate = getLikelyCompletedSeasonYear()
    try {
      const weeks = await espnApi.getAllAvailableWeeks(candidate)
      if (weeks.length > 0) {
        return { season: candidate, offSeason: true }
      }
    } catch {
      // fall through
    }
    // Retry prior year if candidate has no calendar yet
    const fallback = candidate - 1
    try {
      const weeks = await espnApi.getAllAvailableWeeks(fallback)
      if (weeks.length > 0) {
        return { season: fallback, offSeason: true }
      }
    } catch {
      // fall through
    }
    return { season: candidate, offSeason: true }
  }

  return null
}
