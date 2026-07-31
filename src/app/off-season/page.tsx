'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/** Redirect to dashboard; "2025 Season" is the default view there (bookend). */
export default function OffSeasonPage() {
  const router = useRouter()
  useEffect(() => {
    router.replace('/dashboard')
  }, [router])
  return null
}
