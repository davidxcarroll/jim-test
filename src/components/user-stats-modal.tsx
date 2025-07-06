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
    console.log('🔍 Starting fetchUserStats for userId:', userId)
    
    try {
      // Check if Firebase is initialized
      if (!db) {
        console.warn('❌ Firebase not initialized, cannot fetch user stats')
        setStats(null)
        return
      }

      console.log('✅ Firebase is initialized, proceeding with data fetch')

      // Fetch user data for movies and world series pick
      console.log('📋 Fetching user document for userId:', userId)
      const userDoc = await getDoc(doc(db, 'users', userId))
      const userData = userDoc.exists() ? userDoc.data() : {}
      console.log('📋 User data:', userData)
      
      const movies = userData.moviePicks || []
      const worldSeriesPick = userData.worldSeriesPick || ''
      console.log('🎬 Movies:', movies)
      console.log('🏆 World Series Pick:', worldSeriesPick)

      // Fetch world series team data if user has a pick
      if (worldSeriesPick) {
        try {
          console.log('🏆 Fetching world series team for:', worldSeriesPick)
          const team = await getTeamByAbbreviation(worldSeriesPick)
          console.log('🏆 World series team found:', team)
          setWorldSeriesTeam(team)
        } catch (error) {
          console.error('❌ Error fetching world series team:', error)
          setWorldSeriesTeam(null)
        }
      } else {
        console.log('🏆 No world series pick found')
        setWorldSeriesTeam(null)
      }

      // Fetch all picks for this user
      console.log('📊 Fetching picks collection for userId:', userId)
      const picksCollection = collection(db, 'users', userId, 'picks')
      const picksSnapshot = await getDocs(picksCollection)
      console.log('📊 Picks snapshot size:', picksSnapshot.size)

      const weeklyStats: Record<string, { correct: number; total: number }> = {}
      let overallCorrect = 0
      let overallTotal = 0

      // Process each week's picks
      for (const pickDoc of picksSnapshot.docs) {
        const weekData = pickDoc.data()
        const weekId = pickDoc.id // Format: "2024_week-1"
        console.log(`📅 Processing week: ${weekId}`, weekData)

        let weekCorrect = 0
        let weekTotal = 0

        // Get week dates for fetching games
        const [season, weekStr] = weekId.split('_')
        const weekNumber = parseInt(weekStr.replace('week-', ''))
        console.log(`📅 Week number: ${weekNumber}`)

        // Calculate week start date (MLB season started March 28, 2024)
        const seasonStart = new Date('2024-03-28')
        const weekStart = new Date(seasonStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000)
        const { start, end } = dateHelpers.getSundayWeekRange(weekStart)
        console.log(`📅 Week date range: ${start.toISOString()} to ${end.toISOString()}`)

        // Fetch games for this week
        let weekGames: any[] = []
        try {
          console.log(`🎮 Fetching games for week ${weekId}`)
          weekGames = await espnApi.getGamesForDateRange(start, end)
          console.log(`🎮 Found ${weekGames.length} games for week ${weekId}`)
        } catch (error) {
          console.error(`❌ Error fetching games for ${weekId}:`, error)
        }

        // Count picks for this week and check correctness
        Object.entries(weekData).forEach(([gameId, pick]: [string, any]) => {
          if (pick.pickedTeam && gameId) {
            weekTotal++
            console.log(`🎯 Game ${gameId}: picked ${pick.pickedTeam}`)

            // Find the corresponding game
            const game = weekGames.find(g => g.id === gameId)
            if (game && (game.status === 'final' || game.status === 'post')) {
              const homeScore = Number(game.homeScore) || 0
              const awayScore = Number(game.awayScore) || 0
              console.log(`🎯 Game ${gameId}: ${game.awayTeam.abbreviation} ${awayScore} @ ${game.homeTeam.abbreviation} ${homeScore}`)

              // Determine if pick was correct
              const homeWon = homeScore > awayScore
              const pickCorrect = (pick.pickedTeam === 'home' && homeWon) ||
                (pick.pickedTeam === 'away' && !homeWon)

              if (pickCorrect) {
                weekCorrect++
                console.log(`✅ Correct pick for game ${gameId}`)
              } else {
                console.log(`❌ Incorrect pick for game ${gameId}`)
              }
            } else {
              console.log(`⏳ Game ${gameId} not finished yet (status: ${game?.status})`)
            }
          }
        })

        weeklyStats[weekId] = { correct: weekCorrect, total: weekTotal }
        overallCorrect += weekCorrect
        overallTotal += weekTotal
        console.log(`📊 Week ${weekId}: ${weekCorrect}/${weekTotal} correct`)
      }

      console.log(`📊 Overall stats: ${overallCorrect}/${overallTotal} correct`)

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

      console.log('📊 Weekly array:', weeklyArray)

      // Filter movies but preserve original positions
      const filteredMovies = movies
        .map((movie: string, index: number) => ({ movie: movie.trim(), position: index + 1 }))
        .filter((item: { movie: string; position: number }) => item.movie !== '')

      console.log('🎬 Filtered movies:', filteredMovies)

      const finalStats = {
        overall: {
          correct: overallCorrect,
          total: overallTotal,
          percentage: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0
        },
        weekly: weeklyArray,
        movies: filteredMovies.map((item: { movie: string; position: number }) => item.movie),
        moviePositions: filteredMovies.map((item: { movie: string; position: number }) => item.position)
      }

      console.log('📊 Final stats object:', finalStats)
      setStats(finalStats)
    } catch (error) {
      console.error('❌ Error fetching user stats:', error)
    } finally {
      setLoading(false)
      console.log('✅ fetchUserStats completed')
    }
  }

  if (!isOpen) return null

  console.log('🎭 Modal render state:', {
    isOpen,
    userId,
    userName,
    loading,
    stats,
    worldSeriesTeam
  })

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
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
          ) : stats ? (
            <>
              {/* Overall Success Rate - only show if there are picks */}
              {stats?.overall && stats.overall.total > 0 && (
                <>
                  <div className="flex flex-row items-center justify-center gap-1 max-xl:text-sm font-bold uppercase">
                    <div className="w-full text-left">
                      Overall
                    </div>
                    <div className="w-full text-center leading-none">
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
                  <div className="w-full text-center leading-none">
                    {week.correct}/{week.total}
                  </div>
                  <div className="w-full text-right">
                    {week.percentage}%
                  </div>
                </div>
              ))}
              {stats && stats.weekly.filter(week => week.total > 0).length === 0 && (
                <div className="text-center py-4 text-black/50 max-xl:text-sm font-bold uppercase">
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
                      <div className="w-full text-center leading-none">
                        {movie}
                      </div>
                      <div className="w-14 text-right">
                      </div>
                    </div>
                  ))}

                </>
              )}
                          </>
            ) : (
              <div className="text-center py-6">
                <div className="text-xl max-xl:text-sm font-bold uppercase">No data available</div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  } 