'use client'

import { useState, useEffect, useRef } from 'react'
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
  emailNotifications: boolean
  moviePicks: string[]
}

function SettingsPage() {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<UserSettings>({
    displayName: '',
    worldSeriesPick: '',
    emailNotifications: false,
    moviePicks: Array(10).fill('')
  })
  const [originalUserData, setOriginalUserData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [showMovies, setShowMovies] = useState(false)
  const moviesSectionRef = useRef<HTMLDivElement>(null)
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

    // Check if Firebase is initialized
    if (!db) {
      console.warn('Firebase not initialized, cannot load user settings')
      return
    }

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        setOriginalUserData(data)
        setSettings({
          displayName: data.displayName || '',
          worldSeriesPick: data.worldSeriesPick || '',
          emailNotifications: data.emailNotifications || false,
          moviePicks: data.moviePicks || Array(10).fill('')
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

    // Check if Firebase is initialized
    if (!db) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }

    // Validate that display name is provided
    if (!settings.displayName.trim()) {
      setToast({ message: 'Name is required. Please enter your name.', type: 'error' })
      return
    }

    setSaving(true)
    setToast(null)

    try {
      await setDoc(doc(db, 'users', user.uid), {
        email: user.email,
        displayName: settings.displayName.trim(),
        worldSeriesPick: settings.worldSeriesPick,
        emailNotifications: settings.emailNotifications,
        moviePicks: settings.moviePicks,
        updatedAt: new Date()
      }, { merge: true })

      setToast({ message: 'Settings saved successfully!', type: 'success' })

      // Trigger a refresh of user data in navigation
      if (typeof window !== 'undefined' && (window as any).refreshUserData) {
        (window as any).refreshUserData()
      }

      // Navigate to dashboard after a short delay to show the success message
      setTimeout(() => {
        router.push('/dashboard')
      }, 1500)
    } catch (error) {
      setToast({ message: 'Error saving settings. Please try again.', type: 'error' })
      console.error('Error saving settings:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleMoviePickChange = (index: number, value: string) => {
    const newMoviePicks = [...settings.moviePicks]
    newMoviePicks[index] = value
    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
  }

  const handleMoveMovieUp = (index: number) => {
    if (index === 0) return // Can't move first item up

    const newMoviePicks = [...settings.moviePicks]
    const temp = newMoviePicks[index]
    newMoviePicks[index] = newMoviePicks[index - 1]
    newMoviePicks[index - 1] = temp
    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
  }

  const handleMoveMovieDown = (index: number) => {
    if (index === settings.moviePicks.length - 1) return // Can't move last item down

    const newMoviePicks = [...settings.moviePicks]
    const temp = newMoviePicks[index]
    newMoviePicks[index] = newMoviePicks[index + 1]
    newMoviePicks[index + 1] = temp
    setSettings(prev => ({ ...prev, moviePicks: newMoviePicks }))
  }

  const handleToggleMovies = () => {
    const newShowMovies = !showMovies
    setShowMovies(newShowMovies)

    // If we're showing movies, scroll to the section after a brief delay to ensure it's rendered
    if (newShowMovies) {
      setTimeout(() => {
        const element = moviesSectionRef.current
        if (element) {
          element.scrollIntoView({
            behavior: 'smooth',
            block: 'center'
          })
        }
      }, 200) // Increased delay to ensure DOM is fully updated
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      // Check if Firebase is initialized
      if (!auth) {
        setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
        return
      }

      await signOut(auth)
      router.push('/signin')
    } catch (error) {
      console.error('Error signing out:', error)
      setLoading(false)
    }
  }

  return (
    <div className="w-full font-chakra text-2xl pb-16 select-none">
      <Navigation />
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="relative flex flex-col items-center justify-center gap-4 xl:px-8 px-4 pt-8 pb-16 lg:mx-8 md:mx-4 sm:mx-2 bg-neutral-100">

        <h1 className="font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-center">Settings</h1>

        <div className="w-full max-w-xl mx-auto bg-neutral-100 space-y-6 text-center">

          <div>

            <div className="flex items-center justify-center gap-2 text-center text-sm font-bold text-black uppercase mb-1">
              <label htmlFor="email">Email</label>
              <button
                onClick={handleSignOut}
                disabled={loading}
                className="text-black/50 font-bold uppercase leading-none focus:outline-none disabled:opacity-50 hover:text-black/70"
              >
                {loading ? 'Signing out...' : '(Sign Out)'}
              </button>
            </div>
            <input
              id="email"
              type="email"
              value={user?.email || ''}
              disabled
              className="w-full px-3 py-2 text-black/50 uppercase font-bold max-xl:text-base text-center shadow-[0_0_0_1px_#aaa] cursor-not-allowed"
            />
          </div>

          <div className={`${!settings.displayName ? 'bg-yellow-400 p-4' : ''}`}>
            <label htmlFor="displayName" className="block text-center text-sm font-bold text-black uppercase mb-1">
              {!settings.displayName ? 'Add your name to get started' : 'Name *'}
            </label>
            <input
              id="displayName"
              type="text"
              value={settings.displayName}
              onChange={(e) => setSettings(prev => ({ ...prev, displayName: e.target.value }))}
              className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold max-xl:text-base text-center placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
              placeholder="Shorter the better"
            />
          </div>

          <div>
            <p className="block text-center text-sm font-bold text-black uppercase mb-1">
              Notifications
            </p>
            <label className="block p-4 shadow-[0_0_0_1px_#000000]">
              <div className="flex sm:flex-row flex-col items-center justify-center gap-2 uppercase max-xl:text-base font-bold mb-1 leading-none">
                <input
                  type="checkbox"
                  checked={settings.emailNotifications}
                  onChange={(e) => setSettings(prev => ({ ...prev, emailNotifications: e.target.checked }))}
                  className="w-6 h-6 accent-black cursor-pointer"
                />
                Weekly Reminder
              </div>
              <p className="block text-center text-sm font-bold text-black uppercase">
                Email me when a new week starts
              </p>
            </label>
          </div>

          <div className="relative">
            <label htmlFor="worldSeriesPick" className="block text-center text-sm font-bold text-black uppercase mb-1">
              World Series Pick
            </label>
            <select
              id="worldSeriesPick"
              value={settings.worldSeriesPick}
              onChange={(e) => setSettings(prev => ({ ...prev, worldSeriesPick: e.target.value }))}
              className="absolute inset-0 opacity-0 cursor-pointer z-20"
            >
              <option value="">Select a team</option>
              {teams.map((team) => (
                <option key={team.abbreviation} value={team.abbreviation}>
                  {teamDisplayNames[team.abbreviation] || team.name}
                </option>
              ))}
            </select>
            <div
              className="relative w-full h-20 flex items-center justify-center shadow-[0_0_0_1px_#000000] cursor-pointer"
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
                <div className="w-full flex flex-row items-center justify-center gap-2 z-10 text-white">
                  <img
                    src={selectedTeam.logo}
                    alt={`${selectedTeam.name} logo`}
                    className="w-16 h-16 object-contain"
                  />
                  <div className="text-center uppercase font-bold max-xl:text-base">
                    {teamDisplayNames[selectedTeam.abbreviation] || selectedTeam.name}
                  </div>
                  <span className="material-symbols-sharp ml-1">arrow_drop_down</span>
                </div>
              ) : (
                <div className="flex flex-row items-center justify-center text-center text-black/50 uppercase font-bold z-10">
                  Select a Team
                  <span className="material-symbols-sharp ml-1">arrow_drop_down</span>
                </div>
              )}
            </div>
          </div>

          <hr className="w-full border-t-[1px] border-black/50" />

          {showMovies && (
            <div ref={moviesSectionRef} className="scroll-mt-8">

              <h1 className="font-jim xl:text-7xl lg:text-6xl md:text-5xl text-4xl text-center">Top 10 Movies</h1>

              <div className="w-full flex flex-col items-center justify-center py-8">
                {settings.moviePicks.map((movie, index) => (
                  <div key={index} className="w-full flex flex-row items-center justify-center gap-1">
                    <label htmlFor={`movie-${index + 1}`} className="block w-8 flex-shrink-0 text-center text-sm font-bold text-black uppercase mb-1">
                      #{index + 1}
                    </label>
                    <input
                      id={`movie-${index + 1}`}
                      type="text"
                      value={movie}
                      onChange={(e) => handleMoviePickChange(index, e.target.value)}
                      className="w-full py-2 bg-neutral-100 uppercase text-center font-bold max-xl:text-base text-center placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
                      placeholder={`#${index + 1} Movie`}
                    />
                    <div className="w-16 flex flex-row items-center justify-center gap-1">
                      <button
                        onClick={() => handleMoveMovieUp(index)}
                        className={`material-symbols-sharp cursor-pointer hover:text-black/70 text-black/50 ${index === 0 ? 'invisible pointer-events-none' : ''}`}
                        tabIndex={index === 0 ? -1 : 0}
                        aria-disabled={index === 0}
                      >
                        keyboard_arrow_up
                      </button>
                      <button
                        onClick={() => handleMoveMovieDown(index)}
                        className={`material-symbols-sharp cursor-pointer hover:text-black/70 text-black/50 ${index === settings.moviePicks.length - 1 ? 'invisible pointer-events-none' : ''}`}
                        tabIndex={index === settings.moviePicks.length - 1 ? -1 : 0}
                        aria-disabled={index === settings.moviePicks.length - 1}
                      >
                        keyboard_arrow_down
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <hr className="w-full border-t-[1px] border-black/50" />
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !settings.displayName.trim()}
            className="w-full bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Done'}
          </button>

        </div>

        <div className="absolute top-14 right-3">
          <button
            onClick={handleToggleMovies}
            className="focus:outline-none hover:scale-110 transition-transform"
          >
            <span className="material-symbols-sharp text-red-500">local_activity</span>
          </button>
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