'use client'

import { useState } from 'react'
import { signInWithEmailAndPassword, sendSignInLinkToEmail } from 'firebase/auth'
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
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)
    setLoading(true)

    try {
      await signInWithEmailAndPassword(auth, email, password)
      router.push('/dashboard')
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to sign in', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handleMagicLinkSignIn = async () => {
    if (!email) {
      setToast({ message: 'Please enter your email address', type: 'error' })
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

  return (
    <div className="min-h-screen flex items-center justify-center font-chakra">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">
        <div className="text-center">
          <h1 className="text-6xl font-jim">Welcome Back</h1>
        </div>

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
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in with Password'}
            </button>
            
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300" />
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-neutral-100 text-gray-500 font-bold uppercase">Or</span>
              </div>
            </div>
            
            <button
              type="button"
              onClick={handleMagicLinkSignIn}
              disabled={magicLinkLoading || !email}
              className="w-full bg-green-600 text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
            >
              {magicLinkLoading ? 'Sending Link...' : 'Sign in with Magic Link'}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm font-bold text-black uppercase">
              Don't have an account?{' '}
              <Link href="/signup" className="underline">
                Sign up
              </Link>
            </p>
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