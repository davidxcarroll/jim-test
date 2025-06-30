'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'
import { Toast } from '@/components/toast'
import { teamDisplayNames } from '@/utils/team-names'
import { getTeamByAbbreviation, formatHexColor } from '@/utils/team-utils'
import { Team } from '@/types/mlb'
import { espnApi } from '@/lib/espn-api'
import image from 'next/image'

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
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const router = useRouter()

  // Fetch official, active teams from ESPN API on mount
  useEffect(() => {
    async function fetchTeams() {
      try {
        const apiTeams = await espnApi.getTeams()
        // Remove duplicates by abbreviation (shouldn't be any, but just in case)
        const uniqueTeams = Array.from(
          new Map(apiTeams.map(team => [team.abbreviation, team])).values()
        )
        setTeams(uniqueTeams)
      } catch (error) {
        console.error('Error fetching teams:', error)
        setTeams([])
      }
    }
    fetchTeams()
  }, [])

  // Load user settings on component mount
  useEffect(() => {
    if (user) {
      loadUserSettings()
    }
  }, [user])

  // Load team data when world series pick changes
  useEffect(() => {
    if (settings.worldSeriesPick) {
      loadTeamData(settings.worldSeriesPick)
    } else {
      setSelectedTeam(null)
    }
  }, [settings.worldSeriesPick])

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

  const loadTeamData = async (abbreviation: string) => {
    try {
      const team = await getTeamByAbbreviation(abbreviation)
      setSelectedTeam(team)
    } catch (error) {
      console.error('Error loading team data:', error)
      setSelectedTeam(null)
    }
  }

  const handleSave = async () => {
    if (!user) return

    setSaving(true)
    setToast(null)

    try {
      await setDoc(doc(db, 'users', user.uid), {
        displayName: settings.displayName,
        worldSeriesPick: settings.worldSeriesPick,
        updatedAt: new Date()
      }, { merge: true })

      setToast({ message: 'Settings saved successfully!', type: 'success' })
    } catch (error) {
      setToast({ message: 'Error saving settings. Please try again.', type: 'error' })
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
    <div className="w-full font-chakra text-2xl pb-16">
      <Navigation />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="w-full h-[70dvh] min-h-fit flex flex-col items-center justify-center gap-4 xl:px-8 px-4 pt-8 pb-16 bg-neutral-100">

        <h1 className="font-jim 2xl:text-8xl xl:text-7xl text-6xl text-center">Settings</h1>

        <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6">
          <div>
            <label htmlFor="displayName" className="block text-center text-sm font-bold text-black uppercase mb-1">
              Display Name
            </label>
            <input
              id="displayName"
              type="text"
              value={settings.displayName}
              onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center border-[1px] border-black focus:outline-none focus:bg-white"
              placeholder="Enter your display name"
            />
          </div>

          <div>
            <label htmlFor="worldSeriesPick" className="block text-center text-sm font-bold text-black uppercase mb-1">
              World Series Pick
            </label>
            <select
              id="worldSeriesPick"
              value={settings.worldSeriesPick}
              onChange={(e) => setSettings(prev => ({ ...prev, worldSeriesPick: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold text-center border-[1px] border-black focus:outline-none focus:bg-white"
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.abbreviation} value={team.abbreviation}>
                  {teamDisplayNames[team.abbreviation] || team.name}
                </option>
              ))}
            </select>
            <div
              className="relative w-full h-40 flex items-center justify-center border-[1px] border-black border-t-0"
              style={{
                background: selectedTeam?.color && selectedTeam?.alternateColor
                  ? `linear-gradient(135deg, ${formatHexColor(selectedTeam.color)}, ${formatHexColor(selectedTeam.alternateColor)})`
                  : '#F5F5F5'
              }}
            >
              <div
                className="absolute top-0 left-0 w-full h-full flex z-10"
                style={{
                  backgroundImage: `url(/images/texture/texture-6.jpg)`,
                  backgroundSize: 'cover',
                  mixBlendMode: 'plus-lighter',
                  opacity: '0.2'
                }}
              />
              {selectedTeam?.logo ? (
                <img
                  src={selectedTeam.logo}
                  alt={`${selectedTeam.name} logo`}
                  className="w-36 h-36 object-contain z-10"
                />
              ) : (
                <div className="">
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col items-center gap-8">
            <button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={handleSignOut}
              disabled={loading}
              className="max-xl:text-base text-black/50 font-bold uppercase leading-none focus:outline-none disabled:opacity-50"
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