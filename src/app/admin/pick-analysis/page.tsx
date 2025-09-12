'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, getDocs } from 'firebase/firestore'
import { formatTeamMatchup, getPickedTeamName } from '@/utils/pick-enrichment'

interface EnrichedPick {
  pickedTeam: 'home' | 'away'
  pickedAt: any
  homeTeam?: {
    id: string
    name: string
    abbreviation: string
    city: string
  }
  awayTeam?: {
    id: string
    name: string
    abbreviation: string
    city: string
  }
  gameDate?: string
  gameStatus?: string
}

interface UserPicks {
  [gameId: string]: EnrichedPick
}

interface User {
  id: string
  displayName?: string
  email?: string
}

export default function PickAnalysisPage() {
  const { user } = useAuthStore()
  const [season, setSeason] = useState('2025')
  const [week, setWeek] = useState('1')
  const [users, setUsers] = useState<User[]>([])
  const [userPicks, setUserPicks] = useState<Record<string, UserPicks>>({})
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load users and their picks
  useEffect(() => {
    if (!user) return

    const loadData = async () => {
      setLoading(true)
      setError(null)

      try {
        // Get all users
        const usersSnapshot = await getDocs(collection(db, 'users'))
        const usersList = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as User[]
        setUsers(usersList)

        // Get picks for each user
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

      } catch (err) {
        setError('Failed to load data')
        console.error('Error loading data:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [user, season, week])

  // Get all unique game IDs from all users' picks
  const getAllGameIds = (): string[] => {
    const gameIds = new Set<string>()
    Object.values(userPicks).forEach(picks => {
      Object.keys(picks).forEach(gameId => {
        if (gameId !== 'pickedTeam' && gameId !== 'pickedAt') {
          gameIds.add(gameId)
        }
      })
    })
    return Array.from(gameIds).sort()
  }

  // Get picks for a specific game
  const getGamePicks = (gameId: string): Array<{ user: User, pick: EnrichedPick }> => {
    const gamePicks: Array<{ user: User, pick: EnrichedPick }> = []
    
    users.forEach(user => {
      const pick = userPicks[user.id]?.[gameId]
      if (pick) {
        gamePicks.push({ user, pick })
      }
    })
    
    return gamePicks
  }

  // Check if picks are enriched with team data
  const isEnriched = (pick: EnrichedPick): boolean => {
    return !!(pick.homeTeam && pick.awayTeam)
  }

  const gameIds = getAllGameIds()
  const enrichedCount = gameIds.filter(gameId => {
    const picks = getGamePicks(gameId)
    return picks.length > 0 && isEnriched(picks[0].pick)
  }).length

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-100 p-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Pick Analysis</h1>
          <p className="text-gray-600">Please sign in to view pick analysis.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Pick Analysis</h1>
        
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
              <input
                type="text"
                value={week}
                onChange={(e) => setWeek(e.target.value)}
                className="border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div className="mt-6">
              <button
                onClick={() => window.location.reload()}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Summary */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-blue-50 p-4 rounded">
              <div className="text-2xl font-bold text-blue-600">{gameIds.length}</div>
              <div className="text-sm text-gray-600">Total Games</div>
            </div>
            <div className="bg-green-50 p-4 rounded">
              <div className="text-2xl font-bold text-green-600">{enrichedCount}</div>
              <div className="text-sm text-gray-600">Enriched Games</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded">
              <div className="text-2xl font-bold text-yellow-600">{gameIds.length - enrichedCount}</div>
              <div className="text-sm text-gray-600">Missing Team Data</div>
            </div>
            <div className="bg-purple-50 p-4 rounded">
              <div className="text-2xl font-bold text-purple-600">{users.length}</div>
              <div className="text-sm text-gray-600">Users</div>
            </div>
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="text-gray-600">Loading pick data...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <div className="text-red-800">{error}</div>
          </div>
        )}

        {/* Games List */}
        {!loading && (
          <div className="space-y-4">
            {gameIds.map(gameId => {
              const picks = getGamePicks(gameId)
              const samplePick = picks[0]?.pick
              const isGameEnriched = samplePick ? isEnriched(samplePick) : false
              
              return (
                <div key={gameId} className="bg-white rounded-lg shadow p-6">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">Game ID: {gameId}</h3>
                      {isGameEnriched && samplePick ? (
                        <div className="text-gray-600">
                          {formatTeamMatchup(samplePick)}
                          {samplePick.gameDate && (
                            <span className="ml-2 text-sm">
                              ({new Date(samplePick.gameDate).toLocaleDateString()})
                            </span>
                          )}
                        </div>
                      ) : (
                        <div className="text-yellow-600 text-sm">
                          ⚠️ Team data not available - run enrichment script
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-500">
                      {picks.length} pick{picks.length !== 1 ? 's' : ''}
                    </div>
                  </div>

                  {/* Picks for this game */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {picks.map(({ user, pick }) => (
                      <div key={user.id} className="border rounded p-3 bg-gray-50">
                        <div className="font-medium text-sm">
                          {user.displayName || user.email || user.id}
                        </div>
                        <div className="text-sm text-gray-600">
                          Picked: <span className="font-medium">{getPickedTeamName(pick)}</span>
                        </div>
                        {pick.pickedAt && (
                          <div className="text-xs text-gray-500">
                            {new Date(pick.pickedAt.toDate?.() || pick.pickedAt).toLocaleString()}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {!loading && gameIds.length === 0 && (
          <div className="text-center py-8">
            <div className="text-gray-600">No picks found for {season} Week {week}</div>
          </div>
        )}
      </div>
    </div>
  )
}
