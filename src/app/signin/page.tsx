'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword, sendSignInLinkToEmail, sendPasswordResetEmail } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { PublicOnlyRoute } from '@/components/protected-route'
import { Toast } from '@/components/toast'
import Link from 'next/link'

function SignInPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [magicLinkLoading, setMagicLinkLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)
    
    // Check if Firebase is initialized
    if (!auth) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }
    
    setLoading(true)

    try {
      console.log('Attempting to sign in with email:', email)
      const userCredential = await signInWithEmailAndPassword(auth, email, password)
      console.log('Sign in successful:', userCredential.user.email)
      router.push('/dashboard')
    } catch (err: any) {
      console.error('Sign in error:', err)
      let errorMessage = 'Failed to sign in'

      // Provide more specific error messages
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address'
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = 'Incorrect password'
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address'
      } else if (err.code === 'auth/too-many-requests') {
        errorMessage = 'Too many failed attempts. Please try again later'
      } else if (err.code === 'auth/user-disabled') {
        errorMessage = 'This account has been disabled'
      } else {
        errorMessage = err.message || 'Failed to sign in'
      }

      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkSignIn = async () => {
    if (!email) {
      setToast({ message: 'Please enter your email address', type: 'error' })
      return
    }

    // Check if Firebase is initialized
    if (!auth) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }

    setToast(null)
    setMagicLinkLoading(true)

    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth-complete`,
        handleCodeInApp: true,
      }

      await sendSignInLinkToEmail(auth, email, actionCodeSettings)

      // Store the email in localStorage for the auth-complete page
      window.localStorage.setItem('emailForSignIn', email)

      setToast({
        message: 'Check your email for a sign-in link!',
        type: 'success'
      })
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to send sign-in link', type: 'error' })
    } finally {
      setMagicLinkLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    setToast(null)
    if (!email) {
      setToast({ message: 'Please enter your email address', type: 'error' })
      return
    }
    
    // Check if Firebase is initialized
    if (!auth) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }
    
    setResetLoading(true)
    try {
      const actionCodeSettings = {
        url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/reset-password`,
        handleCodeInApp: true,
      }
      
      await sendPasswordResetEmail(auth, email, actionCodeSettings)
      setToast({ message: 'Password reset email sent! Check your inbox.', type: 'success' })
      setShowForgotPassword(false)
    } catch (err: any) {
      let errorMessage = 'Failed to send password reset email'
      if (err.code === 'auth/user-not-found') {
        errorMessage = 'No account found with this email address'
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = 'Invalid email address'
      } else {
        errorMessage = err.message || errorMessage
      }
      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-chakra">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">

        <div className="text-center">
          <h1 className="text-6xl font-jim leading-10">Welcome Back</h1>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-black uppercase">
            No account?{' '}
            <Link href="/signup" className="underline">
              Sign up
            </Link>
          </p>
        </div>

        <hr className="border-t-[1px] border-black" />

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="block text-center text-sm font-bold text-black uppercase mb-1">
              Email address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-center text-sm font-bold text-black uppercase mb-1">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
            />

            <div className="text-center mt-1">
                <button
                  type="button"
                  className="text-sm underline text-black/50 hover:text-black font-bold uppercase"
                  onClick={async () => {
                    setShowForgotPassword(false)
                    setResetLoading(true)
                    await handleForgotPassword()
                    setResetLoading(false)
                  }}
                  disabled={resetLoading}
                >
                  {resetLoading ? 'Sending...' : 'Forgot Password?'}
                </button>
              </div>
          </div>

          {showForgotPassword && (
            <></>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading || !email || !password}
              className="w-full bg-black text-white py-3 px-4 font-bold uppercase leading-none focus:outline-none disabled:bg-black/20"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-black/20" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="px-2 bg-neutral-100 text-black/50 font-bold uppercase">Or</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleMagicLinkSignIn}
              disabled={magicLinkLoading || !email}
              className="w-full bg-black text-white py-3 px-4 font-bold uppercase leading-none focus:outline-none disabled:bg-black/20"
            >
              {magicLinkLoading ? 'Sending Link...' : 'Sign in with Email Link'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default function ProtectedSignInPage() {
  return (
    <PublicOnlyRoute>
      <SignInPage />
    </PublicOnlyRoute>
  )
} 