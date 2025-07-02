import { useQuery } from '@tanstack/react-query'
import { espnApi } from '@/lib/espn-api'

export const useTodaysGames = () => {
  return useQuery({
    queryKey: ['todays-games'],
    queryFn: espnApi.getTodaysGames,
    refetchInterval: 30000, // Refetch every 30 seconds for live games
  })
}

export const useGameDetails = (gameId: string) => {
  return useQuery({
    queryKey: ['game-details', gameId],
    queryFn: () => espnApi.getGameDetails(gameId),
    enabled: !!gameId,
    refetchInterval: 15000, // Refetch every 15 seconds for live game details
  })
}

export const useTeams = () => {
  return useQuery({
    queryKey: ['teams'],
    queryFn: espnApi.getTeams,
    staleTime: 24 * 60 * 60 * 1000, // 24 hours - teams don't change often
  })
}

export const useGamesForWeek = (start: Date, end: Date) => {
  return useQuery({
    queryKey: ['games-for-week', start.toISOString(), end.toISOString()],
    queryFn: () => espnApi.getGamesForDateRange(start, end),
    staleTime: 0, // Always fetch fresh data on mount/refresh
  })
} 