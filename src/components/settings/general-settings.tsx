'use client'

import { useState, useEffect } from 'react'
import { signOut } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
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
import { getCurrentNFLWeekFromAPI } from '@/utils/date-helpers'

interface UserSettings {
  displayName: string
  superBowlPick: string
  emailNotifications: boolean
}

interface GeneralSettingsProps {
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void
}

export function GeneralSettings({ onToast }: GeneralSettingsProps) {
  const { user } = useAuthStore()
  const [settings, setSettings] = useState<UserSettings>({
    displayName: '',
    superBowlPick: '',
    emailNotifications: false
  })
  const [originalUserData, setOriginalUserData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedTeamStyle, setSelectedTeamStyle] = useState<{ background: string; logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' }>({ background: '#F5F5F5', logoType: 'dark' })
  const [teams, setTeams] = useState<Team[]>([])
  const [networkStatus, setNetworkStatus] = useState<string>('')
  const [isSeasonStarted, setIsSeasonStarted] = useState<boolean>(false)
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
        )
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

  // Check if season has started
  useEffect(() => {
    async function checkSeasonStatus() {
      try {
        const nflWeek = await getCurrentNFLWeekFromAPI()
        if (nflWeek) {
          // Season has started if we're in regular season or postseason (not preseason or pro bowl)
          setIsSeasonStarted(nflWeek.weekType === 'regular' || nflWeek.weekType === 'postseason')
        }
      } catch (error) {
        console.error('Error checking season status:', error)
        // Default to false if we can't determine
        setIsSeasonStarted(false)
      }
    }
    checkSeasonStatus()
  }, [])

  // Load user settings on component mount
  useEffect(() => {
    if (user) {
      loadUserSettings()
    }
  }, [user])

  // Load team data when Super Bowl pick changes
  useEffect(() => {
    const loadTeamDataAndStyle = async () => {
          if (settings.superBowlPick) {
      await loadTeamData(settings.superBowlPick)
      } else {
        setSelectedTeam(null)
        setSelectedTeamStyle({ background: '#F5F5F5', logoType: 'dark' })
      }
    }
    loadTeamDataAndStyle()
      }, [settings.superBowlPick])

  // Subscribe to mapping changes and update team style if needed
  useEffect(() => {
    // Always update preview when mapping changes
    const unsubscribe = subscribeToTeamColorMappingChanges(() => {
      if (selectedTeam) {
        const mapping = getTeamColorMapping(selectedTeam.abbreviation)
        // Use mapping to determine background and logoType
        let background = '#1a1a1a' // Default dark background
        let logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' = 'dark'
        
        if (mapping) {
          // Use mapping configuration
          if (mapping.backgroundColorChoice === 'custom' && mapping.customColor) {
            background = mapping.customColor
          } else if (mapping.backgroundColorChoice === 'secondary' && selectedTeam.alternateColor) {
            background = selectedTeam.alternateColor.startsWith('#') ? selectedTeam.alternateColor : `#${selectedTeam.alternateColor}`
          } else if (selectedTeam.color) {
            background = selectedTeam.color.startsWith('#') ? selectedTeam.color : `#${selectedTeam.color}`
          }
          logoType = mapping.logoType || 'dark'
        } else {
          // No mapping exists, use team's primary color
          if (selectedTeam.color) {
            background = selectedTeam.color.startsWith('#') ? selectedTeam.color : `#${selectedTeam.color}`
          }
        }
        
        console.log('🎨 Team style updated from mapping change:', { team: selectedTeam.abbreviation, background, logoType, mapping: !!mapping })
        setSelectedTeamStyle({ background, logoType })
      }
    })
    return unsubscribe
  }, [selectedTeam])

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

    try {
      const userDoc = await getDoc(doc(db, 'users', user.uid))
      if (userDoc.exists()) {
        const data = userDoc.data()
        setOriginalUserData(data)
        
        setSettings({
          displayName: data.displayName || '',
          superBowlPick: data.superBowlPick || '',
          emailNotifications: data.emailNotifications || false
        })
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
    }
  }

  const loadTeamData = async (abbreviation: string) => {
    try {
      const team = await getTeamByAbbreviation(abbreviation)
      setSelectedTeam(team)
      if (team) {
        const mapping = getTeamColorMapping(team.abbreviation)
        // Use mapping to determine background and logoType
        let background = '#1a1a1a' // Default dark background
        let logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' = 'dark'
        
        if (mapping) {
          // Use mapping configuration
          if (mapping.backgroundColorChoice === 'custom' && mapping.customColor) {
            background = mapping.customColor
          } else if (mapping.backgroundColorChoice === 'secondary' && team.alternateColor) {
            background = team.alternateColor.startsWith('#') ? team.alternateColor : `#${team.alternateColor}`
          } else if (team.color) {
            background = team.color.startsWith('#') ? team.color : `#${team.color}`
          }
          logoType = mapping.logoType || 'dark'
        } else {
          // No mapping exists, use team's primary color
          if (team.color) {
            background = team.color.startsWith('#') ? team.color : `#${team.color}`
          }
        }
        
        console.log('🎨 Team style calculated:', { team: team.abbreviation, background, logoType, mapping: !!mapping })
        setSelectedTeamStyle({ background, logoType })
      }
    } catch (error) {
      console.error('Error loading team data:', error)
      setSelectedTeam(null)
      setSelectedTeamStyle({ background: '#1a1a1a', logoType: 'dark' })
    }
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
    const success = await saveField('superBowlPick', teamAbbreviation)
    if (success) {
      const teamName = teamDisplayNames[teamAbbreviation] || teams.find(t => t.abbreviation === teamAbbreviation)?.name || teamAbbreviation
      onToast({ message: `Super Bowl pick saved: ${teamName}!`, type: 'success' })
    } else {
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
    const success = await saveField('emailNotifications', enabled)
    if (success) {
      const message = enabled ? 'Weekly reminders enabled!' : 'Weekly reminders disabled!'
      onToast({ message, type: 'success' })
    } else {
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
    <div className="w-full max-w-[1000px] mx-auto bg-neutral-100 space-y-6 px-4 text-center">
      {/* Network Status Indicator - only show when offline */}
      {networkStatus && (
        <div className="p-3 text-center text-sm font-bold uppercase bg-red-100 text-red-800">
          {networkStatus}
        </div>
      )}

      <div className="w-full flex lg:flex-row flex-col items-center justify-center gap-x-6 gap-y-6 mt-4">
        
        <div className="w-full">
          
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

        <div className={`w-full ${!settings.displayName ? 'bg-yellow-400 p-4' : ''}`}>
          <label htmlFor="displayName" className="block text-center text-sm font-bold text-black uppercase mb-1">
            {!settings.displayName ? 'Add your name to get started' : 'Name *'}
          </label>
          <input
            id="displayName"
            type="text"
            value={settings.displayName}
            onChange={(e) => handleDisplayNameChange(e.target.value)}
            onBlur={handleDisplayNameBlur}
            className="w-full px-3 py-2 bg-neutral-100 uppercase font-bold max-xl:text-base text-center placeholder:text-black/30 shadow-[0_0_0_1px_#000000] focus:outline-none focus:bg-white"
            placeholder="Shorter the better"
          />
        </div>
      </div>

      <div className="relative">
        <label htmlFor="superBowlPick" className="block text-center text-sm font-bold text-black uppercase mb-1">
          <span className="flex items-center justify-center gap-1">
            {isSeasonStarted && <span className="material-symbols-sharp !text-sm">lock</span>}
            Super Bowl Pick
          </span>
        </label>
        <select
          id="superBowlPick"
          value={settings.superBowlPick}
          onChange={(e) => handleSuperBowlPickChange(e.target.value)}
          disabled={isSeasonStarted}
          className="absolute inset-0 opacity-0 z-20"
          style={{ cursor: isSeasonStarted ? 'not-allowed' : 'pointer' }}
        >
          <option value="">Select a team</option>
          {teams.map((team) => (
            <option key={team.abbreviation} value={team.abbreviation}>
              {teamDisplayNames[team.abbreviation] || team.name}
            </option>
          ))}
        </select>
        <div
          className={`relative w-full h-20 flex items-center justify-center shadow-[0_0_0_1px_#000000] ${isSeasonStarted ? 'cursor-not-allowed' : 'cursor-pointer'}`}
          style={{
            background: selectedTeamStyle.background
          }}
        >
          {selectedTeam?.logo ? (
            <div className="w-full flex flex-row items-center justify-center gap-2 z-10 text-white">
              <img
                src={getTeamLogo(selectedTeam, selectedTeamStyle.logoType)}
                alt={`${selectedTeam.name} logo`}
                className="w-16 h-16 object-contain"
              />
              <div className="text-center uppercase font-bold max-xl:text-base">
                {teamDisplayNames[selectedTeam.abbreviation] || selectedTeam.name}
              </div>
              {!isSeasonStarted && <span className="material-symbols-sharp ml-1">arrow_drop_down</span>}
            </div>
          ) : (
            <div className="flex flex-row items-center justify-center text-center text-black/50 uppercase font-bold z-10">
              {isSeasonStarted ? 'Locked - Season Started' : 'Select a Team'}
              {!isSeasonStarted && <span className="material-symbols-sharp ml-1">arrow_drop_down</span>}
            </div>
          )}
        </div>
      </div>

      <hr className="w-full border-t-[1px] border-black/50" />

      <button
        onClick={() => router.push('/dashboard')}
        disabled={!settings.displayName.trim()}
        className="bg-black text-white py-3 px-4 font-bold uppercase xl:text-3xl text-2xl focus:outline-none disabled:opacity-50"
      >
        Done
      </button>

    </div>
  )
}