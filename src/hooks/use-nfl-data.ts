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

    // Check if Firebase is initialized
    if (!db) {
      console.warn('Firebase not initialized, cannot fetch user data')
      setUserData(null)
      setLoading(false)
      return
    }

    const fetchUserData = async () => {
      try {
        console.log('Fetching user data for:', user.uid)
        const userDoc = await getDoc(doc(db, 'users', user.uid))
        if (userDoc.exists()) {
          const data = userDoc.data()
          console.log('User data found:', data)
          setUserData(data)
        } else {
          console.log('No user document found for:', user.uid)
          setUserData(null)
        }
      } catch (error: any) {
        console.error('Error fetching user data:', error)
        
        // Handle specific Firebase offline errors
        if (error.code === 'unavailable' || error.message?.includes('offline')) {
          console.warn('Firebase is offline - user data will be loaded when connection is restored')
          // Don't set userData to null when offline, keep existing data if available
          if (!userData) {
            setUserData(null)
          }
        } else {
          setUserData(null)
        }
      } finally {
        setLoading(false)
      }
    }

    fetchUserData()
  }, [user, refreshTrigger])

  return { userData, loading, refresh }
} 

export function useUserDataQuery() {
  const { user } = useAuthStore()
  
  return useQuery({
    queryKey: ['user-data', user?.uid],
    queryFn: async () => {
      if (!user || !db) {
        throw new Error('No user or Firebase not initialized')
      }
      
      console.log('Fetching user data for:', user.uid)
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      
      if (userDoc.exists()) {
        const data = userDoc.data()
        console.log('User data found:', data)
        return data
      } else {
        console.log('No user document found for:', user.uid)
        return null
      }
    },
    enabled: !!user && !!db,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  })
} 