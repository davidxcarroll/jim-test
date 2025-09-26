'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { getSeasonAndWeek, dateHelpers } from '@/utils/date-helpers'
import { espnApi } from '@/lib/espn-api'
import { useCurrentWeek } from '@/hooks/use-current-week'
import { useGamesForWeek } from '@/hooks/use-nfl-data'

interface User {
  id: string
  displayName?: string
  email?: string
}

interface Game {
  id: string
  date: string
  homeTeam: {
    abbreviation: string
    name: string
  }
  awayTeam: {
    abbreviation: string
    name: string
  }
  status: string
}

interface Pick {
  pickedTeam: 'home' | 'away'
  pickedAt: any
  homeTeam?: any
  awayTeam?: any
}

interface UserPicks {
  [gameId: string]: Pick
}

export default function AdminPicksPage() {
  const { user } = useAuthStore()
  const { currentWeek: apiCurrentWeek, weekInfo, loading: weekLoading, error: weekError } = useCurrentWeek()
  const [weekOffset, setWeekOffset] = useState(0)
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false)
  const [users, setUsers] = useState<User[]>([])
  const [userPicks, setUserPicks] = useState<Record<string, UserPicks>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Calculate week data based on the selected week offset (same as dashboard)
  const getWeekData = (offset: number) => {
    if (weekInfo) {
      // Use ESPN API data for current week, calculate for past weeks
      const targetWeekNumber = weekInfo.week - offset
      const targetWeekStart = new Date(weekInfo.startDate.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      const targetWeekEnd = new Date(weekInfo.endDate.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      
      return {
        start: targetWeekStart,
        end: targetWeekEnd,
        season: String(weekInfo.season),
        week: weekInfo.weekType === 'preseason' ? `preseason-${targetWeekNumber}` : `week-${targetWeekNumber}`,
        weekNumber: targetWeekNumber
      }
    } else {
      // Fallback calculation if ESPN API is unavailable
      const today = new Date()
      const fallbackWeekStart = new Date(today.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      const fallbackWeekEnd = new Date(fallbackWeekStart.getTime() + (6 * 24 * 60 * 60 * 1000))
      
      return {
        start: fallbackWeekStart,
        end: fallbackWeekEnd,
        season: '2025',
        week: `week-${2 - offset}`, // Fallback to week 2
        weekNumber: 2 - offset
      }
    }
  }

  const currentWeekData = useMemo(() => {
    console.log('📅 Admin picks: Calculating week data for offset:', weekOffset, 'weekInfo:', weekInfo)
    return getWeekData(weekOffset)
  }, [weekOffset, weekInfo])
  
  const { data: games, isLoading: gamesLoading } = useGamesForWeek(currentWeekData.start, currentWeekData.end)

  // Debug logging for games and week data
  useEffect(() => {
    console.log('🎮 Admin picks: Games data changed:', {
      games: games?.length || 0,
      gamesLoading,
      weekData: currentWeekData,
      weekOffset
    })
  }, [games, gamesLoading, currentWeekData, weekOffset])

  // Get available weeks (same logic as dashboard)
  const getAvailableWeeks = () => {
    const weeks: Array<{ index: number; weekNumber: number; isCurrentPreseason: boolean; weekKey: string }> = []
    const today = new Date()
    const isWednesday = dateHelpers.isNewWeekDay(today)

    // If we have ESPN API data, use it for the current week
    if (weekInfo) {
      // Show current week + up to 4 past weeks
      const maxWeeksToShow = 5
      
      for (let i = 0; i < maxWeeksToShow; i++) {
        // Calculate the week number for this iteration
        const weekNumber = weekInfo.week - i
        
        // Only show weeks that are current or in the past (positive week numbers)
        if (weekNumber > 0) {
          // Determine if this is the current week
          const isCurrentWeek = i === 0
          const isPastWeek = i > 0
          
          // Current week should be available if it's Wednesday or later
          const shouldShowCurrentWeek = isCurrentWeek && (isWednesday || weekInfo.startDate <= today)
          
          if (shouldShowCurrentWeek || isPastWeek) {
            const weekKey = weekInfo.weekType === 'preseason' ? `preseason-${weekNumber}` : `week-${weekNumber}`
            weeks.push({
              index: i,
              weekNumber,
              isCurrentPreseason: weekInfo.weekType === 'preseason',
              weekKey: `${weekInfo.season}_${weekKey}`
            })
          }
        }
      }
    } else {
      // Fallback: if ESPN API is unavailable, show a basic week structure
      const maxWeeksToShow = 5
      for (let i = 0; i < maxWeeksToShow; i++) {
        const weekNumber = 2 - i // Fallback to week 2
        if (weekNumber > 0) {
          weeks.push({
            index: i,
            weekNumber,
            isCurrentPreseason: false,
            weekKey: `2025_week-${weekNumber}`
          })
        }
      }
    }

    return weeks
  }

  const availableWeeks = getAvailableWeeks()

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.week-selector')) {
        setIsWeekDropdownOpen(false)
      }
    }

    if (isWeekDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isWeekDropdownOpen])

  // Load data when week changes
  useEffect(() => {
    if (!user) return
    console.log('🔄 Admin picks: Loading data for week:', currentWeekData)
    loadData()
  }, [user, currentWeekData.season, currentWeekData.week, currentWeekData.start, currentWeekData.end])

  const loadData = async () => {
    console.log('🔄 Admin picks: Starting loadData for week:', currentWeekData)
    setLoading(true)
    setMessage(null)

    try {
      // Load users
      console.log('📊 Admin picks: Loading users...')
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[]
      console.log('👥 Admin picks: Loaded users:', usersList.length)
      setUsers(usersList)

      // Load picks for each user using the current week data
      console.log('🎯 Admin picks: Loading picks for week key:', `${currentWeekData.season}_${currentWeekData.week}`)
      const picksPromises = usersList.map(async (user) => {
        const weekKey = `${currentWeekData.season}_${currentWeekData.week}`
        const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekKey))
        return {
          userId: user.id,
          picks: picksDoc.exists() ? picksDoc.data() as UserPicks : {}
        }
      })

      const picksResults = await Promise.all(picksPromises)
      const picksMap: Record<string, UserPicks> = {}
      picksResults.forEach(result => {
        picksMap[result.userId] = result.picks
      })
      console.log('🎯 Admin picks: Loaded picks for users:', Object.keys(picksMap).length)
      setUserPicks(picksMap)

    } catch (error) {
      console.error('❌ Admin picks: Error loading data:', error)
      setMessage({ text: 'Failed to load data', type: 'error' })
    } finally {
      console.log('✅ Admin picks: Finished loadData')
      setLoading(false)
    }
  }


  const handlePickChange = async (userId: string, gameId: string, newPick: 'home' | 'away' | '') => {
    if (!user) return

    setSaving(true)
    setMessage(null)

    try {
      const currentPicks = userPicks[userId] || {}
      let updatedPicks = { ...currentPicks }

      if (newPick === '') {
        // Remove the pick
        delete updatedPicks[gameId]
      } else {
        // Update the pick
        updatedPicks[gameId] = {
          ...currentPicks[gameId],
          pickedTeam: newPick,
          pickedAt: new Date()
        }
      }

      // Update local state
      setUserPicks(prev => ({
        ...prev,
        [userId]: updatedPicks
      }))

      // Save to database
      const weekKey = `${currentWeekData.season}_${currentWeekData.week}`
      await setDoc(doc(db, 'users', userId, 'picks', weekKey), updatedPicks, { merge: true })

      setMessage({ text: 'Pick updated successfully', type: 'success' })

    } catch (error) {
      setMessage({ text: 'Failed to update pick', type: 'error' })
      console.error('Error updating pick:', error)
    } finally {
      setSaving(false)
    }
  }

  const formatGameDisplay = (game: Game) => {
    if (game.homeTeam && game.awayTeam) {
      return `${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`
    }
    return `Game ${game.id}`
  }

  const formatGameDate = (game: Game) => {
    try {
      return new Date(game.date).toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric' 
      })
    } catch {
      return ''
    }
  }

  const getCurrentPick = (userId: string, gameId: string): 'home' | 'away' | '' => {
    const pick = userPicks[userId]?.[gameId]
    return pick?.pickedTeam || ''
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Admin Picks Management</h1>
          <p className="text-gray-600">Please sign in to access admin functions.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-100 font-chakra">
      <div className="">
        <h1 className="text-2xl font-bold text-black p-6 uppercase">Admin Picks Management</h1>
        
        {/* Controls */}
        <div className="bg-white shadow-[inset_0_1px_0_0_#000000,inset_0_-1px_0_0_#000000] p-6 mb-6">
          <div className="flex gap-4 items-center">
            <div className="week-selector relative">
              <label className="block text-sm font-medium text-black mb-1 uppercase">Week</label>
              <div
                className="border-[1px] border-black px-3 py-2 cursor-pointer hover:bg-black hover:text-white flex items-center justify-between min-w-[120px] font-bold uppercase"
                onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
              >
                <span className="font-medium">
                  {(() => {
                    const currentWeek = availableWeeks.find(w => w.index === weekOffset)
                    if (currentWeek) {
                      if (currentWeek.isCurrentPreseason) {
                        return `PRESEASON ${currentWeek.weekNumber}`
                      } else {
                        return `WEEK ${currentWeek.weekNumber}`
                      }
                    }
                    return 'Select Week'
                  })()}
                </span>
                <span className={`material-symbols-sharp transition-transform ${isWeekDropdownOpen ? 'rotate-180' : ''}`}>
                  arrow_drop_down
                </span>
              </div>
              
              {/* Dropdown overlay */}
              {isWeekDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white shadow-[inset_0_0_0_1px_#000000] z-50 max-h-60 overflow-y-auto">
                  {availableWeeks.map((weekInfo) => (
                    <div
                      key={weekInfo.index}
                      className={`px-3 py-2 cursor-pointer hover:bg-black hover:text-white font-bold uppercase ${
                        weekInfo.index === weekOffset ? 'bg-black/10' : ''
                      }`}
                      onClick={() => {
                        setWeekOffset(weekInfo.index)
                        setIsWeekDropdownOpen(false)
                      }}
                    >
                      {(() => {
                        // Handle preseason vs regular season week display
                        let weekDisplay
                        if (weekInfo.isCurrentPreseason) {
                          weekDisplay = `PRESEASON ${weekInfo.weekNumber}`
                        } else {
                          weekDisplay = `WEEK ${weekInfo.weekNumber}`
                        }
                        return weekDisplay
                      })()}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="mt-6">
              <button
                onClick={loadData}
                disabled={loading || gamesLoading}
                className="bg-black text-white px-4 py-2 hover:bg-white hover:text-black border-[1px] border-black font-bold uppercase disabled:opacity-50"
              >
                {loading || gamesLoading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 shadow-[inset_0_0_0_1px_#000000] font-bold uppercase ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Picks Table */}
        {loading || gamesLoading ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">Loading picks data...</div>
            <div className="text-sm text-black mt-2 font-bold uppercase">
              Loading: {loading ? 'Yes' : 'No'} | Games Loading: {gamesLoading ? 'Yes' : 'No'}
            </div>
            <div className="text-xs text-black mt-1 font-bold uppercase">
              Week: {currentWeekData.season} {currentWeekData.week} | Games: {games?.length || 0}
            </div>
          </div>
        ) : !games || games.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-black font-bold uppercase">No games found for {currentWeekData.season} {currentWeekData.week}</div>
            <div className="text-sm text-black mt-2 font-bold uppercase">
              This may be a preseason week or the week hasn't been scheduled yet
            </div>
          </div>
        ) : (
          <div className="bg-white shadow-[inset_0_0_0_1px_#000000] overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-black">
                <thead className="bg-neutral-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Game
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-bold text-black uppercase tracking-wider">
                      Date
                    </th>
                    {users.map(user => (
                      <th key={user.id} className="px-4 py-3 text-center text-xs font-bold text-black uppercase tracking-wider">
                        {user.displayName || user.email || user.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-black">
                  {games.map(game => (
                    <tr key={game.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black uppercase">
                        {formatGameDisplay(game)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-black uppercase">
                        {formatGameDate(game)}
                      </td>
                      {users.map(user => (
                        <td key={user.id} className="px-4 py-4 whitespace-nowrap text-center">
                          <select
                            value={getCurrentPick(user.id, game.id)}
                            onChange={(e) => handlePickChange(user.id, game.id, e.target.value as 'home' | 'away' | '')}
                            disabled={saving}
                            className="border-[1px] border-black px-2 py-1 text-sm font-bold uppercase disabled:opacity-50"
                          >
                            <option value="">--</option>
                            <option value="away">{game.awayTeam?.abbreviation || 'Away'}</option>
                            <option value="home">{game.homeTeam?.abbreviation || 'Home'}</option>
                          </select>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Summary */}
        {games && games.length > 0 && (
          <div className="mt-6 text-sm text-black font-bold uppercase">
            <p>Showing {games.length} games for {users.length} users in {currentWeekData.season} {currentWeekData.week}</p>
            {saving && <p className="text-black font-bold uppercase">Saving changes...</p>}
          </div>
        )}
      </div>
    </div>
  )
}
