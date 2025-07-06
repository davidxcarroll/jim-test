'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { format } from 'date-fns'
import { espnApi } from '@/lib/espn-api'
import { dateHelpers } from '@/utils/date-helpers'
import { getTeamByAbbreviation } from '@/utils/team-utils'
import { Team } from '@/types/mlb'

interface UserStatsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName: string
}

interface UserStats {
  overall: {
    correct: number
    total: number
    percentage: number
  }
  weekly: Array<{
    week: string
    correct: number
    total: number
    percentage: number
  }>
  movies: string[]
  moviePositions: number[]
}

export function UserStatsModal({ isOpen, onClose, userId, userName }: UserStatsModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [worldSeriesTeam, setWorldSeriesTeam] = useState<Team | null>(null)

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserStats()
    }
  }, [isOpen, userId])

  const fetchUserStats = async () => {
    setLoading(true)
    try {
      // Fetch user data for movies and world series pick
      const userDoc = await getDoc(doc(db, 'users', userId))
      const userData = userDoc.exists() ? userDoc.data() : {}
      const movies = userData.moviePicks || []
      const worldSeriesPick = userData.worldSeriesPick || ''

      // Fetch world series team data if user has a pick
      if (worldSeriesPick) {
        try {
          const team = await getTeamByAbbreviation(worldSeriesPick)
          setWorldSeriesTeam(team)
        } catch (error) {
          console.error('Error fetching world series team:', error)
          setWorldSeriesTeam(null)
        }
      } else {
        setWorldSeriesTeam(null)
      }

      // Fetch all picks for this user
      const picksCollection = collection(db, 'users', userId, 'picks')
      const picksSnapshot = await getDocs(picksCollection)

      const weeklyStats: Record<string, { correct: number; total: number }> = {}
      let overallCorrect = 0
      let overallTotal = 0

      // Process each week's picks
      for (const pickDoc of picksSnapshot.docs) {
        const weekData = pickDoc.data()
        const weekId = pickDoc.id // Format: "2024_week-1"

        let weekCorrect = 0
        let weekTotal = 0

        // Get week dates for fetching games
        const [season, weekStr] = weekId.split('_')
        const weekNumber = parseInt(weekStr.replace('week-', ''))

        // Calculate week start date (MLB season started March 28, 2024)
        const seasonStart = new Date('2024-03-28')
        const weekStart = new Date(seasonStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000)
        const { start, end } = dateHelpers.getSundayWeekRange(weekStart)

        // Fetch games for this week
        let weekGames: any[] = []
        try {
          weekGames = await espnApi.getGamesForDateRange(start, end)
        } catch (error) {
          console.error(`Error fetching games for ${weekId}:`, error)
        }

        // Count picks for this week and check correctness
        Object.entries(weekData).forEach(([gameId, pick]: [string, any]) => {
          if (pick.pickedTeam && gameId) {
            weekTotal++

            // Find the corresponding game
            const game = weekGames.find(g => g.id === gameId)
            if (game && (game.status === 'final' || game.status === 'post')) {
              const homeScore = Number(game.homeScore) || 0
              const awayScore = Number(game.awayScore) || 0

              // Determine if pick was correct
              const homeWon = homeScore > awayScore
              const pickCorrect = (pick.pickedTeam === 'home' && homeWon) ||
                (pick.pickedTeam === 'away' && !homeWon)

              if (pickCorrect) {
                weekCorrect++
              }
            }
          }
        })

        weeklyStats[weekId] = { correct: weekCorrect, total: weekTotal }
        overallCorrect += weekCorrect
        overallTotal += weekTotal
      }

      // Convert to sorted array format
      const weeklyArray = Object.entries(weeklyStats)
        .map(([week, stats]) => {
          // Extract just the week number from "2024_week-1" format
          const weekNumber = week.match(/week-(\d+)/)?.[1] || '0'
          return {
            week: `Week ${weekNumber}`,
            correct: stats.correct,
            total: stats.total,
            percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0
          }
        })
        .sort((a, b) => {
          // Sort by week number (extract number from "Week X")
          const aNum = parseInt(a.week.match(/Week (\d+)/)?.[1] || '0')
          const bNum = parseInt(b.week.match(/Week (\d+)/)?.[1] || '0')
          return bNum - aNum // Most recent first
        })

      // Filter movies but preserve original positions
      const filteredMovies = movies
        .map((movie: string, index: number) => ({ movie: movie.trim(), position: index + 1 }))
        .filter((item: { movie: string; position: number }) => item.movie !== '')

      setStats({
        overall: {
          correct: overallCorrect,
          total: overallTotal,
          percentage: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0
        },
        weekly: weeklyArray,
        movies: filteredMovies.map((item: { movie: string; position: number }) => item.movie),
        moviePositions: filteredMovies.map((item: { movie: string; position: number }) => item.position)
      })
    } catch (error) {
      console.error('Error fetching user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-neutral-100 max-w-2xl w-full mx-2 pb-8 max-h-[98vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-neutral-100 shadow-[0_1px_0_#000000] p-1">
          <div className="relative flex items-center justify-between">
            
            <div className="xl:w-20 xl:h-20 w-10 h-10 flex items-center justify-center">
              {worldSeriesTeam && (
                <img
                  src={worldSeriesTeam.logo}
                  alt={worldSeriesTeam.name}
                  className="w-full h-full object-contain"
                />
              )}
            </div>
            
            <h2 className="font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-center leading-10 capitalize">
              {userName}
            </h2>
            
            <button
              onClick={onClose}
              className="xl:w-20 xl:h-20 w-10 h-10 flex items-center justify-center"
            >
              <span className="material-symbols-sharp">close</span>
            </button>

          </div>
        </div>

        {/* Content */}
        <div className="xl:p-6 p-4 xl:space-y-6 space-y-2">
          {loading ? (
            <div className="text-center py-6">
              <div className="text-xl max-xl:text-sm font-bold uppercase">Loading...</div>
            </div>
          ) : (
            <>
              {/* Overall Success Rate - only show if there are picks */}
              {stats?.overall && stats.overall.total > 0 && (
                <>
                  <div className="flex flex-row items-center justify-center gap-1 max-xl:text-sm font-bold uppercase">
                    <div className="w-full text-left">
                      Overall
                    </div>
                    <div className="w-full text-center">
                      {stats.overall.correct}/{stats.overall.total}
                    </div>
                    <div className="w-full text-right">
                      {stats.overall.percentage}%
                    </div>
                  </div>
                  <hr className="border-t-[1px] border-black" />
                </>
              )}

              {/* Weekly Breakdown */}
              {stats?.weekly.filter(week => week.total > 0).map((week, index) => (
                <div key={index} className="flex flex-row items-center justify-center gap-1 max-xl:text-sm font-bold uppercase">
                  <div className="w-full text-left">
                    {week.week}
                  </div>
                  <div className="w-full text-center">
                    {week.correct}/{week.total}
                  </div>
                  <div className="w-full text-right">
                    {week.percentage}%
                  </div>
                </div>
              ))}
              {stats && stats.weekly.filter(week => week.total > 0).length === 0 && (
                <div className="text-center py-4 text-gray-500 max-xl:text-sm font-bold uppercase">
                  No picks recorded yet
                </div>
              )}

              {/* Top 10 Movies */}
              {stats?.movies && stats.movies.length > 0 && (
                <>
                  <hr className="border-t-[1px] border-black" />

                  <h2 className="font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-center leading-10">Top 10 Movies</h2>

                  {stats.movies.map((movie, index) => (
                    <div key={index} className="flex flex-row items-center justify-center gap-1 max-xl:text-sm font-bold uppercase">
                      <div className="w-14 text-left">
                        #{stats.moviePositions[index]}
                      </div>
                      <div className="w-full text-center">
                        {movie}
                      </div>
                      <div className="w-14 text-right">
                      </div>
                    </div>
                  ))}

                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
} 