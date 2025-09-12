'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'
import { getCurrentWeekStart, getSeasonAndWeek, dateHelpers } from '@/utils/date-helpers'
import { espnApi } from '@/lib/espn-api'

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
  const [season, setSeason] = useState('2025')
  const [week, setWeek] = useState('1')
  const [users, setUsers] = useState<User[]>([])
  const [games, setGames] = useState<Game[]>([])
  const [userPicks, setUserPicks] = useState<Record<string, UserPicks>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Generate week options (1-18 for NFL season)
  const weekOptions = Array.from({ length: 18 }, (_, i) => i + 1)

  // Load data when season/week changes
  useEffect(() => {
    if (!user) return
    loadData()
  }, [user, season, week])

  const loadData = async () => {
    setLoading(true)
    setMessage(null)

    try {
      // Load users
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const usersList = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[]
      setUsers(usersList)

      // Load games for the week (you'll need to implement this based on your game loading logic)
      // For now, we'll create a placeholder - you may need to adapt this to your existing game loading
      const gamesList = await loadGamesForWeek(season, week)
      setGames(gamesList)

      // Load picks for each user
      const picksPromises = usersList.map(async (user) => {
        const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', `${season}_${week}`))
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
      setUserPicks(picksMap)

    } catch (error) {
      setMessage({ text: 'Failed to load data', type: 'error' })
      console.error('Error loading data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Load games for a specific week using existing ESPN API logic
  const loadGamesForWeek = async (season: string, week: string): Promise<Game[]> => {
    try {
      // Convert season and week to date range
      const seasonYear = parseInt(season)
      const weekNumber = parseInt(week)
      
      // Calculate the start date for the week (assuming Tuesday start like your system)
      const seasonStart = new Date(`${seasonYear}-09-04`) // NFL season typically starts early September
      const weekStartDate = new Date(seasonStart.getTime() + (weekNumber - 1) * 7 * 24 * 60 * 60 * 1000)
      
      // Get the Tuesday week range for this date
      const { start, end } = dateHelpers.getTuesdayWeekRange(weekStartDate)
      
      // Use the existing ESPN API to get games
      const games = await espnApi.getGamesForDateRange(start, end)
      
      return games
    } catch (error) {
      console.error('Error loading games for week:', error)
      return []
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
      await setDoc(doc(db, 'users', userId, 'picks', `${season}_${week}`), updatedPicks, { merge: true })

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
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Admin Picks Management</h1>
        
        {/* Controls */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex gap-4 items-center">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Season</label>
              <input
                type="text"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Week</label>
              <select
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              >
                {weekOptions.map(w => (
                  <option key={w} value={w.toString()}>Week {w}</option>
                ))}
              </select>
            </div>
            <div className="mt-6">
              <button
                onClick={loadData}
                disabled={loading}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {loading ? 'Loading...' : 'Refresh'}
              </button>
            </div>
          </div>
        </div>

        {/* Message */}
        {message && (
          <div className={`mb-4 p-4 rounded ${
            message.type === 'success' ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Picks Table */}
        {loading ? (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading picks data...</div>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-gray-600">No games found for {season} Week {week}</div>
            <div className="text-sm text-gray-500 mt-2">
              You may need to implement the loadGamesForWeek function
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Game
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    {users.map(user => (
                      <th key={user.id} className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {user.displayName || user.email || user.id}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {games.map(game => (
                    <tr key={game.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatGameDisplay(game)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {formatGameDate(game)}
                      </td>
                      {users.map(user => (
                        <td key={user.id} className="px-4 py-4 whitespace-nowrap text-center">
                          <select
                            value={getCurrentPick(user.id, game.id)}
                            onChange={(e) => handlePickChange(user.id, game.id, e.target.value as 'home' | 'away' | '')}
                            disabled={saving}
                            className="border border-gray-300 rounded px-2 py-1 text-sm disabled:opacity-50"
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
        {games.length > 0 && (
          <div className="mt-6 text-sm text-gray-600">
            <p>Showing {games.length} games for {users.length} users in {season} Week {week}</p>
            {saving && <p className="text-blue-600">Saving changes...</p>}
          </div>
        )}
      </div>
    </div>
  )
}
