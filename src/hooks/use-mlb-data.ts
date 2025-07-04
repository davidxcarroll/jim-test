import { useQuery } from '@tanstack/react-query'
import { espnApi } from '@/lib/espn-api'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useAuthStore } from '@/store/auth-store'
import { useState, useEffect } from 'react'

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

export function useUserData() {
  const { user } = useAuthStore()
  const [userData, setUserData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  const refresh = () => setRefreshTrigger(prev => prev + 1)

  useEffect(() => {
    if (!user) {
      setUserData(null)
      setLoading(false)
      return
    }

    const fetchUserData = async () => {
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          setUserData(userDoc.data())
        } else {
          setUserData(null)
        }
      } catch (error) {
        console.error('Error fetching user data:', error)
        setUserData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [user, refreshTrigger])

  return { userData, loading, refresh }
} 