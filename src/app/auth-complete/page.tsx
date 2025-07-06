'use client'

import { useEffect, useState } from 'react'
import { isSignInWithEmailLink, signInWithEmailLink } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Toast } from '@/components/toast'

function AuthCompletePage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()
  const { setUser } = useAuthStore()

  useEffect(() => {
    const completeSignIn = async () => {
      try {
        // Check if Firebase is initialized
        if (!auth) {
          setError('Firebase not initialized. Please refresh the page.')
          setLoading(false)
          return
        }

        // Check if this is an email link sign-in
        if (!isSignInWithEmailLink(auth, window.location.href)) {
          setError('Invalid sign-in link')
          setLoading(false)
          return
        }

        // Get the email from localStorage (we'll store it when sending the link)
        let email = window.localStorage.getItem('emailForSignIn')
        
        // If email is not in localStorage, prompt the user
        if (!email) {
          email = window.prompt('Please provide your email for confirmation')
          if (!email) {
            setError('Email is required to complete sign-in')
            setLoading(false)
            return
          }
        }

        // Complete the sign-in process
        const result = await signInWithEmailLink(auth, email, window.location.href)
        
        // Clear the email from localStorage
        window.localStorage.removeItem('emailForSignIn')
        
        // Update the auth store
        setUser(result.user)
        
        // Redirect to dashboard
        router.push('/dashboard')
      } catch (err: any) {
        console.error('Error completing sign-in:', err)
        setError(err.message || 'Failed to complete sign-in')
        setLoading(false)
      }
    }

    completeSignIn()
  }, [router, setUser])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center font-chakra">
        <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">
          <div className="text-center">
            <h1 className="text-6xl font-jim">Completing Sign In...</h1>
            <p className="mt-4 text-lg">Please wait while we verify your email.</p>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center font-chakra">
        <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">
          <div className="text-center">
            <h1 className="text-6xl font-jim">Sign In Failed</h1>
            <p className="mt-4 text-lg text-red-600">{error}</p>
            <button
              onClick={() => router.push('/signin')}
              className="mt-6 bg-black text-white py-3 px-6 font-bold uppercase text-xl focus:outline-none"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}

export default AuthCompletePage 