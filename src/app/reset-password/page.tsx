'use client'

import { useState, useEffect } from 'react'
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { useRouter, useSearchParams } from 'next/navigation'
import { Toast } from '@/components/toast'
import Link from 'next/link'

function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [email, setEmail] = useState<string | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const verifyResetCode = async () => {
      try {
        // Check if Firebase is initialized
        if (!auth) {
          setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
          setVerifying(false)
          return
        }

        const oobCode = searchParams.get('oobCode')
        if (!oobCode) {
          setToast({ message: 'Invalid reset link', type: 'error' })
          setVerifying(false)
          return
        }

        // Verify the password reset code and get the email
        const email = await verifyPasswordResetCode(auth, oobCode)
        setEmail(email)
        setVerifying(false)
      } catch (err: any) {
        console.error('Error verifying reset code:', err)
        setToast({ 
          message: 'This password reset link is invalid or has expired. Please request a new one.', 
          type: 'error' 
        })
        setVerifying(false)
      }
    }

    verifyResetCode()
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setToast(null)

    // Check if Firebase is initialized
    if (!auth) {
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
      const oobCode = searchParams.get('oobCode')
      if (!oobCode) {
        setToast({ message: 'Invalid reset link', type: 'error' })
        return
      }

      await confirmPasswordReset(auth, oobCode, password)
      
      setToast({ 
        message: 'Password reset successfully! You can now sign in with your new password.', 
        type: 'success' 
      })

      // Redirect to signin page after a short delay
      setTimeout(() => {
        router.push('/signin')
      }, 2000)
    } catch (err: any) {
      console.error('Error resetting password:', err)
      let errorMessage = 'Failed to reset password'

      if (err.code === 'auth/expired-action-code') {
        errorMessage = 'This password reset link has expired. Please request a new one.'
      } else if (err.code === 'auth/invalid-action-code') {
        errorMessage = 'Invalid password reset link. Please request a new one.'
      } else if (err.code === 'auth/weak-password') {
        errorMessage = 'Password is too weak. Please choose a stronger password.'
      } else {
        errorMessage = err.message || 'Failed to reset password'
      }

      setToast({ message: errorMessage, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  if (verifying) {
    return (
      <div className="min-h-screen flex items-center justify-center font-chakra">
        <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">
          <div className="text-center">
            <h1 className="text-6xl font-jim leading-10">Verifying...</h1>
          </div>
          <p className="text-sm font-bold text-black uppercase">
            Please wait while we verify your reset link.
          </p>
        </div>
      </div>
    )
  }

  if (!email) {
    return (
      <div className="min-h-screen flex items-center justify-center font-chakra">
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">
          <div className="text-center">
            <h1 className="text-6xl font-jim leading-10">Invalid Link</h1>
          </div>
          <p className="text-sm font-bold text-black uppercase">
            This password reset link is invalid or has expired.
          </p>
          <div className="text-center">
            <Link href="/signin" className="text-sm font-bold text-black uppercase underline">
              Return to Sign In
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center font-chakra">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center p-8">

        <div className="text-center">
          <h1 className="text-6xl font-jim leading-10">Reset Password</h1>
        </div>

        <div className="text-center">
          <p className="text-sm font-bold text-black uppercase">
            Enter a new password for {email}
          </p>
        </div>

        <hr className="border-t-[1px] border-black" />

        <form className="space-y-6" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="password" className="block text-center text-sm font-bold text-black uppercase mb-1">
              New Password
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
              placeholder="Enter new password"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="block text-center text-sm font-bold text-black uppercase mb-1">
              Confirm New Password
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
              placeholder="Confirm new password"
            />
          </div>

          <div className="space-y-4">
            <button
              type="submit"
              disabled={loading || !password || !confirmPassword}
              className="w-full bg-black text-white py-3 px-4 font-bold uppercase leading-none focus:outline-none disabled:bg-black/20"
            >
              {loading ? 'Resetting Password...' : 'Reset Password'}
            </button>

            <div className="text-center">
              <Link href="/signin" className="text-sm font-bold text-black uppercase underline">
                Back to Sign In
              </Link>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}

export default ResetPasswordPage 