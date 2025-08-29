'use client'

import { useAuthStore } from '@/store/auth-store'
import { useUserData } from '@/hooks/use-nfl-data'
import { hasCompletedProfile } from '@/utils/validation'

export default function DebugUserPage() {
  const { user, loading: authLoading } = useAuthStore()
  const { userData, loading: userDataLoading } = useUserData()

  if (authLoading || userDataLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="px-2 text-2xl font-chakra uppercase font-bold bg-black text-white">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8 bg-neutral-100">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold text-black">User Data Debug</h1>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Authentication Status</h2>
          <div className="space-y-2">
            <p><strong>User:</strong> {user ? user.email : 'Not authenticated'}</p>
            <p><strong>User ID:</strong> {user?.uid || 'N/A'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">User Data from Firestore</h2>
          <div className="space-y-2">
            <p><strong>User Data:</strong></p>
            <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
              {JSON.stringify(userData, null, 2)}
            </pre>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Profile Completion Check</h2>
          <div className="space-y-2">
            <p><strong>Has displayName:</strong> {userData?.displayName ? 'Yes' : 'No'}</p>
            <p><strong>displayName value:</strong> "{userData?.displayName || 'undefined'}"</p>
            <p><strong>displayName trimmed length:</strong> {userData?.displayName?.trim().length || 0}</p>
            <p><strong>Profile completed:</strong> {hasCompletedProfile(userData) ? 'Yes' : 'No'}</p>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-bold mb-4">Expected Redirect</h2>
          <div className="space-y-2">
            {!user ? (
              <p className="text-red-600 font-bold">→ Would redirect to /signup</p>
            ) : !hasCompletedProfile(userData) ? (
              <p className="text-yellow-600 font-bold">→ Would redirect to /settings (profile incomplete)</p>
            ) : (
              <p className="text-green-600 font-bold">→ Would redirect to /dashboard (profile complete)</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
