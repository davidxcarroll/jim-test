'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { format } from 'date-fns'
import { espnApi } from '@/lib/espn-api'
import { dateHelpers, getSeasonAndWeek } from '@/utils/date-helpers'
import { getTeamByAbbreviation, getTeamLogo, getTeamBackgroundAndLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'
import { loadTeamColorMappings } from '@/store/team-color-mapping-store'
import { tmdbApi } from '@/lib/tmdb-api'
import { PHIL_USER, isPhil } from '@/utils/phil-user'


interface UserStatsModalProps {
  isOpen: boolean
  onClose: () => void
  userId: string
  userName: string
}

interface ProcessedMovie {
  title: string
  position: number
  tmdbId?: number
  posterPath?: string
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
    isTopScore: boolean
  }>
  movies: string[]
  moviePositions: number[]
  movieData?: Array<{
    title: string
    tmdbId?: number
    posterPath?: string
  }>
}

interface MoviePoster {
  title: string
  posterUrl: string
  position: number
}

export function UserStatsModal({ isOpen, onClose, userId, userName }: UserStatsModalProps) {
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [superBowlTeam, setSuperBowlTeam] = useState<Team | null>(null)
  const [mappingsLoaded, setMappingsLoaded] = useState(false)
  const [moviePosters, setMoviePosters] = useState<MoviePoster[]>([])
  const [postersLoading, setPostersLoading] = useState(false)

  useEffect(() => {
    if (isOpen && userId) {
      fetchUserStats()
    }
  }, [isOpen, userId])

  useEffect(() => {
    loadTeamColorMappings().then(() => setMappingsLoaded(true))
  }, [])

  // Fetch movie posters when stats change
  useEffect(() => {
    if (stats?.movies && stats.movies.length > 0) {
      fetchMoviePosters()
    }
  }, [stats?.movies])

  const fetchMoviePosters = async () => {
    if (!stats?.movies) return

    setPostersLoading(true)
    const posters: MoviePoster[] = []

    // Log if running on client or server
    if (typeof window !== 'undefined') {
      console.log('[TMDB] Running on CLIENT (browser)')
    } else {
      console.log('[TMDB] Running on SERVER (Node.js)')
    }

    // Log if TMDB API key is present (do not print the key itself)
    if (typeof process !== 'undefined' && process.env && process.env.TMDB_API_KEY) {
      console.log('[TMDB] TMDB API key is present')
    } else {
      console.warn('[TMDB] TMDB API key is NOT present or not accessible in this environment')
    }

    for (let i = 0; i < stats.movies.length; i++) {
      const movieTitle = stats.movies[i]
      if (!movieTitle.trim()) continue

      try {
        console.log(`[TMDB] Processing movie: '${movieTitle}'`)

        // Check if we have stored movie data with tmdbId
        const movieData = stats.movieData?.find(md => md.title === movieTitle)
        if (movieData && movieData.tmdbId) {
          console.log(`[TMDB] Using stored movie data for '${movieTitle}' (ID: ${movieData.tmdbId})`)

          // Use stored poster path if available
          if (movieData.posterPath) {
            const posterUrl = tmdbApi.getPosterUrl(movieData.posterPath, 'w342')
            posters.push({
              title: movieTitle,
              posterUrl,
              position: stats.moviePositions[i]
            })
            continue
          }

          // If no stored poster path, fetch movie details by ID
          try {
            const movieDetails = await tmdbApi.getMovieDetails(movieData.tmdbId)
            if (movieDetails) {
              const posterUrl = tmdbApi.getPosterUrl(movieDetails.poster_path || null, 'w342')
              posters.push({
                title: movieTitle,
                posterUrl,
                position: stats.moviePositions[i]
              })
              continue
            }
          } catch (error) {
            console.warn(`[TMDB] Failed to fetch movie details for ID ${movieData.tmdbId}, falling back to search`)
          }
        }

        // Fallback to search if no stored data or failed to fetch details
        console.log(`[TMDB] Searching for movie: '${movieTitle}'`)
        const searchResults = await tmdbApi.searchMovies(movieTitle, 1)
        console.log(`[TMDB] Search results for '${movieTitle}':`, searchResults)

        if (searchResults.length > 0) {
          // Try to find an exact match first
          let selectedMovie = searchResults.find(movie =>
            movie.title.toLowerCase() === movieTitle.toLowerCase()
          )

          // If no exact match, try partial match
          if (!selectedMovie) {
            selectedMovie = searchResults.find(movie =>
              movie.title.toLowerCase().includes(movieTitle.toLowerCase()) ||
              movieTitle.toLowerCase().includes(movie.title.toLowerCase())
            )
          }

          // If still no match, use the first result
          if (!selectedMovie) {
            selectedMovie = searchResults[0]
            console.warn(`[TMDB] No exact match found for '${movieTitle}', using first result: '${selectedMovie.title}'`)
          } else {
            console.log(`[TMDB] Found match for '${movieTitle}': '${selectedMovie.title}'`)
          }

          const posterUrl = tmdbApi.getPosterUrl(selectedMovie.poster_path || null, 'w342')
          posters.push({
            title: movieTitle,
            posterUrl,
            position: stats.moviePositions[i]
          })
        } else {
          // Use placeholder if no poster found
          console.warn(`[TMDB] No poster found for '${movieTitle}', using placeholder.`)
          posters.push({
            title: movieTitle,
            posterUrl: '', // Use empty string to indicate placeholder
            position: stats.moviePositions[i]
          })
        }
      } catch (error) {
        console.error(`[TMDB] Error fetching poster for '${movieTitle}':`, error)
        // Use placeholder on error
        posters.push({
          title: movieTitle,
          posterUrl: '', // Use empty string to indicate placeholder
          position: stats.moviePositions[i]
        })
      }
    }

    setMoviePosters(posters)
    setPostersLoading(false)
  }

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

      // Fetch user data for movies and super bowl pick
      console.log('📋 Fetching user document for userId:', userId)
      
      let userData: any = {}
      let movies: any[] = []
      let superBowlPick: string = ''
      
      // Check if this is Phil (hardcoded user)
      if (isPhil(userId)) {
        console.log('🏈 This is Phil - using hardcoded data')
        userData = PHIL_USER
        movies = userData.moviePicks || []
        superBowlPick = userData.superBowlPick || ''
      } else {
        // Regular user - fetch from Firebase
        const userDoc = await getDoc(doc(db, 'users', userId))
        userData = userDoc.exists() ? userDoc.data() : {}
        movies = userData.moviePicks || []
        superBowlPick = userData.superBowlPick || ''
      }
      
      console.log('📋 User data:', userData)
      console.log('🎬 Movies:', movies)
      console.log('🏆 Super Bowl Pick:', superBowlPick)

      // Process movies - handle both old format (string[]) and new format (object[])
      const processedMovies: ProcessedMovie[] = movies.map((movie: any, index: number) => {
        console.log(`🎬 Processing movie ${index + 1}:`, movie)
        
        if (typeof movie === 'string') {
          // Old format - just a string
          const result = { title: movie.trim(), position: index + 1 }
          console.log(`🎬 Old format result:`, result)
          return result
        } else if (movie && typeof movie === 'object') {
          // New format - object with title, tmdbId, posterPath
          const result = {
            title: movie.title?.trim() || '',
            position: index + 1,
            tmdbId: movie.tmdbId,
            posterPath: movie.posterPath
          }
          console.log(`🎬 New format result:`, result)
          return result
        } else {
          // Invalid format
          const result = { title: '', position: index + 1 }
          console.log(`🎬 Invalid format result:`, result)
          return result
        }
      }).filter((item: ProcessedMovie) => {
        const shouldKeep = item.title !== ''
        console.log(`🎬 Filtering "${item.title}" (position ${item.position}): ${shouldKeep ? 'KEEP' : 'REMOVE'}`)
        return shouldKeep
      })

      console.log('🎬 Processed movies:', processedMovies)

      // Fetch super bowl team data if user has a pick
      if (superBowlPick) {
        try {
          console.log('🏆 Fetching super bowl team for:', superBowlPick)
          const team = await getTeamByAbbreviation(superBowlPick)
          console.log('🏆 Super bowl team found:', team)
          setSuperBowlTeam(team)
        } catch (error) {
          console.error('❌ Error fetching super bowl team:', error)
          setSuperBowlTeam(null)
        }
      } else {
        console.log('🏆 No Super Bowl pick found')
        setSuperBowlTeam(null)
      }

      // Fetch all picks for this user
      console.log('📊 Fetching picks collection for userId:', userId)
      
      let picksSnapshot: any
      
      // All users (including Phil) - fetch from Firebase
      const picksCollection = collection(db, 'users', userId, 'picks')
      picksSnapshot = await getDocs(picksCollection)
      
      console.log('📊 Picks snapshot size:', picksSnapshot.size)

      const weeklyStats: Record<string, { correct: number; total: number; isTopScore: boolean }> = {}
      let overallCorrect = 0
      let overallTotal = 0

      // Process each week's picks and fetch pre-calculated recap data
      for (const pickDoc of picksSnapshot.docs) {
        const weekData = pickDoc.data()
        const weekId = pickDoc.id // Format: "2024_week-1"
        console.log(`📅 Processing week: ${weekId}`, weekData)

        let weekCorrect = 0
        let weekTotal = 0
        let isTopScore = false

        // Try to get pre-calculated recap data first
        try {
          const weekRecapDoc = await getDoc(doc(db, 'weekRecaps', weekId))
          if (weekRecapDoc.exists()) {
            const recapData = weekRecapDoc.data()
            const userRecap = recapData.userStats?.find((stat: any) => stat.userId === userId)
            if (userRecap) {
              weekCorrect = userRecap.correct
              weekTotal = userRecap.total
              isTopScore = userRecap.isTopScore
              console.log(`📊 Using pre-calculated data for week ${weekId}: ${weekCorrect}/${weekTotal} correct, isTopScore: ${isTopScore}`)
            }
          }
        } catch (error) {
          console.warn(`⚠️ Could not fetch pre-calculated recap for week ${weekId}, falling back to manual calculation:`, error)
        }

        // If no pre-calculated data, fall back to manual calculation
        if (weekTotal === 0) {
          console.log(`📊 No pre-calculated data for week ${weekId}, calculating manually...`)
          
          // Get week dates for fetching games
          const [season, weekStr] = weekId.split('_')
          let weekNumber: number
          
          // Handle both regular weeks (week-X) and preseason weeks (preseason-X)
          if (weekStr.startsWith('week-')) {
            weekNumber = parseInt(weekStr.replace('week-', ''))
          } else if (weekStr.startsWith('preseason-')) {
            weekNumber = parseInt(weekStr.replace('preseason-', ''))
          } else {
            console.warn(`⚠️ Unknown week format: ${weekStr}, skipping week ${weekId}`)
            continue
          }
          
          console.log(`📅 Week number: ${weekNumber}`)

          // Use ESPN API to get week dates (no hardcoded calculations)
          // For now, we'll use a simple calculation but this should be updated to use ESPN API
          const today = new Date()
          const weekStart = new Date(today.getTime() - (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000)
          const { start, end } = dateHelpers.getWednesdayWeekRange(weekStart)
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

          // For manual calculation, we can't determine top score without calculating for all users
          // So we'll set isTopScore to false and let the user know this data might be incomplete
          isTopScore = false
        }

        weeklyStats[weekId] = { correct: weekCorrect, total: weekTotal, isTopScore }
        overallCorrect += weekCorrect
        overallTotal += weekTotal
        console.log(`📊 Week ${weekId}: ${weekCorrect}/${weekTotal} correct, isTopScore: ${isTopScore}`)
      }

      console.log(`📊 Overall stats: ${overallCorrect}/${overallTotal} correct`)

      // Convert to sorted array format
      const weeklyArray = Object.entries(weeklyStats)
        .map(([week, stats]) => {
          // Extract week number from "2024_week-1" or "2025_preseason-1" format
          let weekNumber: string
          let weekLabel: string
          
          if (week.includes('preseason-')) {
            weekNumber = week.match(/preseason-(\d+)/)?.[1] || '0'
            weekLabel = `Preseason ${weekNumber}`
          } else {
            weekNumber = week.match(/week-(\d+)/)?.[1] || '0'
            weekLabel = `Week ${weekNumber}`
          }
          
          return {
            week: weekLabel,
            correct: stats.correct,
            total: stats.total,
            percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            isTopScore: stats.isTopScore
          }
        })
        .sort((a, b) => {
          // Sort by week number (extract number from "Week X" or "Preseason X")
          const aMatch = a.week.match(/(?:Week|Preseason) (\d+)/)
          const bMatch = b.week.match(/(?:Week|Preseason) (\d+)/)
          const aNum = parseInt(aMatch?.[1] || '0')
          const bNum = parseInt(bMatch?.[1] || '0')
          return bNum - aNum // Most recent first
        })

      console.log('📊 Weekly array:', weeklyArray)

      console.log('🎬 Processed movies:', processedMovies)

      const finalStats = {
        overall: {
          correct: overallCorrect,
          total: overallTotal,
          percentage: overallTotal > 0 ? Math.round((overallCorrect / overallTotal) * 100) : 0
        },
        weekly: weeklyArray,
        movies: processedMovies.map(item => item.title),
        moviePositions: processedMovies.map(item => item.position),
        movieData: processedMovies.map(item => ({
          title: item.title,
          tmdbId: item.tmdbId,
          posterPath: item.posterPath
        }))
      }

      console.log('📊 Final stats object:', finalStats)
      console.log('🎬 Movies array length:', finalStats.movies.length)
      console.log('🎬 Movies array:', finalStats.movies)
      console.log('🎬 Movie positions:', finalStats.moviePositions)
      setStats(finalStats)
    } catch (error) {
      console.error('❌ Error fetching user stats:', error)
    } finally {
      setLoading(false)
      console.log('✅ fetchUserStats completed')
    }
  }

  if (!isOpen || !mappingsLoaded) return null

  console.log('🎭 Modal render state:', {
    isOpen,
    userId,
    userName,
    loading,
    stats,
    superBowlTeam
  })

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50"
      onClick={handleBackdropClick}
    >
      <div className="bg-neutral-100 max-w-2xl w-full mx-2 max-h-[98vh] overflow-y-auto">

        {/* Header */}
        <div className="sticky top-0 bg-neutral-100 shadow-[0_1px_0_#000000] p-1">
          <div className="relative flex items-center justify-between">

                        {(() => {
              const teamStyle = superBowlTeam ? getTeamBackgroundAndLogo(superBowlTeam) : null
              return (
                <div
                  className="xl:w-20 xl:h-20 w-10 h-10 flex items-center justify-center p-1 rounded-full shadow-[0_0_0_1px_#000000]"
                  style={{
                    backgroundColor: teamStyle ? teamStyle.background : (superBowlTeam?.color ? `#${superBowlTeam.color}` : '#1a1a1a')
                  }}
                >
                  {superBowlTeam && (
                    <img
                      src={getTeamLogo(superBowlTeam, teamStyle?.logoType || 'dark')}
                      alt={superBowlTeam.name}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        console.error('❌ Failed to load team logo:', superBowlTeam.name, e)
                      }}
                    />
                  )}
                </div>
              )
            })()}

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
                    <div className="w-full text-center">
                      {stats.overall.percentage}%
                    </div>
                    <div className="w-full text-right leading-none">
                      {stats.overall.correct}/{stats.overall.total}
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
                    <span className="inline-flex items-center justify-center gap-1">
                      {week.percentage}%
                      {week.isTopScore && (
                        <span title="Top Score" className="ml-0.5" role="img">🔥</span>
                      )}
                    </span>
                  </div>
                  <div className="w-full text-right leading-none">
                    {week.correct}/{week.total}
                  </div>
                </div>
              ))}
              {stats && stats.weekly.filter(week => week.total > 0).length === 0 && (
                <div className="text-center py-4 text-black/50 max-xl:text-sm font-bold uppercase">
                  No picks recorded yet
                </div>
              )}

              {/* Top 10 Movies */}
              {(() => {
                console.log('🎭 Rendering movies section check:', {
                  hasStats: !!stats,
                  hasMovies: !!stats?.movies,
                  moviesLength: stats?.movies?.length,
                  movies: stats?.movies
                })
                return stats?.movies && stats.movies.length > 0
              })() && (
                <>
                  <hr className="border-t-[1px] border-black" />

                  {/* <h2 className="font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-center leading-10">Top 10 Movies</h2> */}

                  <h2 className="font-bold uppercase text-center max-xl:text-sm">Top 10 Movies</h2>



                  {/* Image list */}
                  {/* {postersLoading ? (
                    <div className="text-center py-4">
                      <div className="text-sm font-bold uppercase">Loading...</div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2 max-xl:gap-1">
                      {Array.from({ length: 10 }).map((_, index) => {
                        // Find the movie poster whose position matches (index + 1)
                        const poster = moviePosters.find(p => p.position === index + 1)
                        if (poster && poster.title && poster.title.trim() !== '') {
                          return (
                            <div key={index} className="relative">
                              <div className="aspect-[2/3] shadow-[0_0_0_1px_#000000] overflow-hidden flex items-center justify-center">
                                {poster.posterUrl ? (
                                  <img
                                    src={poster.posterUrl}
                                    alt={poster.title}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : (
                                  <span className="material-symbols-sharp text-6xl text-black/30">screenshot_frame</span>
                                )}
                              </div>
                            </div>
                          )
                        } else {
                          // Empty slot placeholder with position number (index + 1)
                          return (
                            <div key={index} className="relative">
                              <div className="aspect-[2/3] shadow-[0_0_0_1px_#000000] overflow-hidden flex items-center justify-center">
                                <span className="text-3xl font-bold text-black/20 select-none">{index + 1}</span>
                              </div>
                            </div>
                          )
                        }
                      })}
                    </div>
                  )} */}

                  <div className="w-full flex flex-col items-center justify-center xl:gap-6 gap-4">

                    {/* Text list */}
                    {stats.movies.map((movie, index) => {
                      // Find the movie poster whose position matches (index + 1)
                      const poster = moviePosters.find(p => p.position === stats.moviePositions[index])
                      
                      return (
                        <div key={index} className="w-full flex flex-row items-center justify-center gap-2">
                          {/* movie poster */}
                          {postersLoading ? (
                            <div className="w-24 h-32 bg-gray-200 flex items-center justify-center">
                              <span className="material-symbols-sharp text-4xl text-black/30">hourglass_empty</span>
                            </div>
                          ) : poster && poster.posterUrl ? (
                            <img
                              src={poster.posterUrl}
                              alt={poster.title}
                              className="w-24 h-32 object-cover shadow-[0_0_0_1px_#000000]"
                              loading="lazy"
                            />
                          ) : (
                            <div className="w-24 h-32 bg-gray-200 flex items-center justify-center shadow-[0_0_0_1px_#000000]">
                              <span className="material-symbols-sharp text-4xl text-black/30">screenshot_frame</span>
                            </div>
                          )}

                          <div className="w-full flex flex-col items-start justify-center gap-1">
                            <div className="w-14 text-left uppercase font-bold max-xl:text-sm">
                              #{stats.moviePositions[index]}
                            </div>
                            <div className="w-full text-left font-jim xl:text-5xl xl:leading-10 text-4xl leading-8 leading-10 text-pretty">
                              {movie}
                            </div>
                            <div className="w-14 text-right">
                            </div>
                          </div>
                        </div>
                      )
                    })}

                  </div>

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