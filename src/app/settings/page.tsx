'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'

interface UserSettings {
  displayName: string
  worldSeriesPick: string
}

function SettingsPage() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<UserSettings>({
    displayName: '',
    worldSeriesPick: ''
  })
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()

  // Load user settings on component mount
  useEffect(() => {
    if (user) {
      loadUserSettings()
    }
  }, [user])

  const loadUserSettings = async () => {
    if (!user) return

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        setSettings({
          displayName: data.displayName || '',
          worldSeriesPick: data.worldSeriesPick || ''
        })
      }
    } catch (error) {
      console.error('Error loading user settings:', error)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    setMessage('')

    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: settings.displayName,
        worldSeriesPick: settings.worldSeriesPick,
        updatedAt: new Date()
      }, { merge: true })

      setMessage('Settings saved successfully!')
    } catch (error) {
      setMessage('Error saving settings. Please try again.')
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      await signOut(auth)
      router.push('/signin')
    } catch (error) {
      console.error('Error signing out:', error)
      setLoading(false)
    }
  }

  return (
    <div className="font-chakra text-2xl">
      <Navigation />

      <div className="max-w-2xl mx-auto p-8">
        <h1 className="text-4xl font-jim font-bold text-center mb-8">Settings</h1>

        <div className="bg-white rounded-lg shadow-lg p-6 space-y-6">
          {message && (
            <div className={`p-4 rounded ${
              message.includes('Error') 
                ? 'bg-red-50 border border-red-200 text-red-600' 
                : 'bg-green-50 border border-green-200 text-green-600'
            }`}>
              {message}
            </div>
          )}

          <div>
            <label htmlFor="displayName" className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={settings.displayName}
              onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter your display name"
            />
          </div>

          <div>
            <label htmlFor="worldSeriesPick" className="block text-sm font-medium text-gray-700 mb-2">
              World Series Pick
            </label>
            <input
              id="worldSeriesPick"
              type="text"
              value={settings.worldSeriesPick}
              onChange={(e) => setSettings(prev => ({ ...prev, worldSeriesPick: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              placeholder="Enter team abbreviation (e.g., NYY, LAD)"
            />
            <p className="text-sm text-gray-500 mt-1">
              Enter the team abbreviation for your World Series pick
            </p>
          </div>

          <div className="flex space-x-4">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>

            <button
              onClick={handleSignOut}
              disabled={loading}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50"
            >
              {loading ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProtectedSettingsPage() {
  return (
    <ProtectedRoute>
      <SettingsPage />
    </ProtectedRoute>
  )
} 