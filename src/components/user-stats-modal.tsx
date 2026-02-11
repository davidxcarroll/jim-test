'use client'

import { useState, useEffect } from 'react'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { format } from 'date-fns'
import { espnApi } from '@/lib/espn-api'
import { dateHelpers, getSeasonAndWeek, isWeekComplete, normalizeRoundName, getRoundDisplayName } from '@/utils/date-helpers'
import { getTeamByAbbreviation, getTeamLogo, getTeamBackgroundAndLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'
import { loadTeamColorMappings } from '@/store/team-color-mapping-store'
import { tmdbApi } from '@/lib/tmdb-api'
import { PHIL_USER, isPhil } from '@/utils/phil-user'
import { useCurrentWeek } from '@/hooks/use-current-week'


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
  const { currentWeek: apiCurrentWeek, weekInfo } = useCurrentWeek()

  useEffect(() => {
    if (isOpen && userId && weekInfo) {
      fetchUserStats()
    }
  }, [isOpen, userId, weekInfo])

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


    for (let i = 0; i < stats.movies.length; i++) {
      const movieTitle = stats.movies[i]
      if (!movieTitle.trim()) continue

      try {
        // Check if we have stored movie data with tmdbId
        const movieData = stats.movieData?.find(md => md.title === movieTitle)
        if (movieData && movieData.tmdbId) {
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
            // Fall back to search
          }
        }

        // Fallback to search if no stored data or failed to fetch details
        const searchResults = await tmdbApi.searchMovies(movieTitle, 1)

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
          }

          const posterUrl = tmdbApi.getPosterUrl(selectedMovie.poster_path || null, 'w342')
          posters.push({
            title: movieTitle,
            posterUrl,
            position: stats.moviePositions[i]
          })
        } else {
          // Use placeholder if no poster found
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

    try {
      // Check if Firebase is initialized
      if (!db) {
        console.warn('❌ Firebase not initialized, cannot fetch user stats')
        setStats(null)
        return
      }

      // Fetch user data for movies and super bowl pick
      
      let userData: any = {}
      let movies: any[] = []
      let superBowlPick: string = ''
      
      // Check if this is Phil (hardcoded user)
      if (isPhil(userId)) {
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

      // Process movies - handle both old format (string[]) and new format (object[])
      const processedMovies: ProcessedMovie[] = movies.map((movie: any, index: number) => {
        if (typeof movie === 'string') {
          // Old format - just a string
          return { title: movie.trim(), position: index + 1 }
        } else if (movie && typeof movie === 'object') {
          // New format - object with title, tmdbId, posterPath
          return {
            title: movie.title?.trim() || '',
            position: index + 1,
            tmdbId: movie.tmdbId,
            posterPath: movie.posterPath
          }
        } else {
          // Invalid format
          return { title: '', position: index + 1 }
        }
      }).filter((item: ProcessedMovie) => item.title !== '')

      // Fetch super bowl team data if user has a pick
      if (superBowlPick) {
        try {
          const team = await getTeamByAbbreviation(superBowlPick)
          setSuperBowlTeam(team)
        } catch (error) {
          console.error('❌ Error fetching super bowl team:', error)
          setSuperBowlTeam(null)
        }
      } else {
        setSuperBowlTeam(null)
      }

      // Fetch all picks for this user
      // ⚠️ CRITICAL: We ONLY READ user picks here - NEVER modify them
      // User picks are sacred and must never be changed by automated processes
      let picksSnapshot: any
      
      // All users (including Phil) - fetch from Firebase
      // READ ONLY - getDocs is read-only, never use setDoc/updateDoc/deleteDoc on picks
      const picksCollection = collection(db, 'users', userId, 'picks')
      picksSnapshot = await getDocs(picksCollection)

      const weeklyStats: Record<string, { correct: number; total: number; isTopScore: boolean }> = {}
      let overallCorrect = 0
      let overallTotal = 0

      // Process each week's picks and fetch pre-calculated recap data
      for (const pickDoc of picksSnapshot.docs) {
        const weekData = pickDoc.data()
        const weekId = pickDoc.id // Format: "2024_week-1"

        let weekCorrect = 0
        let weekTotal = 0
        let isTopScore = false
        let isWeekFinished = false

        // Get week dates for fetching games to check if week is complete
        const [season, weekStr] = weekId.split('_')
        let weekNumber: number
        let weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl' = 'regular'
        let weekLabel: string | undefined = undefined
        
        // Handle regular weeks (week-X), preseason (preseason-X), pro bowl (pro-bowl-X — excluded from stats), and postseason
        if (weekStr.startsWith('week-')) {
          weekNumber = parseInt(weekStr.replace('week-', ''))
          weekType = 'regular'
        } else if (weekStr.startsWith('preseason-')) {
          weekNumber = parseInt(weekStr.replace('preseason-', ''))
          weekType = 'preseason'
        } else if (weekStr.startsWith('pro-bowl-')) {
          // Pro bowl is inconsequential for records; skip from user stats
          continue
        } else {
          // Check for postseason weeks (e.g., "wild-card", "divisional", "conference", "super-bowl")
          // These are stored with hyphens, so convert to spaces for normalization
          if (weekStr.includes('wild-card') || weekStr.includes('divisional') || weekStr.includes('conference') || weekStr.includes('super-bowl')) {
            weekType = 'postseason'
            // Convert "wild-card" -> "wild card" and normalize
            const weekStrWithSpaces = weekStr.replace(/-/g, ' ')
            weekLabel = normalizeRoundName(weekStrWithSpaces)
            console.log(`🏈 Postseason week detected: ${weekId}, label: "${weekLabel}", weekStr: "${weekStr}"`)
            // For postseason, we need to get the week number from the API
            // We'll fetch it when we get week info
            weekNumber = 0 // Will be set when we fetch week info
          } else {
            // Unknown format - try to parse as integer
            weekNumber = parseInt(weekStr) || 0
            if (weekNumber === 0) {
              console.warn(`⚠️ Unknown week format: ${weekStr}, skipping week ${weekId}`)
              continue
            }
          }
        }

        // Check if this is the current week
        // For postseason, we need to compare weekType, season, week number, AND label
        let isCurrentWeek = false
        if (weekInfo) {
          const seasonMatch = parseInt(season) === weekInfo.season
          const typeMatch = weekType === weekInfo.weekType
          
          if (seasonMatch && typeMatch) {
            if (weekType === 'postseason' && weekLabel && weekInfo.label) {
              // Both labels are already normalized, so compare directly
              const weekLabelNormalized = normalizeRoundName(weekLabel)
              const currentLabelNormalized = normalizeRoundName(weekInfo.label)
              isCurrentWeek = weekLabelNormalized === currentLabelNormalized
              if (weekType === 'postseason') {
                console.log(`🏈 Comparing postseason weeks: "${weekLabelNormalized}" === "${currentLabelNormalized}"? ${isCurrentWeek}`)
              }
            } else if (weekType !== 'postseason') {
              isCurrentWeek = weekNumber === weekInfo.week
            }
          }
        }

        // Simple rule: if it's the current week, skip it entirely
        if (isCurrentWeek) {
          continue
        } else {
          // Past weeks are considered finished
          isWeekFinished = true
        }

        // Only process stats for completed weeks
        // This ensures the current week is excluded from stats until all games are finished
        if (!isWeekFinished) {
          continue
        }

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
              console.log(`✅ Found pre-calculated recap for week ${weekId}, user ${userId}: ${weekCorrect}/${weekTotal}`)
            } else {
              console.warn(`⚠️ Week recap exists for ${weekId} but user ${userId} not found in stats, falling back to manual calculation`)
            }
          } else {
            console.warn(`⚠️ No week recap found for ${weekId}, falling back to manual calculation`)
          }
        } catch (error) {
          console.warn(`⚠️ Could not fetch pre-calculated recap for week ${weekId}, falling back to manual calculation:`, error)
        }

        // If no pre-calculated data, fall back to manual calculation
        if (weekTotal === 0) {
          // Use ESPN API to get actual week dates
          let weekInfo: { startDate: Date; endDate: Date } | null = null
          try {
            // For regular/postseason weeks, use getAllAvailableWeeks
            // For preseason, we need to use getWeekInfo directly
            if (weekType === 'preseason') {
              const weekInfoResult = await espnApi.getWeekInfo(parseInt(season), weekNumber)
              if (weekInfoResult && weekInfoResult.weekType === 'preseason') {
                weekInfo = { startDate: weekInfoResult.startDate, endDate: weekInfoResult.endDate }
              }
            } else {
              // Get all available weeks and find the one matching both week number and type
              const allWeeks = await espnApi.getAllAvailableWeeks(parseInt(season))
              let matchingWeek
              
              if (weekType === 'postseason' && weekLabel) {
                // For postseason, match by weekType and label
                const weekLabelNormalized = normalizeRoundName(weekLabel)
                console.log(`🔍 Looking for postseason week with label: "${weekLabelNormalized}"`)
                matchingWeek = allWeeks.find(w => {
                  if (w.weekType !== weekType || !w.label) return false
                  const wLabelNormalized = normalizeRoundName(w.label)
                  const match = wLabelNormalized === weekLabelNormalized
                  if (match) {
                    console.log(`✅ Found matching postseason week: ${w.week} (${w.label})`)
                  }
                  return match
                })
                // If we found a matching postseason week, update weekNumber
                if (matchingWeek) {
                  weekNumber = matchingWeek.week
                  console.log(`📊 Updated weekNumber to ${weekNumber} for postseason week ${weekId}`)
                } else {
                  console.warn(`⚠️ Could not find matching postseason week for label "${weekLabelNormalized}"`)
                }
              } else {
                // For regular season, match by week number and type
                matchingWeek = allWeeks.find(w => w.week === weekNumber && w.weekType === weekType)
              }
              
              if (matchingWeek) {
                weekInfo = { startDate: matchingWeek.startDate, endDate: matchingWeek.endDate }
              } else {
                // Fallback to getWeekInfo (only works for regular season weeks with numeric week numbers)
                if (weekType !== 'postseason' && weekNumber > 0) {
                  const weekInfoResult = await espnApi.getWeekInfo(parseInt(season), weekNumber)
                  if (weekInfoResult && weekInfoResult.weekType === weekType) {
                    weekInfo = { startDate: weekInfoResult.startDate, endDate: weekInfoResult.endDate }
                  }
                }
              }
            }
          } catch (error) {
            console.error(`❌ Error fetching week info for ${weekId}:`, error)
          }

          // If we couldn't get week info from API, skip this week
          if (!weekInfo) {
            console.warn(`⚠️ Could not get week info for ${weekId} (week ${weekNumber}, type ${weekType}), skipping manual calculation`)
            continue
          }

          // Fetch games for this week using the actual week dates
          let weekGames: any[] = []
          try {
            weekGames = await espnApi.getGamesForDateRange(weekInfo.startDate, weekInfo.endDate)
            console.log(`🎮 Fetched ${weekGames.length} games for week ${weekId} (${weekInfo.startDate.toISOString()} to ${weekInfo.endDate.toISOString()})`)
          } catch (error) {
            console.error(`❌ Error fetching games for ${weekId}:`, error)
            continue
          }

          // Filter to only finished games (matches dashboard logic)
          const playedGames = weekGames.filter(g => g.status === 'final' || g.status === 'post')
          weekTotal = playedGames.length

          // Count correct picks for finished games
          playedGames.forEach((game) => {
            const pick = weekData[game.id]?.pickedTeam
            if (pick) {
              const homeScore = Number(game.homeScore) || 0
              const awayScore = Number(game.awayScore) || 0
              const homeWon = homeScore > awayScore
              const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon)
              if (pickCorrect) {
                weekCorrect++
              }
            }
          })

          console.log(`📊 Manual calculation for week ${weekId}: ${weekCorrect}/${weekTotal}`)

          // For manual calculation, we can't determine top score without calculating for all users
          // So we'll set isTopScore to false and let the user know this data might be incomplete
          isTopScore = false
        }

        weeklyStats[weekId] = { correct: weekCorrect, total: weekTotal, isTopScore }
        overallCorrect += weekCorrect
        overallTotal += weekTotal
      }

      // Convert to sorted array format
      const weeklyArray = Object.entries(weeklyStats)
        .map(([weekId, stats]) => {
          // Extract week info from "2024_week-1", "2025_preseason-1", or "2024_wild-card" format
          const [season, weekStr] = weekId.split('_')
          let weekLabel: string
          let sortKey: number
          
          if (weekStr.includes('preseason-')) {
            const weekNumber = weekStr.match(/preseason-(\d+)/)?.[1] || '0'
            weekLabel = `Preseason ${weekNumber}`
            sortKey = -parseInt(weekNumber) // Negative for preseason (sorts before regular)
          } else if (weekStr.includes('pro-bowl')) {
            // Pro bowl excluded from stats; should not appear in list
            const weekNumber = weekStr.match(/pro-bowl-(\d+)/)?.[1] || '0'
            weekLabel = `Week ${weekNumber}`
            sortKey = -parseInt(weekNumber) - 100
          } else if (weekStr.includes('wild-card') || weekStr.includes('divisional') || weekStr.includes('conference') || weekStr.includes('super-bowl')) {
            // Postseason week - use the normalized label
            const normalized = normalizeRoundName(weekStr.replace(/-/g, ' '))
            weekLabel = normalized ? normalized.toUpperCase() : weekStr.toUpperCase()
            // Sort postseason after regular season (use high numbers)
            // wild-card = 100, divisional = 200, conference = 300, super-bowl = 400
            if (weekStr.includes('wild-card')) sortKey = 100
            else if (weekStr.includes('divisional')) sortKey = 200
            else if (weekStr.includes('conference')) sortKey = 300
            else if (weekStr.includes('super-bowl')) sortKey = 400
            else sortKey = 500
          } else {
            const weekNumber = weekStr.match(/week-(\d+)/)?.[1] || '0'
            weekLabel = `Week ${weekNumber}`
            sortKey = parseInt(weekNumber)
          }
          
          return {
            week: weekLabel,
            correct: stats.correct,
            total: stats.total,
            percentage: stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0,
            isTopScore: stats.isTopScore,
            sortKey
          }
        })
        .sort((a, b) => {
          // Sort by sortKey (most recent first)
          return b.sortKey - a.sortKey
        })
        .map(({ sortKey, ...rest }) => rest) // Remove sortKey from final output

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

      setStats(finalStats)
    } catch (error) {
      console.error('❌ Error fetching user stats:', error)
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen || !mappingsLoaded || !weekInfo) return null

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
          <div className="relative flex items-center justify-start gap-2">

                        {(() => {
              const teamStyle = superBowlTeam ? getTeamBackgroundAndLogo(superBowlTeam) : null
              return (
                <div
                  className="xl:w-20 xl:h-20 w-10 h-10 flex items-center justify-center p-1 aspect-square rounded-full shadow-[0_0_0_1px_#000000]"
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

            <h2 className="w-full font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-left leading-10 capitalize">
              {userName}
            </h2>

            {/* <div className="xl:text-4xl sm:text-2xl whitespace-nowrap">
            🔥🔥🔥
            </div> */}

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
                    <div className="w-full text-left leading-none">
                      {stats.overall.correct}/{stats.overall.total}
                    </div>
                    <div className="w-full text-left">
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
                  <div className="w-full text-left leading-none">
                    {week.correct}/{week.total}
                  </div>
                  <div className="w-full text-left">
                    <span className="inline-flex items-center justify-center gap-1">
                      {week.percentage}%
                      {week.isTopScore && (
                        <span title="Top Score" className="ml-0.5" role="img">🔥</span>
                      )}
                    </span>
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

                  {/* <h2 className="font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-center leading-10">Top 10 Movies</h2> */}

                  <h2 className="font-bold uppercase text-left max-xl:text-sm">Top 10 Movies</h2>



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