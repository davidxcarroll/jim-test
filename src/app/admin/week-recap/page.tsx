'use client'

import { useState } from 'react'
import { Navigation } from '@/components/navigation'
import { getWeekKey } from '@/utils/date-helpers'

export default function WeekRecapAdminPage() {
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<any[]>([])
  const [weekIdInput, setWeekIdInput] = useState('')
  const [seasonInput, setSeasonInput] = useState('')
  const [forceRecalc, setForceRecalc] = useState(false)

  const calculateWeekRecap = async (weekOffset?: number, weekId?: string, force: boolean = false, keepLoading: boolean = false) => {
    if (!keepLoading) {
      setLoading(true)
    }
    try {
      const body: any = { force }
      if (weekId) {
        body.weekId = weekId
      } else if (weekOffset !== undefined) {
        body.weekOffset = weekOffset
      } else {
        throw new Error('Must provide either weekOffset or weekId')
      }

      const response = await fetch('/api/week-recap/calculate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      
      const result = await response.json()
      const resultKey = weekId || `weekOffset-${weekOffset}`
      
      // Log debug info to browser console
      if (result.debug) {
        console.log(`🔍 Debug for ${result.weekId}:`, result.debug)
      }
      if (result.gameIdMatchInfo) {
        console.log(`🔍 Game ID Match Info for ${result.weekId}:`, result.gameIdMatchInfo)
        if (result.gameIdMatchInfo.matchingIds === 0 && result.gameIdMatchInfo.finishedGameIds > 0) {
          console.error(`❌ ${result.weekId}: ZERO game IDs match! Pick IDs:`, result.gameIdMatchInfo.samplePickIds, 'API IDs:', result.gameIdMatchInfo.sampleApiIds)
        }
      }
      if (result.usersWithCorrectPicks === 0 && result.userCount > 0 && result.totalGames > 0) {
        console.warn(`⚠️ ${result.weekId}: ${result.userCount} users but 0 correct picks! Check game IDs match.`)
      }
      
      setResults(prev => [...prev, { key: resultKey, weekId: weekId || result.weekId, weekOffset, ...result, timestamp: new Date().toISOString() }])
      return result
    } catch (error) {
      console.error('Error calculating week recap:', error)
      const resultKey = weekId || `weekOffset-${weekOffset}`
      setResults(prev => [...prev, { key: resultKey, weekId, weekOffset, success: false, error: 'Request failed', timestamp: new Date().toISOString() }])
      throw error
    } finally {
      if (!keepLoading) {
        setLoading(false)
      }
    }
  }

  const calculateByWeekId = async () => {
    if (!weekIdInput.trim()) {
      alert('Please enter a week ID (e.g., 2024_week-13)')
      return
    }
    await calculateWeekRecap(undefined, weekIdInput.trim(), forceRecalc)
    setWeekIdInput('')
  }

  const calculateAllWeeks = async () => {
    setLoading(true)
    setResults([])
    
    // Calculate recaps for the last 5 weeks
    for (let i = 0; i < 5; i++) {
      try {
        await calculateWeekRecap(i, undefined, forceRecalc)
        // Small delay between requests
        await new Promise(resolve => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`Error calculating week ${i} recap:`, error)
      }
    }
    
    setLoading(false)
  }

  const recalculateAllWeeksForSeason = async () => {
    if (!seasonInput.trim()) {
      alert('Please enter a season year (e.g., 2024)')
      return
    }

    const season = parseInt(seasonInput.trim())
    if (isNaN(season) || season < 2000 || season > 2100) {
      alert('Please enter a valid season year (e.g., 2024)')
      return
    }

    setLoading(true)
    setResults([])

    try {
      // Fetch all available weeks for this season from ESPN API
      const { espnApi } = await import('@/lib/espn-api')
      const allWeeks = await espnApi.getAllAvailableWeeks(season)
      
      if (allWeeks.length === 0) {
        alert(`No weeks found for season ${season}`)
        setLoading(false)
        return
      }

      const today = new Date()
      let processedCount = 0
      let successCount = 0
      let failCount = 0

      // Process each week (dedupe by weekId so we don't process or show the same week twice)
      const seenWeekIds = new Set<string>()
      for (const week of allWeeks) {
        // Skip future weeks
        if (week.endDate > today) {
          continue
        }

        // Use getWeekKey to ensure consistent formatting with how picks are stored
        const weekKey = getWeekKey(week.weekType, week.week, week.label)
        
        const weekId = `${season}_${weekKey}`
        if (seenWeekIds.has(weekId)) continue
        seenWeekIds.add(weekId)
        processedCount++

        try {
          await calculateWeekRecap(undefined, weekId, forceRecalc, true) // keepLoading=true to maintain loading state
          successCount++
          // Small delay between requests to avoid overwhelming the API
          await new Promise(resolve => setTimeout(resolve, 1000))
        } catch (error) {
          console.error(`Error calculating recap for ${weekId}:`, error)
          failCount++
        }
      }

      if (processedCount === 0) {
        alert(`No completed weeks found for season ${season}`)
      } else {
        console.log(`✅ Processed ${processedCount} weeks: ${successCount} succeeded, ${failCount} failed`)
      }
    } catch (error) {
      console.error('Error fetching weeks for season:', error)
      setResults(prev => [...prev, { 
        key: `season-${season}`, 
        weekId: null, 
        success: false, 
        error: `Failed to fetch weeks for season ${season}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: new Date().toISOString() 
      }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-neutral-100 font-chakra">
      
      <div className="pt-20 px-8 max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Week Recap Admin</h1>
        
        <div className="space-y-4 mb-8">
          {/* Force recalculation checkbox */}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="forceRecalc"
              checked={forceRecalc}
              onChange={(e) => setForceRecalc(e.target.checked)}
              className="w-4 h-4"
            />
            <label htmlFor="forceRecalc" className="text-sm font-bold">
              Force recalculation (overwrite existing data)
            </label>
          </div>

          {/* Calculate by weekId */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="weekId" className="block text-sm font-bold mb-1">
                Calculate by Week ID:
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
                    calculateByWeekId()
                  }
                }}
              />
            </div>
            <button
              onClick={calculateByWeekId}
              disabled={loading || !weekIdInput.trim()}
              className="px-4 py-2 bg-indigo-500 text-white rounded hover:bg-indigo-600 disabled:opacity-50"
            >
              Calculate
            </button>
          </div>

          {/* Recalculate all weeks for a season */}
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label htmlFor="season" className="block text-sm font-bold mb-1">
                Recalculate All Weeks for Season:
              </label>
              <input
                id="season"
                type="number"
                value={seasonInput}
                onChange={(e) => setSeasonInput(e.target.value)}
                placeholder="e.g., 2024"
                min="2000"
                max="2100"
                className="w-full px-3 py-2 border border-gray-300 rounded"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    recalculateAllWeeksForSeason()
                  }
                }}
              />
            </div>
            <button
              onClick={recalculateAllWeeksForSeason}
              disabled={loading || !seasonInput.trim()}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 disabled:opacity-50 font-bold"
            >
              Recalculate All
            </button>
          </div>
          <div className="text-xs text-gray-600 -mt-2">
            ⚠️ This will recalculate ALL completed weeks for the specified season. Make sure "Force recalculation" is checked to overwrite existing data.
          </div>

          {/* Quick action buttons */}
          <div className="flex gap-4 flex-wrap">
            <button
              onClick={() => calculateWeekRecap(0)}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              Calculate Current Week
            </button>
            
            <button
              onClick={() => calculateWeekRecap(1)}
              disabled={loading}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
            >
              Calculate Last Week
            </button>
            
            <button
              onClick={calculateAllWeeks}
              disabled={loading}
              className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
            >
              Calculate All Weeks (0-4)
            </button>
          </div>
          
          {loading && (
            <div className="text-lg font-bold text-blue-600">
              Calculating... Please wait.
            </div>
          )}
        </div>
        
        {results.length > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Results:</h2>
              <button
                onClick={() => setResults([])}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                Clear Results
              </button>
            </div>
            {results.map((result, index) => (
              <div
                key={`${result.weekId ?? result.key ?? 'result'}-${index}`}
                className={`p-4 rounded border ${
                  result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="font-bold">
                  {result.weekId ? `Week: ${result.weekId}` : `Week Offset: ${result.weekOffset}`} - {result.success ? '✅ Success' : '❌ Failed'}
                </div>
                <div className="text-sm text-gray-600">
                  {result.message || result.error}
                </div>
                {result.weekId && (
                  <div className="text-sm text-gray-600">
                    Week ID: {result.weekId}
                  </div>
                )}
                {result.userCount !== undefined && (
                  <div className="text-sm text-gray-600">
                    Users: {result.userCount}
                    {result.totalGames !== undefined && (
                      <span>, Finished Games: {result.totalGames}</span>
                    )}
                    {result.usersWithCorrectPicks !== undefined && (
                      <span>, Users with Correct Picks: {result.usersWithCorrectPicks}</span>
                    )}
                    {result.topScore !== undefined && (
                      <span>, Top Score: {result.topScore > 0 ? result.topScore : '0 (no correct picks)'}</span>
                    )}
                    {result.debug && (
                      <div className="text-xs text-gray-500 mt-1">
                        Sample: {result.debug.sampleUser?.correct}/{result.debug.sampleUser?.total} correct
                      </div>
                    )}
                    {result.gameIdMatchInfo && (
                      <div className="text-xs mt-2 p-2 bg-amber-50 border border-amber-200 rounded">
                        <div className="font-semibold text-amber-800">Game ID diagnostic</div>
                        <div>Users with picks for this week: <strong>{result.gameIdMatchInfo.usersWithPicksCount}</strong></div>
                        <div>Any API ID matches a pick key: <strong>{result.gameIdMatchInfo.anyMatch ? 'Yes' : 'No'}</strong></div>
                        <div className="mt-1">API game IDs (sample): <code className="text-[10px]">{result.gameIdMatchInfo.apiIdsSample?.join(', ') || '—'}</code></div>
                        <div>Pick doc keys (sample): <code className="text-[10px]">{result.gameIdMatchInfo.pickKeysSample?.join(', ') || '—'}</code></div>
                        {result.gameIdMatchInfo.note && (
                          <div className="mt-1 text-amber-700 font-medium">{result.gameIdMatchInfo.note}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(result.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
} 