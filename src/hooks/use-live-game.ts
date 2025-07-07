import { useState, useEffect, useCallback } from 'react'
import { espnApi, LiveGameDetails, LiveGameSituation } from '@/lib/espn-api'

interface UseLiveGameOptions {
  gameId: string
  autoRefresh?: boolean
  refreshInterval?: number // in milliseconds
  enabled?: boolean
}

interface UseLiveGameReturn {
  game: LiveGameDetails | null
  situation: LiveGameSituation | null
  loading: boolean
  error: string | null
  refresh: () => Promise<void>
  isLive: boolean
}

export function useLiveGame({
  gameId,
  autoRefresh = true,
  refreshInterval = 10000, // 10 seconds
  enabled = true
}: UseLiveGameOptions): UseLiveGameReturn {
  const [game, setGame] = useState<LiveGameDetails | null>(null)
  const [situation, setSituation] = useState<LiveGameSituation | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLive, setIsLive] = useState(false)

  const fetchGame = useCallback(async () => {
    if (!enabled || !gameId) return

    try {
      setError(null)
      const gameData = await espnApi.getLiveGameDetails(gameId)
      
      if (gameData) {
        setGame(gameData)
        setSituation(gameData.situation || null)
        setIsLive(gameData.status === 'live')
      } else {
        setError('Game not found')
      }
    } catch (err) {
      console.error('Error fetching game data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch game data')
    } finally {
      setLoading(false)
    }
  }, [gameId, enabled])

  const fetchSituation = useCallback(async () => {
    if (!enabled || !gameId || !isLive) return

    try {
      const situationData = await espnApi.getGameSituation(gameId)
      if (situationData) {
        setSituation(situationData)
      }
    } catch (err) {
      console.error('Failed to fetch situation:', err)
      // Don't set error state for situation updates to avoid disrupting the UI
    }
  }, [gameId, enabled, isLive])

  // Initial fetch
  useEffect(() => {
    fetchGame()
  }, [fetchGame])

  // Auto-refresh for live games
  useEffect(() => {
    if (!autoRefresh || !isLive || !enabled) return

    const interval = setInterval(() => {
      fetchSituation() // Only fetch situation for frequent updates
    }, refreshInterval)

    return () => clearInterval(interval)
  }, [autoRefresh, isLive, enabled, refreshInterval, fetchSituation])

  // Full refresh every 30 seconds for live games
  useEffect(() => {
    if (!isLive || !enabled) return

    const interval = setInterval(() => {
      fetchGame()
    }, 30000) // 30 seconds

    return () => clearInterval(interval)
  }, [isLive, enabled, fetchGame])

  const refresh = useCallback(async () => {
    setLoading(true)
    await fetchGame()
  }, [fetchGame])

  return {
    game,
    situation,
    loading,
    error,
    refresh,
    isLive
  }
}

// Hook for getting all live games
export function useLiveGames() {
  const [games, setGames] = useState<LiveGameDetails[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchLiveGames = useCallback(async () => {
    try {
      setError(null)
      const liveGames = await espnApi.getLiveGames()
      
      // Get detailed data for each live game
      const detailedGames = await Promise.all(
        liveGames.map(async (game) => {
          try {
            return await espnApi.getLiveGameDetails(game.id)
          } catch {
            return game // Fallback to basic game data
          }
        })
      )

      setGames(detailedGames.filter(Boolean) as LiveGameDetails[])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch live games')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLiveGames()
    
    // Refresh every 30 seconds
    const interval = setInterval(fetchLiveGames, 30000)
    return () => clearInterval(interval)
  }, [fetchLiveGames])

  return {
    games,
    loading,
    error,
    refresh: fetchLiveGames
  }
} 