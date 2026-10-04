'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'
import { Toast } from '@/components/toast'
import { teamDisplayNames } from '@/utils/team-names'
import { getTeamByAbbreviation, getTeamLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'
import { espnApi } from '@/lib/espn-api'
import { loadTeamColorMappings, subscribeToTeamColorMappingChanges, getTeamColorMapping } from '@/store/team-color-mapping-store'
import { isOnline, getNetworkStatusMessage } from '@/utils/network-utils'
import { isHiddenUser } from '@/utils/hidden-user'
import { getCurrentNFLWeekFromAPI } from '@/utils/date-helpers'
import {
  getActiveSuperBowlSeasonYear,
  getSuperBowlPickForSeason,
  buildSuperBowlPicksUpdate,
  isSuperBowlPickLocked,
  SuperBowlPicksMap
} from '@/utils/super-bowl-picks'

interface UserSettings {
  displayName: string
  superBowlPick: string
  emailNotifications: boolean
}

interface OwnedProfile {
  id: string
  displayName: string
  savedDisplayName: string
  superBowlPick: string
  superBowlPicks: SuperBowlPicksMap
  legacySuperBowlPick?: string
}

interface GeneralSettingsProps {
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void
}

type TeamLogoType = 'default' | 'dark' | 'scoreboard' | 'darkScoreboard'
type TeamPreviewStyle = { background: string; logoType: TeamLogoType }

function teamPreviewStyle(team: Team): TeamPreviewStyle {
  const mapping = getTeamColorMapping(team.abbreviation)
  let background = '#1a1a1a'
  let logoType: TeamLogoType = 'dark'

  if (mapping) {
    if (mapping.backgroundColorChoice === 'custom' && mapping.customColor) {
      background = mapping.customColor
    } else if (mapping.backgroundColorChoice === 'secondary' && team.alternateColor) {
      background = team.alternateColor.startsWith('#') ? team.alternateColor : `#${team.alternateColor}`
    } else if (team.color) {
      background = team.color.startsWith('#') ? team.color : `#${team.color}`
    }
    logoType = mapping.logoType || 'dark'
  } else if (team.color) {
    background = team.color.startsWith('#') ? team.color : `#${team.color}`
  }

  return { background, logoType }
}

function createdAtMillis(value: unknown): number {
  if (!value || typeof value !== 'object') return 0
  if ('toMillis' in value && typeof value.toMillis === 'function') return value.toMillis()
  if ('seconds' in value && typeof value.seconds === 'number') return value.seconds * 1000
  return 0
}

function SuperBowlPickField({
  id,
  seasonYear,
  abbreviation,
  teams,
  locked,
  onChange
}: {
  id: string
  seasonYear: number
  abbreviation: string
  teams: Team[]
  locked: boolean
  onChange: (teamAbbreviation: string) => void
}) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedTeamStyle, setSelectedTeamStyle] = useState<TeamPreviewStyle>({ background: '#F5F5F5', logoType: 'dark' })

  useEffect(() => {
    let cancelled = false
    const loadTeamDataAndStyle = async () => {
      if (!abbreviation) {
        setSelectedTeam(null)
        setSelectedTeamStyle({ background: '#F5F5F5', logoType: 'dark' })
        return
      }
      try {
        const team = await getTeamByAbbreviation(abbreviation)
        if (cancelled) return
        setSelectedTeam(team)
        setSelectedTeamStyle(team ? teamPreviewStyle(team) : { background: '#1a1a1a', logoType: 'dark' })
      } catch (error) {
        console.error('Error loading team data:', error)
        if (!cancelled) {
          setSelectedTeam(null)
          setSelectedTeamStyle({ background: '#1a1a1a', logoType: 'dark' })
        }
      }
    }
    loadTeamDataAndStyle()
    return () => {
      cancelled = true
    }
  }, [abbreviation])

  useEffect(() => {
    const unsubscribe = subscribeToTeamColorMappingChanges(() => {
      if (selectedTeam) {
        setSelectedTeamStyle(teamPreviewStyle(selectedTeam))
      }
    })
    return unsubscribe
  }, [selectedTeam])

  return (
    <div className="relative min-w-0">
      <label htmlFor={id} className="block text-center text-sm font-bold text-black uppercase mb-1">
        <span className="flex items-center justify-center gap-1">
          {locked && <span className="material-symbols-sharp !text-sm">lock</span>}
          {seasonYear} Super Bowl Pick
        </span>
      </label>
      <select
        id={id}
        value={abbreviation}
        onChange={(e) => onChange(e.target.value)}
        disabled={locked}
        className="absolute inset-0 opacity-0 z-20"
        style={{ cursor: locked ? 'not-allowed' : 'pointer' }}
      >
        <option value="">Select a team</option>
        {teams.map((team) => (
          <option key={team.abbreviation} value={team.abbreviation}>
            {teamDisplayNames[team.abbreviation] || team.name}
          </option>
        ))}
      </select>
      <div
        className={`relative w-full min-w-0 h-20 flex items-center justify-center shadow-[0_0_0_1px_#000000] ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          background: selectedTeamStyle.background
        }}
      >
        {selectedTeam?.logo ? (
          <div className="w-full min-w-0 flex flex-row items-center justify-center gap-2 z-10 text-white">
            <img
              src={getTeamLogo(selectedTeam, selectedTeamStyle.logoType)}
              alt={`${selectedTeam.name} logo`}
              className="w-16 h-16 object-contain shrink-0"
            />
            <div className="min-w-0 text-center uppercase font-bold max-xl:text-base">
              {teamDisplayNames[selectedTeam.abbreviation] || selectedTeam.name}
            </div>
            {!locked && <span className="material-symbols-sharp ml-1">arrow_drop_down</span>}
          </div>
        ) : (
          <div className="min-w-0 flex flex-row items-center justify-center text-center text-black/50 uppercase font-bold z-10">
            {locked ? 'Locked - Season Started' : 'Select a Team'}
            {!locked && <span className="material-symbols-sharp ml-1">arrow_drop_down</span>}
          </div>
        )}
      </div>
    </div>
  )
}

export function GeneralSettings({ onToast }: GeneralSettingsProps) {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<UserSettings>({
    displayName: '',
    superBowlPick: '',
    emailNotifications: false
  })
  const [originalUserData, setOriginalUserData] = useState<any>(null)
  const [profiles, setProfiles] = useState<OwnedProfile[]>([])
  const [draftProfile, setDraftProfile] = useState<OwnedProfile | null>(null)
  const [savingDraft, setSavingDraft] = useState(false)
  const [loading, setLoading] = useState(false)
  const [teams, setTeams] = useState<Team[]>([])
  const [networkStatus, setNetworkStatus] = useState<string>('')
  /** Super Bowl pick locked at first regular-season kickoff */
  const [isSeasonStarted, setIsSeasonStarted] = useState<boolean>(false)
  /** Super Bowl picker is hidden only when season status cannot be loaded */
  const [showSuperBowlPick, setShowSuperBowlPick] = useState<boolean>(false)
  const [superBowlSeasonYear, setSuperBowlSeasonYear] = useState<number>(() => getActiveSuperBowlSeasonYear())
  const [superBowlPicksMap, setSuperBowlPicksMap] = useState<SuperBowlPicksMap>({})
  const router = useRouter()

  // Fetch official, active teams from ESPN API on mount
  useEffect(() => {
    async function fetchTeams() {
      try {
        console.log('Fetching teams from ESPN API...')
        const apiTeams = await espnApi.getTeams()

        if (apiTeams.length === 0) {
          console.warn('No teams returned from ESPN API - this may indicate a network issue')
          setTeams([])
          return
        }

        // Remove duplicates by abbreviation (shouldn't be any, but just in case)
        const uniqueTeams = Array.from(
          new Map(apiTeams.map(team => [team.abbreviation, team])).values()
        ).sort((a, b) => {
          const nameA = teamDisplayNames[a.abbreviation] || a.name
          const nameB = teamDisplayNames[b.abbreviation] || b.name
          return nameA.localeCompare(nameB)
        })
        console.log(`Successfully loaded ${uniqueTeams.length} teams`)
        setTeams(uniqueTeams)
      } catch (error) {
        console.error('Error fetching teams:', error)
        setTeams([])
        // Show user-friendly error message
        onToast({
          message: 'Unable to load team data. Please check your internet connection and try again.',
          type: 'error'
        })
      }
    }
    fetchTeams()
    // Load team color mappings from Firestore on mount
    loadTeamColorMappings(true)
  }, [])

  // Super Bowl pick: editable in the off-season and preseason; locked at first regular-season kickoff
  useEffect(() => {
    async function checkSeasonStatus() {
      try {
        const result = await getCurrentNFLWeekFromAPI()
        if (result && 'week' in result) {
          const nflWeek = result
          setSuperBowlSeasonYear(getActiveSuperBowlSeasonYear(nflWeek.season))
          setShowSuperBowlPick(true)
          let firstKickoff: Date | null = null
          if (nflWeek.weekType === 'regular' && nflWeek.week === 1) {
            firstKickoff = await espnApi.getFirstRegularSeasonKickoff(nflWeek.season)
          }
          setIsSeasonStarted(isSuperBowlPickLocked(nflWeek, firstKickoff))
        } else {
          // Off-season: picks are open for the upcoming season
          setSuperBowlSeasonYear(getActiveSuperBowlSeasonYear())
          setShowSuperBowlPick(true)
          setIsSeasonStarted(false)
        }
      } catch (error) {
        console.error('Error checking season status:', error)
        setShowSuperBowlPick(false)
        setIsSeasonStarted(false)
      }
    }
    checkSeasonStatus()
  }, [])

  // Load user settings on mount and when the active Super Bowl season year is known
  useEffect(() => {
    if (user) {
      loadUserSettings()
    }
  }, [user, superBowlSeasonYear])

  // Monitor network status - only show warnings for offline state
  useEffect(() => {
    const updateNetworkStatus = () => {
      const isConnected = isOnline()
      setNetworkStatus(isConnected ? '' : 'Offline - Some features may not work')

      // Show offline warning if needed
      if (!isConnected) {
        onToast({
          message: 'You are currently offline. Some features may not work properly.',
          type: 'error'
        })
      }
    }

    // Update immediately
    updateNetworkStatus()

    // Listen for online/offline events
    window.addEventListener('online', updateNetworkStatus)
    window.addEventListener('offline', updateNetworkStatus)

    return () => {
      window.removeEventListener('online', updateNetworkStatus)
      window.removeEventListener('offline', updateNetworkStatus)
    }
  }, [onToast])

  const loadUserSettings = async () => {
    if (!user) return

    // Check if Firebase is initialized
    if (!db) {
      console.warn('Firebase not initialized, cannot load user settings')
      return
    }

    const profilesPromise = loadOwnedProfiles().catch((profileError) => {
      console.error('Error loading profiles:', profileError)
      onToast({
        message: 'Failed to load profiles. Please try again.',
        type: 'error'
      })
    })

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        setOriginalUserData(data)
        const picksMap: SuperBowlPicksMap = { ...(data.superBowlPicks || {}) }
        if (!picksMap['2025'] && data.superBowlPick) {
          picksMap['2025'] = data.superBowlPick
        }
        setSuperBowlPicksMap(picksMap)
        setSettings({
          displayName: data.displayName || '',
          superBowlPick: getSuperBowlPickForSeason(
            { superBowlPicks: picksMap, superBowlPick: data.superBowlPick },
            superBowlSeasonYear
          ),
          emailNotifications: data.emailNotifications || false
        })

        if (user.email && data.email !== user.email) {
          await setDoc(
            doc(db, 'users', user.uid),
            { email: user.email, updatedAt: new Date() },
            { merge: true }
          )
        }
      }
    } catch (error: any) {
      console.error('Error loading user settings:', error)

      // Handle specific Firebase offline errors
      if (error.code === 'unavailable' || error.message?.includes('offline')) {
        console.warn('Firebase is offline - settings will be loaded when connection is restored')
        onToast({
          message: 'Settings are currently offline. Changes will sync when connection is restored.',
          type: 'error'
        })
      } else {
        onToast({
          message: 'Failed to load user settings. Please try again.',
          type: 'error'
        })
      }
    } finally {
      await profilesPromise
    }
  }

  const loadOwnedProfiles = async () => {
    if (!user || !db) return

    const profilesQuery = query(collection(db, 'users'), where('ownerUid', '==', user.uid))
    const snapshot = await getDocs(profilesQuery)
    const nextProfiles = snapshot.docs
      .filter((profileDoc) => profileDoc.id !== user.uid && !isHiddenUser(profileDoc.data()))
      .map((profileDoc) => {
        const data = profileDoc.data()
        const picksMap: SuperBowlPicksMap = { ...(data.superBowlPicks || {}) }
        if (!picksMap['2025'] && data.superBowlPick) {
          picksMap['2025'] = data.superBowlPick
        }
        const displayName = typeof data.displayName === 'string' ? data.displayName : ''
        const profile: OwnedProfile = {
          id: profileDoc.id,
          displayName,
          savedDisplayName: displayName,
          superBowlPick: getSuperBowlPickForSeason(
            { superBowlPicks: picksMap, superBowlPick: data.superBowlPick },
            superBowlSeasonYear
          ),
          superBowlPicks: picksMap,
          legacySuperBowlPick: typeof data.superBowlPick === 'string' ? data.superBowlPick : undefined
        }
        return { profile, createdAt: data.createdAt }
      })
      .sort((a, b) => createdAtMillis(a.createdAt) - createdAtMillis(b.createdAt))
      .map(({ profile }) => profile)

    setProfiles(nextProfiles)
  }

  const saveField = async (field: string, value: any) => {
    if (!user || !db) return

    try {
      await setDoc(doc(db, 'users', user.uid), {
        [field]: value,
        updatedAt: new Date()
      }, { merge: true })

      // Trigger a refresh of user data in navigation
      if (typeof window !== 'undefined' && (window as any).refreshUserData) {
        (window as any).refreshUserData()
      }

      return true
    } catch (error) {
      console.error(`Error saving ${field}:`, error)
      return false
    }
  }

  const saveSuperBowlPick = async (teamAbbreviation: string) => {
    if (!user || !db) return
    if (isSeasonStarted) return
    const nextMap = buildSuperBowlPicksUpdate(
      superBowlPicksMap,
      superBowlSeasonYear,
      teamAbbreviation,
      originalUserData?.superBowlPick
    )
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          superBowlPicks: nextMap,
          updatedAt: new Date()
        },
        { merge: true }
      )
      setSuperBowlPicksMap(nextMap)
      if (typeof window !== 'undefined' && (window as any).refreshUserData) {
        ; (window as any).refreshUserData()
      }
      const teamName =
        teamDisplayNames[teamAbbreviation] ||
        teams.find((t) => t.abbreviation === teamAbbreviation)?.name ||
        teamAbbreviation
      onToast({ message: `${superBowlSeasonYear} Super Bowl pick saved: ${teamName}!`, type: 'success' })
    } catch (error) {
      console.error('Error saving Super Bowl pick:', error)
      onToast({ message: 'Error saving Super Bowl pick. Please try again.', type: 'error' })
    }
  }

  const saveDisplayName = async (name: string) => {
    if (!name.trim()) {
      onToast({ message: 'Name is required. Please enter your name.', type: 'error' })
      return
    }

    const success = await saveField('displayName', name.trim())
    if (success) {
      onToast({ message: 'Name saved successfully!', type: 'success' })
    } else {
      onToast({ message: 'Error saving name. Please try again.', type: 'error' })
    }
  }

  const saveEmailNotifications = async (enabled: boolean) => {
    if (!user || !db) return

    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          emailNotifications: enabled,
          ...(user.email ? { email: user.email } : {}),
          updatedAt: new Date()
        },
        { merge: true }
      )

      if (typeof window !== 'undefined' && (window as any).refreshUserData) {
        (window as any).refreshUserData()
      }

      const message = enabled ? 'Weekly reminders enabled!' : 'Weekly reminders disabled!'
      onToast({ message, type: 'success' })
    } catch (error) {
      console.error('Error saving emailNotifications:', error)
      onToast({ message: 'Error saving notification settings. Please try again.', type: 'error' })
    }
  }

  const handleDisplayNameChange = (value: string) => {
    setSettings(prev => ({ ...prev, displayName: value }))
  }

  const handleDisplayNameBlur = () => {
    if (settings.displayName !== originalUserData?.displayName) {
      saveDisplayName(settings.displayName)
    }
  }

  const handleSuperBowlPickChange = (teamAbbreviation: string) => {
    // Don't allow changes if season has started
    if (isSeasonStarted) return

    setSettings(prev => ({ ...prev, superBowlPick: teamAbbreviation }))
    if (teamAbbreviation) {
      saveSuperBowlPick(teamAbbreviation)
    }
  }

  const handleEmailNotificationsChange = (enabled: boolean) => {
    setSettings(prev => ({ ...prev, emailNotifications: enabled }))
    saveEmailNotifications(enabled)
  }

  const handleProfileNameChange = (profileId: string, value: string) => {
    setProfiles(prev => prev.map(profile => (
      profile.id === profileId ? { ...profile, displayName: value } : profile
    )))
  }

  const saveProfileDisplayName = async (profileId: string) => {
    if (!db) return
    const profile = profiles.find(item => item.id === profileId)
    if (!profile || profile.displayName === profile.savedDisplayName) return
    if (!profile.displayName.trim()) {
      onToast({ message: 'Name is required. Please enter a name.', type: 'error' })
      return
    }

    try {
      const displayName = profile.displayName.trim()
      await setDoc(doc(db, 'users', profileId), {
        displayName,
        updatedAt: new Date()
      }, { merge: true })
      setProfiles(prev => prev.map(item => (
        item.id === profileId ? { ...item, displayName, savedDisplayName: displayName } : item
      )))
      onToast({ message: 'Name saved successfully!', type: 'success' })
    } catch (error) {
      console.error('Error saving profile name:', error)
      onToast({ message: 'Error saving name. Please try again.', type: 'error' })
    }
  }

  const saveProfileSuperBowlPick = async (profileId: string, teamAbbreviation: string) => {
    if (!db || isSeasonStarted || !teamAbbreviation) return
    const profile = profiles.find(item => item.id === profileId)
    if (!profile) return

    const nextMap = buildSuperBowlPicksUpdate(
      profile.superBowlPicks,
      superBowlSeasonYear,
      teamAbbreviation,
      profile.legacySuperBowlPick
    )
    setProfiles(prev => prev.map(item => (
      item.id === profileId
        ? { ...item, superBowlPick: teamAbbreviation, superBowlPicks: nextMap }
        : item
    )))

    try {
      await setDoc(doc(db, 'users', profileId), {
        superBowlPicks: nextMap,
        updatedAt: new Date()
      }, { merge: true })
      const teamName =
        teamDisplayNames[teamAbbreviation] ||
        teams.find((t) => t.abbreviation === teamAbbreviation)?.name ||
        teamAbbreviation
      onToast({ message: `${superBowlSeasonYear} Super Bowl pick saved: ${teamName}!`, type: 'success' })
    } catch (error) {
      console.error('Error saving profile Super Bowl pick:', error)
      onToast({ message: 'Error saving Super Bowl pick. Please try again.', type: 'error' })
    }
  }

  const handleHideProfile = async (profileId: string, displayName: string) => {
    if (!db) return
    const name = displayName.trim() || 'this profile'
    if (!window.confirm(`Delete ${name}? They will be hidden from the board. Their picks stay saved.`)) return

    try {
      await setDoc(doc(db, 'users', profileId), {
        hidden: true,
        updatedAt: new Date()
      }, { merge: true })
      setProfiles(prev => prev.filter(profile => profile.id !== profileId))
      onToast({ message: 'Profile deleted.', type: 'success' })
    } catch (error) {
      console.error('Error hiding profile:', error)
      onToast({ message: 'Error deleting profile. Please try again.', type: 'error' })
    }
  }

  const handleAddProfile = () => {
    if (draftProfile) return
    setDraftProfile({
      id: 'draft',
      displayName: '',
      savedDisplayName: '',
      superBowlPick: '',
      superBowlPicks: {}
    })
  }

  const handleDraftNameChange = (value: string) => {
    setDraftProfile(prev => prev ? { ...prev, displayName: value } : prev)
  }

  const handleDraftSuperBowlPick = (teamAbbreviation: string) => {
    if (isSeasonStarted || !teamAbbreviation) return
    setDraftProfile(prev => {
      if (!prev) return prev
      const nextMap = buildSuperBowlPicksUpdate(
        prev.superBowlPicks,
        superBowlSeasonYear,
        teamAbbreviation,
        prev.legacySuperBowlPick
      )
      return { ...prev, superBowlPick: teamAbbreviation, superBowlPicks: nextMap }
    })
  }

  const handleSaveDraft = async () => {
    if (!user || !db || !draftProfile || savingDraft) return
    const displayName = draftProfile.displayName.trim()
    if (!displayName) return

    setSavingDraft(true)
    try {
      const profileRef = doc(collection(db, 'users'))
      const superBowlPicks = draftProfile.superBowlPick
        ? buildSuperBowlPicksUpdate(
          draftProfile.superBowlPicks,
          superBowlSeasonYear,
          draftProfile.superBowlPick,
          draftProfile.legacySuperBowlPick
        )
        : undefined
      await setDoc(profileRef, {
        ownerUid: user.uid,
        displayName,
        createdAt: new Date(),
        ...(superBowlPicks ? { superBowlPicks } : {})
      })
      try {
        await fetch('/api/clipboard-visibility/add-new-user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newUserId: profileRef.id })
        })
      } catch (visibilityError) {
        console.error('Failed to update visibility settings for new profile:', visibilityError)
      }
      setProfiles(prev => [...prev, {
        id: profileRef.id,
        displayName,
        savedDisplayName: displayName,
        superBowlPick: draftProfile.superBowlPick,
        superBowlPicks: superBowlPicks || {}
      }])
      setDraftProfile(null)
      onToast({ message: 'Profile saved.', type: 'success' })
    } catch (error) {
      console.error('Error saving profile:', error)
      onToast({ message: 'Error saving profile. Please try again.', type: 'error' })
    } finally {
      setSavingDraft(false)
    }
  }

  const handleSignOut = async () => {
    setLoading(true)
    try {
      // Check if Firebase is initialized
      if (!auth) {
        onToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
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
    <div className="w-full max-w-[1000px] min-w-0 mx-auto bg-neutral-100 space-y-6 px-4 text-center">
      {/* Network Status Indicator - only show when offline */}
      {networkStatus && (
        <div className="p-3 text-center text-sm font-bold uppercase bg-red-100 text-red-800">
          {networkStatus}
        </div>
      )}

      <div className="w-full min-w-0 border border-black bg-white p-4 space-y-6">
      <div className="w-full min-w-0 flex lg:flex-row flex-col items-center justify-center gap-x-6 gap-y-6">

        <div className="w-full min-w-0">

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
            className="w-full min-w-0 px-3 py-2 text-black/50 uppercase font-bold max-xl:text-base text-center shadow-[0_0_0_1px_#aaa] cursor-not-allowed"
          />

        </div>

        <div className={`w-full min-w-0 ${!settings.displayName ? 'bg-yellow-400 p-4' : ''}`}>
          <label htmlFor="displayName" className="block text-center text-sm font-bold text-black uppercase mb-1">
            {!settings.displayName ? 'Add your name to get started' : 'Name *'}
          </label>
          <input
            id="displayName"
            type="text"
            value={settings.displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            onBlur={handleDisplayNameBlur}
            className="w-full min-w-0 px-3 py-2 bg-neutral-100 uppercase font-bold max-xl:text-base text-center placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
            placeholder="Shorter the better"
          />
        </div>
      </div>

      {showSuperBowlPick && (
        <SuperBowlPickField
          id="superBowlPick"
          seasonYear={superBowlSeasonYear}
          abbreviation={settings.superBowlPick}
          teams={teams}
          locked={isSeasonStarted}
          onChange={handleSuperBowlPickChange}
        />
      )}

      <label className="relative w-full min-w-0 px-12 py-4 border border-black cursor-pointer select-none block">
        <input
          type="checkbox"
          checked={settings.emailNotifications}
          onChange={(e) => handleEmailNotificationsChange(e.target.checked)}
          className="absolute top-1/2 -translate-y-1/2 left-4 w-5 h-5 accent-black cursor-pointer"
        />
        <p className="max-xl:text-base font-bold text-black uppercase leading-none text-balance">
          Get weekly email reminders
        </p>
        <p className="mt-1 text-xs text-black/50 uppercase font-bold text-center text-balance">
          {settings.emailNotifications
            ? 'You will receive an email when a new week starts'
            : 'You will not receive a reminder email when a new week starts'}
        </p>
      </label>
      </div>

      {profiles.map((profile) => (
        <div key={profile.id} className="w-full min-w-0 border border-black bg-white p-4 space-y-6">
          <div className={`w-full min-w-0 ${!profile.displayName ? 'bg-yellow-400 p-4' : ''}`}>
            <div className="relative mb-1">
              <label htmlFor={`profile-name-${profile.id}`} className="block text-center text-sm font-bold text-black uppercase px-8">
                {!profile.displayName ? 'Add your name to get started' : 'Name *'}
              </label>
              <button
                type="button"
                onClick={() => handleHideProfile(profile.id, profile.displayName)}
                aria-label="Delete"
                className="absolute right-0 top-1/2 -translate-y-1/2 material-symbols-sharp !text-base cursor-pointer text-black/50 hover:text-black focus:outline-none"
              >
                delete
              </button>
            </div>
            <input
              id={`profile-name-${profile.id}`}
              type="text"
              value={profile.displayName}
              onChange={(e) => handleProfileNameChange(profile.id, e.target.value)}
              onBlur={() => saveProfileDisplayName(profile.id)}
              className="w-full min-w-0 px-3 py-2 bg-neutral-100 uppercase font-bold max-xl:text-base text-center placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
              placeholder="Shorter the better"
            />
          </div>

          {showSuperBowlPick && (
            <SuperBowlPickField
              id={`profile-super-bowl-${profile.id}`}
              seasonYear={superBowlSeasonYear}
              abbreviation={profile.superBowlPick}
              teams={teams}
              locked={isSeasonStarted}
              onChange={(teamAbbreviation) => saveProfileSuperBowlPick(profile.id, teamAbbreviation)}
            />
          )}
        </div>
      ))}

      {draftProfile && (
        <div className="w-full min-w-0 border border-black bg-white p-4 space-y-6">
          <div className={`w-full min-w-0 ${!draftProfile.displayName ? 'bg-yellow-400 p-4' : ''}`}>
            <div className="relative mb-1">
              <label htmlFor="profile-name-draft" className="block text-center text-sm font-bold text-black uppercase px-8">
                {!draftProfile.displayName ? 'Add your name to get started' : 'Name *'}
              </label>
              <button
                type="button"
                onClick={() => setDraftProfile(null)}
                aria-label="Delete"
                className="absolute right-0 top-1/2 -translate-y-1/2 material-symbols-sharp !text-base cursor-pointer text-black/50 hover:text-black focus:outline-none"
              >
                delete
              </button>
            </div>
            <input
              id="profile-name-draft"
              type="text"
              value={draftProfile.displayName}
              onChange={(e) => handleDraftNameChange(e.target.value)}
              className="w-full min-w-0 px-3 py-2 bg-neutral-100 uppercase font-bold max-xl:text-base text-center placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
              placeholder="Shorter the better"
            />
          </div>

          {showSuperBowlPick && (
            <SuperBowlPickField
              id="profile-super-bowl-draft"
              seasonYear={superBowlSeasonYear}
              abbreviation={draftProfile.superBowlPick}
              teams={teams}
              locked={isSeasonStarted}
              onChange={handleDraftSuperBowlPick}
            />
          )}
        </div>
      )}

      <div className="w-full min-w-0 flex flex-row items-center justify-between gap-4">
        <div>
          {!draftProfile && (
            <button
              type="button"
              onClick={handleAddProfile}
              disabled={!user}
              className="min-w-0 px-4 py-4 border border-black font-bold uppercase max-xl:text-base focus:outline-none disabled:opacity-50"
            >
              Add profile
            </button>
          )}
        </div>

        {draftProfile ? (
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={savingDraft || !draftProfile.displayName.trim()}
            className="bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
          >
            {savingDraft ? 'Saving...' : 'Save'}
          </button>
        ) : (
          <button
            onClick={() => router.push('/dashboard')}
            disabled={!settings.displayName.trim()}
            className="bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
          >
            Done
          </button>
        )}
      </div>

    </div>
  )
}