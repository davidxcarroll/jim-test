'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { teamDisplayNames } from '@/utils/team-names'
import { getTeamByAbbreviation, getTeamLogo } from '@/utils/team-utils'
import { Team } from '@/types/mlb'
import { loadTeamColorMappings, getTeamColorMapping } from '@/store/team-color-mapping-store'
import { useClipboardVisibilityStore } from '@/store/clipboard-visibility-store'
import { useAuthStore } from '@/store/auth-store'

interface User {
  uid: string
  email: string
  displayName: string
  worldSeriesPick: string
  createdAt?: any
  updatedAt?: any
}

interface PeopleSettingsProps {
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void
}

export function PeopleSettings({ onToast }: PeopleSettingsProps) {
  const { user: currentUser } = useAuthStore()
  const { settings, loadSettings, updateVisibleUsers } = useClipboardVisibilityStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [teamData, setTeamData] = useState<Record<string, Team>>({})
  const [teamStyles, setTeamStyles] = useState<Record<string, { background: string; logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' }>>({})
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUsers()
    loadTeamColorMappings(true)
  }, [])

  // Load clipboard visibility settings when current user changes
  useEffect(() => {
    if (currentUser?.uid) {
      // Pass all user IDs to ensure all users are visible by default
      const allUserIds = users.map(user => user.uid)
      loadSettings(currentUser.uid, allUserIds)
    }
  }, [currentUser?.uid, loadSettings, users])

  // Initialize selected users from settings when they load
  useEffect(() => {
    const newSelectedUsers = new Set(settings.visibleUsers)
    // Always ensure current user is selected
    if (currentUser?.uid) {
      newSelectedUsers.add(currentUser.uid)
    }
    setSelectedUsers(newSelectedUsers as Set<string>)
  }, [settings.visibleUsers, currentUser?.uid])

  // Calculate master checkbox state
  const allUserIds = users.map(user => user.uid)
  const otherUserIds = allUserIds.filter(id => id !== currentUser?.uid)
  const isAllSelected = otherUserIds.length > 0 && otherUserIds.every(id => selectedUsers.has(id))
  const isIndeterminate = otherUserIds.some(id => selectedUsers.has(id)) && !isAllSelected

  const handleMasterCheckboxChange = async (checked: boolean) => {
    const newSelectedUsers = new Set(selectedUsers)
    
    // Always keep current user selected
    if (currentUser?.uid) {
      newSelectedUsers.add(currentUser.uid)
    }
    
    // Toggle other users based on master checkbox
    otherUserIds.forEach(userId => {
      if (checked) {
        newSelectedUsers.add(userId)
      } else {
        newSelectedUsers.delete(userId)
      }
    })
    
    setSelectedUsers(newSelectedUsers as Set<string>)
    
    if (currentUser?.uid) {
      try {
        await updateVisibleUsers(currentUser.uid, newSelectedUsers as Set<string>)
        onToast({ 
          message: checked ? 'All users will show on clipboard' : 'Only your picks will show on clipboard', 
          type: 'success' 
        })
      } catch (error) {
        onToast({ message: 'Error saving clipboard settings', type: 'error' })
      }
    }
  }

  const handleUserCheckboxChange = async (userId: string, checked: boolean) => {
    // Prevent current user from being deselected
    if (userId === currentUser?.uid && !checked) {
      return
    }
    
    const newSelectedUsers = new Set(selectedUsers)
    if (checked) {
      newSelectedUsers.add(userId)
    } else {
      newSelectedUsers.delete(userId)
    }
    setSelectedUsers(newSelectedUsers as Set<string>)
    
    if (currentUser?.uid) {
      try {
        await updateVisibleUsers(currentUser.uid, newSelectedUsers as Set<string>)
        
        // Find the user's display name for the toast message
        const user = users.find(u => u.uid === userId)
        const userName = user?.displayName || 'Unknown user'
        
        onToast({ 
          message: checked 
            ? `${userName}'s picks will show on clipboard` 
            : `${userName}'s picks will be hidden from clipboard`, 
          type: 'success' 
        })
      } catch (error) {
        onToast({ message: 'Error saving clipboard settings', type: 'error' })
      }
    }
  }

  const loadUsers = async () => {
    if (!db) {
      onToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }

    try {
      setLoading(true)
      const usersQuery = query(collection(db, 'users'), orderBy('displayName'))
      const querySnapshot = await getDocs(usersQuery)

      const usersData: User[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        usersData.push({
          uid: doc.id,
          email: data.email || '',
          displayName: data.displayName || 'Unknown',
          worldSeriesPick: data.worldSeriesPick || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        })
      })

      // Reorder users so current user appears first
      const reorderedUsers = usersData.sort((a, b) => {
        if (a.uid === currentUser?.uid) return -1
        if (b.uid === currentUser?.uid) return 1
        return 0
      })

      setUsers(reorderedUsers)

      // Load team data for users with World Series picks
      const uniqueTeams = Array.from(new Set(reorderedUsers.map(user => user.worldSeriesPick).filter(Boolean)))
      await loadTeamDataForUsers(uniqueTeams)

    } catch (error) {
      console.error('Error loading users:', error)
      onToast({ message: 'Error loading users. Please try again.', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const loadTeamDataForUsers = async (teamAbbreviations: string[]) => {
    const teamDataMap: Record<string, Team> = {}
    const teamStylesMap: Record<string, { background: string; logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' }> = {}

    for (const abbreviation of teamAbbreviations) {
      try {
        const team = await getTeamByAbbreviation(abbreviation)
        if (team) {
          teamDataMap[abbreviation] = team

          // Get team style based on color mapping
          const mapping = getTeamColorMapping(team.abbreviation)
          let background = '#F5F5F5'
          let logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' = 'dark'

          if (mapping) {
            if (mapping.backgroundColorChoice === 'custom' && mapping.customColor) {
              background = mapping.customColor
            } else if (mapping.backgroundColorChoice === 'secondary' && team.alternateColor) {
              background = team.alternateColor.startsWith('#') ? team.alternateColor : `#${team.alternateColor}`
            } else if (team.color) {
              background = team.color.startsWith('#') ? team.color : `#${team.color}`
            }
            logoType = mapping.logoType || 'dark'
          }

          teamStylesMap[abbreviation] = { background, logoType }
        }
      } catch (error) {
        console.error(`Error loading team data for ${abbreviation}:`, error)
      }
    }

    setTeamData(teamDataMap)
    setTeamStyles(teamStylesMap)
  }

  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'Unknown'
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="w-full max-w-[800px] mx-auto bg-neutral-100 space-y-6 text-center">
        <div className="flex items-center justify-center py-8">
          <div className="text-center uppercase font-bold max-xl:text-base">
            Loading users...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[800px] mx-auto bg-neutral-100 space-y-6 text-center">

      {users.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-center uppercase font-bold max-xl:text-base text-black/50">
            No users found
          </div>
        </div>
      ) : (
        <div className="space-y-2">

          <div className="flex flex-row gap-2 items-center justify-end uppercase font-bold max-xl:text-base">
            <div className="">Show Picks</div>
            <input 
              type="checkbox" 
              className="w-4 h-4 xl:mr-4 mr-2 accent-black" 
              checked={isAllSelected}
              ref={(el) => {
                if (el) {
                  el.indeterminate = isIndeterminate
                }
              }}
              onChange={(e) => handleMasterCheckboxChange(e.target.checked)}
            />
          </div>

          {users.map((user, index) => {
            const team = user.worldSeriesPick ? teamData[user.worldSeriesPick] : null
            const teamStyle = user.worldSeriesPick ? teamStyles[user.worldSeriesPick] : null

            return (
              <div key={user.uid} className="w-full p-2 shadow-[0_0_0_1px_#000000]">

                <div className="flex flex-row items-center justify-start gap-4">

                  <div className="flex flex-1 flex-row items-center justify-start gap-4">

                    {/* World Series Pick */}
                    <div className="flex flex-col items-center">
                      {team && teamStyle ? (
                        <div
                          className="xl:w-20 xl:h-20 w-10 h-10 flex items-center justify-center p-1 rounded-full shadow-[0_0_0_1px_#000000]"
                          style={{ backgroundColor: teamStyle.background }}
                        >
                          <img
                            src={getTeamLogo(team, teamStyle.logoType)}
                            alt={`${team.name} logo`}
                            className="w-full h-full object-contain"
                          />
                        </div>
                      ) : (
                        <div className="text-sm font-bold text-black/30 uppercase">
                          No pick yet
                        </div>
                      )}
                    </div>

                    {/* User Info */}
                    <div className="flex flex-col items-start text-left">
                      <div className="font-bold uppercase max-xl:text-base">
                        {user.displayName}
                        {user.uid === currentUser?.uid && (
                          <span className="text-black/50 text-sm ml-1">(you)</span>
                        )}
                      </div>
                      {/* <div className="text-sm font-bold text-black/50 uppercase">
                      {user.email}
                    </div> */}
                    </div>

                  </div>

                  {/* checkbox */}
                  <div className="flex flex-row items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 accent-black" 
                      checked={selectedUsers.has(user.uid)}
                      disabled={user.uid === currentUser?.uid}
                      onChange={(e) => handleUserCheckboxChange(user.uid, e.target.checked)}
                    />
                  </div>

                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
} 