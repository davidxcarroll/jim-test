'use client'

import { useState } from 'react'
import { Toast } from '@/components/toast'

interface ToastMessage {
  message: string
  type: 'success' | 'error'
}

export default function AudienceManagementPage() {
  const [email, setEmail] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastMessage | null>(null)

  const addSingleUser = async () => {
    if (!email) {
      setToast({ message: 'Email is required', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/email/add-to-audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, displayName }),
      })

      if (response.ok) {
        setToast({ message: `Successfully added ${email} to general audience`, type: 'success' })
        setEmail('')
        setDisplayName('')
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Failed to add user to audience', type: 'error' })
      }
    } catch (error) {
      setToast({ message: 'Network error occurred', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const addAllUsers = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/email/add-all-users-to-audience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      if (response.ok) {
        const result = await response.json()
        setToast({ 
          message: `Added ${result.successCount} users to audience (${result.failureCount} failed)`, 
          type: 'success' 
        })
      } else {
        const error = await response.json()
        setToast({ message: error.error || 'Failed to add users to audience', type: 'error' })
      }
    } catch (error) {
      setToast({ message: 'Network error occurred', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen p-8 font-chakra">
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
      
      <div className="max-w-2xl mx-auto space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-jim">Audience Management</h1>
          <p className="text-sm text-gray-600 mt-2">Manage Resend General Audience List</p>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
          <div>
            <h2 className="text-xl font-bold mb-4">Add Single User</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-black uppercase mb-1">
                  Email Address
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
                  placeholder="user@example.com"
                />
              </div>
              
              <div>
                <label className="block text-sm font-bold text-black uppercase mb-1">
                  Display Name (Optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
                  placeholder="John Doe"
                />
              </div>

              <button
                onClick={addSingleUser}
                disabled={loading || !email}
                className="w-full px-4 py-2 bg-black text-white font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-800"
              >
                {loading ? 'Adding...' : 'Add to General Audience'}
              </button>
            </div>
          </div>

          <hr className="border-t border-gray-300" />

          <div>
            <h2 className="text-xl font-bold mb-4">Add All Existing Users</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will add all users from your Firestore database to the general audience list.
            </p>
            <button
              onClick={addAllUsers}
              disabled={loading}
              className="w-full px-4 py-2 bg-yellow-500 text-black font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed hover:bg-yellow-600"
            >
              {loading ? 'Processing...' : 'Add All Users to Audience'}
            </button>
          </div>
        </div>

        <div className="bg-blue-50 p-4 rounded-lg">
          <h3 className="font-bold text-blue-900 mb-2">How it works:</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>• New users are automatically added to the "general" audience when they sign up</li>
            <li>• Use the single user form to manually add specific users</li>
            <li>• Use "Add All Users" to backfill existing users who signed up before this feature</li>
            <li>• Users can unsubscribe from emails through Resend's unsubscribe links</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
