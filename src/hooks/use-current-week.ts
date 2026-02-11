import { useState, useEffect } from 'react'
import { getCurrentNFLWeekFromAPI } from '@/utils/date-helpers'

export function useCurrentWeek() {
  const [currentWeek, setCurrentWeek] = useState<number | null>(null)
  const [weekInfo, setWeekInfo] = useState<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCurrentWeek = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Get week from ESPN API (no fallback - we want to fail if API is unavailable)
        const result = await getCurrentNFLWeekFromAPI()
        
        if (result && 'offSeason' in result) {
          // Intentional off-season (e.g. Wednesday after last week) — no error, let dashboard redirect
          setCurrentWeek(null)
          setWeekInfo(null)
          setError(null)
        } else if (result && 'week' in result) {
          const nflWeek = result
          // Return negative for preseason and pro bowl (excluded from stats), positive for regular/postseason
          const weekNumber = (nflWeek.weekType === 'preseason' || nflWeek.weekType === 'pro-bowl') ? -nflWeek.week : nflWeek.week
          setCurrentWeek(weekNumber)
          setWeekInfo(nflWeek)
          setError(null)
          console.log(`📅 Current NFL week from API: ${nflWeek.week} (${nflWeek.weekType}) - ${nflWeek.startDate.toISOString()} to ${nflWeek.endDate.toISOString()}`)
        } else {
          throw new Error('No week data returned from ESPN API')
        }
      } catch (err) {
        console.error('Error fetching current week:', err)
        setError(err instanceof Error ? err.message : 'Unknown error')
        setCurrentWeek(null)
        setWeekInfo(null)
      } finally {
        setLoading(false)
      }
    }

    fetchCurrentWeek()
  }, [])

  return { currentWeek, weekInfo, loading, error }
}
