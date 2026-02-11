'use client'

import { useState } from 'react'
import { Navigation } from '@/components/navigation'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { espnApi } from '@/lib/espn-api'

export default function WeekRecapDebugPage() {
  const [weekIdInput, setWeekIdInput] = useState('2024_week-13')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any>(null)

  const checkWeek = async () => {
    if (!weekIdInput.trim()) {
      alert('Please enter a week ID (e.g., 2024_week-13)')
      return
    }

    setLoading(true)
    setResults(null)

    try {
      const [season, weekStr] = weekIdInput.trim().split('_')
      let weekNumber: number
      let weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl' = 'regular'
      
      if (weekStr.startsWith('week-')) {
        weekNumber = parseInt(weekStr.replace('week-', ''))
        weekType = 'regular'
      } else if (weekStr.startsWith('preseason-')) {
        weekNumber = parseInt(weekStr.replace('preseason-', ''))
        weekType = 'preseason'
      } else if (weekStr.startsWith('pro-bowl-')) {
        alert('Pro Bowl weeks are not included in recaps or stats')
        setLoading(false)
        return
      } else {
        alert(`Invalid week format: ${weekStr}`)
        setLoading(false)
        return
      }

      // Get week dates from API
      let weekInfo: { startDate: Date; endDate: Date } | null = null
      if (weekType === 'preseason') {
        const weekInfoResult = await espnApi.getWeekInfo(parseInt(season), weekNumber)
        if (weekInfoResult && weekInfoResult.weekType === 'preseason') {
          weekInfo = { startDate: weekInfoResult.startDate, endDate: weekInfoResult.endDate }
        }
      } else {
        const allWeeks = await espnApi.getAllAvailableWeeks(parseInt(season))
        const matchingWeek = allWeeks.find(w => w.week === weekNumber && w.weekType === weekType)
        if (matchingWeek) {
          weekInfo = { startDate: matchingWeek.startDate, endDate: matchingWeek.endDate }
        }
      }

      if (!weekInfo) {
        alert(`Could not find week ${weekIdInput} in ESPN API`)
        setLoading(false)
        return
      }

      // Fetch games from API
      const weekGames = await espnApi.getGamesForDateRange(weekInfo.startDate, weekInfo.endDate)
      const finishedGames = weekGames.filter(g => g.status === 'final' || g.status === 'post')
      const finishedGameIds = finishedGames.map(g => String(g.id))

      // Get all users and their picks
      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any)).filter((user: any) => user.displayName)

      // Get ALL week IDs that exist in picks collection for first user
      let allWeekIds: string[] = []
      if (users.length > 0) {
        try {
          const { collection: picksCollection, getDocs: getPicksDocs } = await import('firebase/firestore')
          const picksSnapshot = await getPicksDocs(picksCollection(db, 'users', users[0].id, 'picks'))
          allWeekIds = picksSnapshot.docs.map(doc => doc.id)
          console.log(`📋 Found ${allWeekIds.length} week IDs in picks for user ${users[0].id}:`, allWeekIds)
        } catch (error) {
          console.error('Error fetching week IDs:', error)
        }
      }

      // Generate alternative week ID formats to check
      const [requestedSeason, requestedWeekStr] = weekIdInput.trim().split('_')
      const requestedWeekNumberStr = requestedWeekStr.replace('week-', '').replace('preseason-', '')
      const alternativeWeekIds = [
        weekIdInput.trim(), // Original format
        `${parseInt(requestedSeason) + 1}_week-${requestedWeekNumberStr}`, // Next year
        `${parseInt(requestedSeason) - 1}_week-${requestedWeekNumberStr}`, // Previous year
        `${requestedSeason}_${requestedWeekNumberStr}`, // Without "week-" prefix
        `${parseInt(requestedSeason) + 1}_${requestedWeekNumberStr}`, // Next year without prefix
        `${parseInt(requestedSeason) - 1}_${requestedWeekNumberStr}`, // Previous year without prefix
      ].filter((id, idx, arr) => arr.indexOf(id) === idx) // Remove duplicates

      // Try to find picks using alternative week ID formats
      let foundWeekId: string | null = null
      let foundPicks: any = null
      let foundUser: string | null = null
      
      for (const altWeekId of alternativeWeekIds) {
        if (foundWeekId) break // Already found
        for (const user of users.slice(0, 5)) { // Check first 5 users
          try {
            const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', altWeekId))
            if (picksDoc.exists()) {
              foundWeekId = altWeekId
              foundPicks = picksDoc.data()
              foundUser = user.id
              console.log(`✅ Found picks for week ID: ${altWeekId} (user: ${user.id})`)
              break
            }
          } catch (error) {
            // Continue checking
          }
        }
      }

      // Get picks from ALL users using the found week ID (or requested one if not found)
      const weekIdToUse = foundWeekId || weekIdInput.trim()
      const userPicksData: Array<{ userId: string; displayName: string; pickGameIds: string[]; picks: any; weekIdExists: boolean; actualWeekId?: string }> = []
      for (const user of users) {
        // Use the found week ID if available, otherwise use requested
        const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekIdToUse))
        const weekIdExists = picksDoc.exists()
        
        if (weekIdExists) {
          const picks = picksDoc.data()
          const pickGameIds = Object.keys(picks).filter(key => key !== 'pickedTeam' && key !== 'pickedAt')
          userPicksData.push({
            userId: user.id,
            displayName: user.displayName || user.id,
            pickGameIds,
            picks,
            weekIdExists: true,
            actualWeekId: weekIdToUse
          })
        } else {
          userPicksData.push({
            userId: user.id,
            displayName: user.displayName || user.id,
            pickGameIds: [],
            picks: {},
            weekIdExists: false
          })
        }
      }

      // Compare game IDs - ensure consistent string conversion
      const allPickGameIds = new Set<string>()
      userPicksData.forEach(u => u.pickGameIds.forEach(id => allPickGameIds.add(String(id))))
      
      // Convert API game IDs to strings and normalize
      const normalizedApiIds = finishedGameIds.map(id => String(id))
      const normalizedPickIds = Array.from(allPickGameIds).map(id => String(id))
      
      const matchingIds = normalizedApiIds.filter(id => allPickGameIds.has(id))
      const apiOnlyIds = normalizedApiIds.filter(id => !allPickGameIds.has(id))
      const picksOnlyIds = normalizedPickIds.filter(id => !normalizedApiIds.includes(id))
      
      // Debug: Check for type mismatches
      const apiIdTypes = new Set(finishedGames.map(g => typeof g.id))
      const pickIdTypes = new Set(Array.from(allPickGameIds).map(id => typeof id))

      // Get sample game details with type information
      const sampleApiGames = finishedGames.slice(0, 5).map(g => ({
        id: String(g.id),
        idType: typeof g.id,
        idRaw: g.id,
        homeTeam: g.homeTeam?.abbreviation || '?',
        awayTeam: g.awayTeam?.abbreviation || '?',
        homeScore: g.homeScore,
        awayScore: g.awayScore,
        status: g.status,
        date: g.date
      }))

      // Get sample pick details with type information
      const samplePicks = userPicksData.filter(u => u.weekIdExists && u.pickGameIds.length > 0).length > 0 
        ? Object.entries(userPicksData.find(u => u.weekIdExists && u.pickGameIds.length > 0)!.picks)
          .filter(([key]) => key !== 'pickedTeam' && key !== 'pickedAt')
          .slice(0, 5)
          .map(([gameId, pick]: [string, any]) => ({
            gameId,
            gameIdType: typeof gameId,
            gameIdRaw: gameId,
            pickedTeam: pick?.pickedTeam || 'unknown'
          })) 
        : []

      setResults({
        weekId: weekIdInput.trim(),
        foundWeekId: foundWeekId,
        alternativeWeekIds: alternativeWeekIds,
        weekInfo: {
          startDate: weekInfo.startDate.toISOString(),
          endDate: weekInfo.endDate.toISOString()
        },
        allWeekIdsInPicks: allWeekIds,
        stats: {
          totalApiGames: weekGames.length,
          finishedGames: finishedGames.length,
          usersChecked: userPicksData.length,
          usersWithPicks: userPicksData.filter(u => u.weekIdExists).length,
          totalPickGameIds: allPickGameIds.size,
          matchingIds: matchingIds.length,
          matchRate: finishedGameIds.length > 0 ? `${matchingIds.length}/${finishedGameIds.length}` : '0/0'
        },
        gameIds: {
          apiGameIds: finishedGameIds,
          pickGameIds: Array.from(allPickGameIds),
          matchingIds,
          apiOnlyIds: apiOnlyIds.slice(0, 10),
          picksOnlyIds: picksOnlyIds.slice(0, 10),
          apiIdTypes: Array.from(apiIdTypes),
          pickIdTypes: Array.from(pickIdTypes)
        },
        sampleApiGames,
        samplePicks,
        userPicksData
      })

    } catch (error) {
      console.error('Error checking week:', error)
      alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 font-chakra">
      <Navigation />
      
      <div className="pt-20 px-8 max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Week Recap Debug Tool</h1>
        <p className="text-gray-600 mb-6">Check game ID matches before calculating recaps</p>
        
        <div className="space-y-4 mb-8">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="weekId" className="block text-sm font-bold mb-1">
                Week ID to Check:
              </label>
              <input
                id="weekId"
                type="text"
                value={weekIdInput}
                onChange={(e) => setWeekIdInput(e.target.value)}
                placeholder="e.g., 2024_week-13"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    checkWeek()
                  }
                }}
              />
            </div>
            <button
              onClick={checkWeek}
              disabled={loading || !weekIdInput.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {loading ? 'Checking...' : 'Check Week'}
            </button>
          </div>
        </div>

        {results && (
          <div className="space-y-6">
            {/* Summary */}
            <div className="bg-white p-6 rounded-lg border-2 border-black">
              <h2 className="text-2xl font-bold mb-4">Summary for {results.weekId}</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <div className="text-sm text-gray-600">API Games</div>
                  <div className="text-2xl font-bold">{results.stats.finishedGames}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Pick Game IDs</div>
                  <div className="text-2xl font-bold">{results.stats.totalPickGameIds}</div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Matching IDs</div>
                  <div className={`text-2xl font-bold ${results.stats.matchingIds === 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {results.stats.matchingIds}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-600">Match Rate</div>
                  <div className={`text-2xl font-bold ${results.stats.matchingIds === 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {results.stats.matchRate}
                  </div>
                </div>
              </div>
              
              {results.stats.matchingIds === 0 && results.stats.finishedGames > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                  <div className="font-bold text-red-800">⚠️ CRITICAL: Zero game IDs match!</div>
                  <div className="text-sm text-red-700 mt-2">
                    This means the game IDs in user picks don't match the game IDs from the ESPN API.
                    The calculation will fail until this is fixed.
                  </div>
                </div>
              )}
            </div>

            {/* Week Info */}
            <div className="bg-white p-4 rounded border border-gray-300">
              <h3 className="font-bold mb-2">Week Date Range:</h3>
              <div className="text-sm text-gray-600">
                Start: {new Date(results.weekInfo.startDate).toLocaleString()}<br />
                End: {new Date(results.weekInfo.endDate).toLocaleString()}
              </div>
            </div>

            {/* Week ID Mismatch Warning */}
            {results.foundWeekId && results.foundWeekId !== results.weekId && (
              <div className="bg-yellow-50 p-4 rounded-lg border-2 border-yellow-400">
                <div className="font-bold text-yellow-900 mb-2">⚠️ Week ID Mismatch Detected!</div>
                <div className="text-sm text-yellow-800 mb-2">
                  You requested: <code className="bg-yellow-100 px-1 rounded">{results.weekId}</code><br />
                  But picks were found under: <code className="bg-yellow-100 px-1 rounded">{results.foundWeekId}</code>
                </div>
                <button
                  onClick={() => {
                    setWeekIdInput(results.foundWeekId!)
                    setTimeout(() => checkWeek(), 100)
                  }}
                  className="mt-2 px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 font-bold"
                >
                  Check {results.foundWeekId} Instead
                </button>
              </div>
            )}

            {/* All Week IDs in Picks */}
            {results.allWeekIdsInPicks && results.allWeekIdsInPicks.length > 0 && (
              <div className="bg-white p-4 rounded border border-gray-300">
                <h3 className="font-bold mb-2">All Week IDs Found in Picks Collection:</h3>
                <div className="text-sm font-mono bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
                  {results.allWeekIdsInPicks.join(', ')}
                </div>
                {!results.allWeekIdsInPicks.includes(results.weekId) && !results.foundWeekId && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded">
                    <div className="text-red-800 font-bold">⚠️ Week ID "{results.weekId}" NOT FOUND in picks!</div>
                    <div className="text-sm text-red-700 mt-1">
                      Looking for: <code>{results.weekId}</code><br />
                      Found {results.allWeekIdsInPicks.length} week IDs, but none match.
                    </div>
                    {/* Show alternative formats checked */}
                    {results.alternativeWeekIds && results.alternativeWeekIds.length > 0 && (
                      <div className="mt-2 text-sm">
                        <div className="font-bold">🔍 Alternative formats checked:</div>
                        <div className="font-mono mt-1 text-xs">
                          {results.alternativeWeekIds.map((wid: string, idx: number) => (
                            <div key={idx} className={wid === results.foundWeekId ? 'text-green-600 font-bold' : ''}>
                              {wid === results.foundWeekId ? '✅ ' : '❌ '}{wid}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {/* Suggest similar week IDs */}
                    {(() => {
                      const [season, weekStr] = results.weekId.split('_')
                      const weekNum = weekStr.replace('week-', '').replace('preseason-', '')
                      const similarWeeks = results.allWeekIdsInPicks.filter((wid: string) => {
                        const [wSeason, wWeekStr] = wid.split('_')
                        const wWeekNum = wWeekStr.replace('week-', '').replace('preseason-', '')
                        return weekNum === wWeekNum || wid.includes(weekNum)
                      })
                      return similarWeeks.length > 0 ? (
                        <div className="mt-2 text-sm">
                          <div className="font-bold">💡 Similar week IDs found (click to check):</div>
                          <div className="font-mono mt-1">
                            {similarWeeks.map((wid: string, idx: number) => (
                              <div key={idx} className="cursor-pointer hover:underline text-blue-600" onClick={() => {
                                setWeekIdInput(wid)
                                setTimeout(() => checkWeek(), 100)
                              }}>
                                {wid}
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null
                    })()}
                  </div>
                )}
              </div>
            )}

            {/* Users with/without picks */}
            {results.stats.usersWithPicks !== undefined && (
              <div className="bg-white p-4 rounded border border-gray-300">
                <h3 className="font-bold mb-2">Users Checked:</h3>
                <div className="text-sm">
                  {results.stats.usersWithPicks} users have picks for this week<br />
                  {results.stats.usersChecked - results.stats.usersWithPicks} users don't have picks for this week
                </div>
              </div>
            )}

            {/* Game ID Comparison */}
            <div className="bg-white p-6 rounded-lg border border-gray-300">
              <h3 className="text-xl font-bold mb-4">Game ID Comparison</h3>
              
              {/* Type mismatch warning */}
              {results.gameIds.apiIdTypes && results.gameIds.pickIdTypes && 
               (results.gameIds.apiIdTypes.some((t: string) => t !== 'string') || 
                results.gameIds.pickIdTypes.some((t: string) => t !== 'string')) && (
                <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <div className="font-bold text-yellow-800">⚠️ Type Mismatch Detected</div>
                  <div className="text-sm text-yellow-700 mt-1">
                    API ID types: {results.gameIds.apiIdTypes.join(', ')}<br />
                    Pick ID types: {results.gameIds.pickIdTypes.join(', ')}
                  </div>
                </div>
              )}
              
              {results.gameIds.apiOnlyIds.length > 0 && (
                <div className="mb-4">
                  <div className="font-bold text-orange-600 mb-2">
                    API Game IDs NOT in Picks ({results.gameIds.apiOnlyIds.length}):
                  </div>
                  <div className="text-sm font-mono bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
                    {results.gameIds.apiOnlyIds.join(', ')}
                  </div>
                </div>
              )}

              {results.gameIds.picksOnlyIds.length > 0 && (
                <div className="mb-4">
                  <div className="font-bold text-orange-600 mb-2">
                    Pick Game IDs NOT in API ({results.gameIds.picksOnlyIds.length}):
                  </div>
                  <div className="text-sm font-mono bg-gray-100 p-2 rounded max-h-40 overflow-y-auto">
                    {results.gameIds.picksOnlyIds.join(', ')}
                  </div>
                </div>
              )}

              {results.gameIds.matchingIds.length > 0 && (
                <div>
                  <div className="font-bold text-green-600 mb-2">
                    Matching Game IDs ({results.gameIds.matchingIds.length}):
                  </div>
                  <div className="text-sm font-mono bg-green-50 p-2 rounded max-h-40 overflow-y-auto">
                    {results.gameIds.matchingIds.slice(0, 20).join(', ')}
                    {results.gameIds.matchingIds.length > 20 && ` ... and ${results.gameIds.matchingIds.length - 20} more`}
                  </div>
                </div>
              )}
              
              {results.gameIds.matchingIds.length === 0 && results.stats.finishedGames > 0 && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded">
                  <div className="font-bold text-red-800">🔍 Troubleshooting Tips:</div>
                  <ul className="text-sm text-red-700 mt-2 list-disc list-inside space-y-1">
                    <li>Check if the week ID format matches (e.g., 2024_week-2 vs 2024_2)</li>
                    <li>Verify the year matches between the week ID and the picks collection</li>
                    <li>Check if game IDs are stored as numbers vs strings in picks</li>
                    <li>Compare sample API game IDs with sample pick game IDs above</li>
                    <li>Ensure users have picks for this specific week ID</li>
                  </ul>
                </div>
              )}
            </div>

            {/* Sample API Games */}
            <div className="bg-white p-6 rounded-lg border border-gray-300">
              <h3 className="text-xl font-bold mb-4">Sample API Games (First 5)</h3>
              {results.gameIds.apiIdTypes && results.gameIds.apiIdTypes.length > 0 && (
                <div className="mb-2 text-sm text-gray-600">
                  API Game ID Types: {results.gameIds.apiIdTypes.join(', ')}
                </div>
              )}
              <div className="space-y-2">
                {results.sampleApiGames.map((game: any, idx: number) => (
                  <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                    <div className="font-mono text-sm">
                      <div><strong>ID:</strong> {game.id} (raw: {String(game.idRaw)}, type: {game.idType})</div>
                      <div><strong>Game:</strong> {game.awayTeam} @ {game.homeTeam}</div>
                      <div><strong>Score:</strong> {game.awayScore} - {game.homeScore}</div>
                      <div><strong>Status:</strong> {game.status}</div>
                      <div><strong>Date:</strong> {new Date(game.date).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Sample Picks */}
            {results.samplePicks.length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h3 className="text-xl font-bold mb-4">Sample User Picks (First User with Picks, First 5)</h3>
                {results.gameIds.pickIdTypes && results.gameIds.pickIdTypes.length > 0 && (
                  <div className="mb-2 text-sm text-gray-600">
                    Pick Game ID Types: {results.gameIds.pickIdTypes.join(', ')}
                  </div>
                )}
                <div className="space-y-2">
                  {results.samplePicks.map((pick: any, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="font-mono text-sm">
                        <div><strong>Game ID:</strong> {pick.gameId} (raw: {String(pick.gameIdRaw)}, type: {pick.gameIdType})</div>
                        <div><strong>Picked:</strong> {pick.pickedTeam}</div>
                        {/* Check if this ID exists in API */}
                        {results.gameIds.apiGameIds.includes(pick.gameId) ? (
                          <div className="text-green-600">✅ Matches API game ID</div>
                        ) : (
                          <div className="text-red-600">❌ NOT found in API game IDs</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* User Picks Summary */}
            {results.userPicksData.length > 0 && (
              <div className="bg-white p-6 rounded-lg border border-gray-300">
                <h3 className="text-xl font-bold mb-4">User Picks Summary</h3>
                <div className="space-y-2">
                  {results.userPicksData.map((user: any, idx: number) => (
                    <div key={idx} className="p-3 bg-gray-50 rounded border border-gray-200">
                      <div className="font-bold">{user.displayName}</div>
                      <div className="text-sm text-gray-600">
                        {user.pickGameIds.length} picks: {user.pickGameIds.slice(0, 5).join(', ')}
                        {user.pickGameIds.length > 5 && ` ... and ${user.pickGameIds.length - 5} more`}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

