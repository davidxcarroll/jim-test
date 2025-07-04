'use client'

import { useAuthStore } from '@/store/auth-store'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { useUserData } from '@/hooks/use-mlb-data'
import { hasCompletedProfile } from '@/utils/validation'

export function RootRedirect() {
  const { user, loading: authLoading } = useAuthStore()
  const { userData, loading: userDataLoading } = useUserData()
  const router = useRouter()

  useEffect(() => {
    if (!authLoading && !userDataLoading) {
      if (user) {
        // Check if user has completed their profile
        if (hasCompletedProfile(userData)) {
          router.push('/dashboard')
        } else {
          router.push('/settings')
        }
      } else {
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