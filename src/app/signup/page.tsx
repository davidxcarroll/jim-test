'use client'

import { useState } from 'react'
import { createUserWithEmailAndPassword } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { PublicOnlyRoute } from '@/components/protected-route'
import { Toast } from '@/components/toast'
import Link from 'next/link'
import { setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

function SignUpPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)

    // Check if Firebase is initialized
    if (!auth || !db) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }

    if (password !== confirmPassword) {
      setToast({ message: 'Passwords do not match', type: 'error' })
      return
    }

    if (password.length < 6) {
      setToast({ message: 'Password must be at least 6 characters', type: 'error' })
      return
    }

    setLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password)

      // Save user data to Firestore including email
      try {
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: email,
          createdAt: new Date()
        }, { merge: true })
      } catch (firestoreError) {
        console.error('Failed to save user data to Firestore:', firestoreError)
        // Don't fail the signup if Firestore save fails
      }

      // Send welcome email
      try {
        await fetch('/api/email/welcome', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email }),
        })
      } catch (emailError) {
        console.error('Failed to send welcome email:', emailError)
        // Don't fail the signup if email fails
      }

      router.push('/settings')
    } catch (err: any) {
      setToast({ message: err.message || 'Failed to create account', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-chakra">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">

        <div className="text-center">
          <h1 className="text-6xl font-jim leading-10">Hiya!<br />Create an Account</h1>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-black uppercase">
            Have an account?{' '}
            <Link href="/signin" className="underline">
              Sign in
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
              autoComplete="new-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-center text-sm font-bold text-black uppercase mb-1">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading || !email || !password || !confirmPassword || password !== confirmPassword}
              className="w-full bg-black text-white py-3 px-4 font-bold uppercase focus:outline-none disabled:bg-black/20"
            >
              {loading ? 'Creating account...' : 'Sign up'}
            </button>
          </div>

        </form>
      </div>
    </div>
  )
}

export default function ProtectedSignUpPage() {
  return (
    <PublicOnlyRoute>
      <SignUpPage />
    </PublicOnlyRoute>
  )
} 