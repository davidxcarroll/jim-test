'use client'

import { useAuthStore } from '@/store/auth-store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useUserDataQuery } from '@/hooks/use-nfl-data'
import { hasCompletedProfile } from '@/utils/validation'

export function RootRedirect() {
  const { user, loading: authLoading } = useAuthStore()
  const { data: userData, isLoading: userDataLoading } = useUserDataQuery()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (user) {
        console.log('Auth and user data loading complete. User data:', userData)
        
        // If userData is null, it means no user document exists yet
        // This could happen for new users or if there was a data issue
        if (userData === null) {
          console.log('No user document found, redirecting to settings to create profile')
          router.push('/settings')
        } else if (hasCompletedProfile(userData)) {
          console.log('Profile complete, redirecting to dashboard')
          router.push('/dashboard')
        } else {
          console.log('Profile incomplete, redirecting to settings')
          router.push('/settings')
        }
      } else {
        console.log('No user, redirecting to signup')
        router.push('/signup')
      }
    }
  }, [user, authLoading, userData, userDataLoading, router])

  if (authLoading || userDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="px-2 text-2xl font-chakra uppercase font-bold bg-black text-white">Loading...</div>
      </div>
    )
  }

  return null
} 