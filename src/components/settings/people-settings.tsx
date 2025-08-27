'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { teamDisplayNames } from '@/utils/team-names'
import { getTeamByAbbreviation, getTeamLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'
import { loadTeamColorMappings, getTeamColorMapping } from '@/store/team-color-mapping-store'
import { useClipboardVisibilityStore } from '@/store/clipboard-visibility-store'
import { useAuthStore } from '@/store/auth-store'
import { PHIL_USER } from '@/utils/phil-user'
import React from 'react'

interface User {
  uid: string
  email: string
  displayName: string
  superBowlPick: string
  createdAt?: any
  updatedAt?: any
}

interface PeopleSettingsProps {
  onToast: (toast: { message: string; type: 'success' | 'error' }) => void
}

export function PeopleSettings({ onToast }: PeopleSettingsProps) {
  const { user: currentUser } = useAuthStore()
  const { settings, loadSettings, updateVisibleUsers, moveUserInOrder } = useClipboardVisibilityStore()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [teamData, setTeamData] = useState<Record<string, Team>>({})
  const [teamStyles, setTeamStyles] = useState<Record<string, { background: string; logoType: 'default' | 'dark' | 'scoreboard' | 'darkScoreboard' }>>({})
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())

  useEffect(() => {
    loadUsers()
    loadTeamColorMappings(true)
  }, [])

  // Load clipboard visibility settings when current user changes and users are loaded
  useEffect(() => {
    if (currentUser?.uid && users.length > 0) {
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

  const handleSelectAll = async () => {
    const newSelectedUsers = new Set<string>()

    // Add all users
    users.forEach(user => {
      newSelectedUsers.add(user.uid)
    })

    setSelectedUsers(newSelectedUsers)

    if (currentUser?.uid) {
      try {
        await updateVisibleUsers(currentUser.uid, newSelectedUsers)
        onToast({
          message: 'All users will show on clipboard',
          type: 'success'
        })
      } catch (error) {
        onToast({ message: 'Error saving clipboard settings', type: 'error' })
      }
    }
  }

  const handleSelectNone = async () => {
    const newSelectedUsers = new Set<string>()

    // Only keep current user selected
    if (currentUser?.uid) {
      newSelectedUsers.add(currentUser.uid)
    }

    setSelectedUsers(newSelectedUsers)

    if (currentUser?.uid) {
      try {
        await updateVisibleUsers(currentUser.uid, newSelectedUsers)
        onToast({
          message: 'Only your picks will show on clipboard',
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

  const handleMoveUserUp = async (userId: string) => {
    if (!currentUser?.uid) {
      return
    }
    
    try {
      await moveUserInOrder(currentUser.uid, userId, 'up')
      onToast({
        message: 'User order updated',
        type: 'success'
      })
    } catch (error) {
      onToast({ message: 'Error updating user order', type: 'error' })
    }
  }

  const handleMoveUserDown = async (userId: string) => {
    if (!currentUser?.uid) {
      return
    }
    
    try {
      await moveUserInOrder(currentUser.uid, userId, 'down')
      onToast({
        message: 'User order updated',
        type: 'success'
      })
    } catch (error) {
      onToast({ message: 'Error updating user order', type: 'error' })
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
          superBowlPick: data.superBowlPick || '',
          createdAt: data.createdAt,
          updatedAt: data.updatedAt
        })
      })

      // Add Phil to the users list
      const philUser: User = {
        uid: PHIL_USER.uid,
        email: PHIL_USER.email,
        displayName: PHIL_USER.displayName,
        superBowlPick: PHIL_USER.superBowlPick,
        createdAt: PHIL_USER.createdAt,
        updatedAt: PHIL_USER.updatedAt
      }

      // Add Phil to the users data
      usersData.push(philUser)

      setUsers(usersData)

      // Load team data for users with Superbowl picks
      const uniqueTeams = Array.from(new Set(usersData.map(user => user.superBowlPick).filter(Boolean)))
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
          let background = '#1a1a1a' // Default dark background
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
          } else {
            // No mapping exists, use team's primary color
            if (team.color) {
              background = team.color.startsWith('#') ? team.color : `#${team.color}`
            }
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

  // Sort users based on the user order from settings
  const sortedUsers = React.useMemo(() => {
    if (!settings.userOrder.length) {
      return users
    }
    
    // Create a map for quick lookup
    const orderMap = new Map(settings.userOrder.map((id, index) => [id, index]))
    
    return [...users].sort((a, b) => {
      const aIndex = orderMap.get(a.uid) ?? Number.MAX_SAFE_INTEGER
      const bIndex = orderMap.get(b.uid) ?? Number.MAX_SAFE_INTEGER
      return aIndex - bIndex
    })
  }, [users, settings.userOrder])

  if (loading) {
    return (
      <div className="w-full max-w-[1000px] mx-auto bg-neutral-100 space-y-6 text-center">
        <div className="flex items-center justify-center py-8">
          <div className="text-center uppercase font-bold max-xl:text-base">
            Loading users...
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-[1000px] mx-auto bg-neutral-100 space-y-4 text-center">

      <div className="font-bold uppercase mt-4 max-xl:text-base leading-none">
        Manage whose picks you see
      </div>

      {/* New User Visibility Setting */}
      {/* <div className="w-full p-4 pr-2 shadow-[0_0_0_1px_#000000]">
        <div className="flex flex-row items-center justify-between">
          <div className="flex flex-col items-start text-left">
            <div className="font-bold uppercase max-xl:text-base leading-none">
              See new users by default
            </div>
            <div className="text-sm font-bold text-black/50 uppercase leading-none mt-1">
              When new people join, show their picks
            </div>
          </div>
          <div className="flex flex-row items-center justify-center">
            <input
              type="checkbox"
              className="w-4 h-4 accent-black"
              checked={settings.showNewUsersByDefault}
              onChange={(e) => handleShowNewUsersByDefaultChange(e.target.checked)}
            />
          </div>
        </div>
      </div> */}

      {sortedUsers.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-center uppercase font-bold max-xl:text-base text-black/50">
            No users found
          </div>
        </div>
      ) : (
        <div className="space-y-2">

          <div className="flex flex-row gap-8 items-center justify-center px-4 mb-4 text-black/50 uppercase font-bold text-sm">
            <button
              onClick={handleSelectAll}
              className="uppercase"
            >
              Select All
            </button>
            <button
              onClick={handleSelectNone}
              className="uppercase"
            >
              Select None
            </button>
          </div>

          {sortedUsers.map((user, index) => {
            const team = user.superBowlPick ? teamData[user.superBowlPick] : null
            const teamStyle = user.superBowlPick ? teamStyles[user.superBowlPick] : null
            const isCurrentUser = user.uid === currentUser?.uid
            const canMoveUp = !isCurrentUser && index > 1 // Can't move up if you're the second user (index 1)
            const canMoveDown = !isCurrentUser && index < sortedUsers.length - 1
            


            return (
              <div key={user.uid} className="w-full flex flex-row items-center justify-center">
                {/* Main person button */}
                <div 
                  className={`w-full flex flex-row items-center justify-start gap-4 p-4 cursor-pointer ${
                    selectedUsers.has(user.uid) ? 'shadow-[0_0_0_1px_#000000]' : 'text-black/50 bg-black/5'
                  }`}
                  onClick={() => {
                    if (user.uid !== currentUser?.uid) {
                      const newChecked = !selectedUsers.has(user.uid);
                      handleUserCheckboxChange(user.uid, newChecked);
                    }
                  }}
                >
                  {/* checkbox */}
                  <div className="flex flex-row items-center justify-center">
                    <input
                      type="checkbox"
                      className="w-4 h-4 accent-black"
                      checked={selectedUsers.has(user.uid)}
                      disabled={user.uid === currentUser?.uid}
                      onChange={(e) => handleUserCheckboxChange(user.uid, e.target.checked)}
                      onClick={(e) => e.stopPropagation()}
                    />
                  </div>

                  <div className="flex flex-row items-center justify-start gap-4">
                    {/* Superbowl Pick */}
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
                        <div className="xl:w-20 xl:h-20 w-10 h-10 flex items-center justify-center p-1 rounded-full shadow-[0_0_0_1px_#000000]">
                          {/* <div className="text-xs font-bold text-black uppercase text-center leading-none">
                              NO<br/>PICK<br/>YET
                            </div> */}
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
                </div>

                {/* Up/Down arrows - positioned outside the main button */}
                <div className="w-12 flex flex-row items-center justify-center">
                  <div className="flex flex-col gap-4">
                    <button
                      onClick={() => handleMoveUserUp(user.uid)}
                      className={`material-symbols-sharp cursor-pointer hover:text-black text-black/50 ${!canMoveUp ? 'invisible pointer-events-none' : ''}`}
                      tabIndex={!canMoveUp ? -1 : 0}
                      aria-disabled={!canMoveUp}
                    >
                      keyboard_arrow_up
                    </button>
                    <button
                      onClick={() => handleMoveUserDown(user.uid)}
                      className={`material-symbols-sharp cursor-pointer hover:text-black text-black/50 ${!canMoveDown ? 'invisible pointer-events-none' : ''}`}
                      tabIndex={!canMoveDown ? -1 : 0}
                      aria-disabled={!canMoveDown}
                    >
                      keyboard_arrow_down
                    </button>
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