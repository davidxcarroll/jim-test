"use client"
import { useState, useEffect } from "react"
import { useGamesForWeek } from "@/hooks/use-nfl-data"
import { dateHelpers } from "@/utils/date-helpers"
import { getTeamDisplayNameFromTeam } from "@/utils/team-names"
import { getTeamCircleSize, getTeamDisplayNameWithFavorite } from "@/utils/team-utils"
import { format, parseISO, isBefore } from "date-fns"
import { ProtectedRoute } from "@/components/protected-route"
import { Navigation } from "@/components/navigation"
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from '@/store/auth-store'
import { useClipboardVisibilityStore } from '@/store/clipboard-visibility-store'
import { Toast } from '@/components/toast'
import { PHIL_USER, getPhilPicks, isPhil, generateAndStorePhilPicks } from '@/utils/phil-user'
import { Tooltip } from '@/components/tooltip'
import { UserStatsModal } from '@/components/user-stats-modal'
// @ts-ignore
import * as Checks from '@/components/checks'
// @ts-ignore
import * as Circles from '@/components/circles'
import React from 'react'
import { LiveGameDisplay } from '@/components/live-game-display'
import { isWeekComplete, shouldWaitUntilNextMorning } from '@/utils/date-helpers'
import { useCurrentWeek } from '@/hooks/use-current-week'

const NUM_WEEKS = 5

// Function to get a random check number (1-7)
function getRandomCheckNumber(): number {
  return Math.floor(Math.random() * 7) + 1
}

// Function to get a random circle-check number (1-9, excluding 02 and 03)
function getRandomCircleCheckNumber(): number {
  const validNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9]
  return validNumbers[Math.floor(Math.random() * validNumbers.length)]
}

// Function to get a random circle-team number (1-3)
function getRandomCircleTeamNumber(): number {
  return Math.floor(Math.random() * 3) + 1
}

// Deterministic index function
function getDeterministicIndex(seed: string, arrLength: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash += seed.charCodeAt(i);
  }
  return hash % arrLength;
}

// Helper to randomize check component
const checkComponents = [
  Checks.Check01, Checks.Check02, Checks.Check03, Checks.Check04, Checks.Check05, Checks.Check06, Checks.Check07
]
function getRandomCheckComponent() {
  return checkComponents[Math.floor(Math.random() * checkComponents.length)]
}

// Helper to get deterministic check component
function getDeterministicCheckComponent(seed: string) {
  const index = getDeterministicIndex(seed, checkComponents.length)
  return checkComponents[index]
}

// Helper to randomize circle-check component
const circleCheckComponents = [
  Circles.CircleCheck01, Circles.CircleCheck02, Circles.CircleCheck03, Circles.CircleCheck04, Circles.CircleCheck05, Circles.CircleCheck06, Circles.CircleCheck07, Circles.CircleCheck08, Circles.CircleCheck09
]
function getRandomCircleCheckComponent() {
  return circleCheckComponents[Math.floor(Math.random() * circleCheckComponents.length)]
}

// Helper to get deterministic circle-check component
function getDeterministicCircleCheckComponent(seed: string) {
  const index = getDeterministicIndex(seed, circleCheckComponents.length)
  return circleCheckComponents[index]
}

// Helper to randomize team circle component by size
type TeamCircleSize = 'sm' | 'md' | 'lg'
const circleTeamSmComponents = [Circles.CircleTeamSm01, Circles.CircleTeamSm02, Circles.CircleTeamSm03]
const circleTeamMdComponents = [Circles.CircleTeamMd01, Circles.CircleTeamMd02, Circles.CircleTeamMd03]
const circleTeamLgComponents = [Circles.CircleTeamLg01, Circles.CircleTeamLg02, Circles.CircleTeamLg03]
function getRandomCircleTeamComponent(size: TeamCircleSize) {
  if (size === 'sm') return circleTeamSmComponents[Math.floor(Math.random() * circleTeamSmComponents.length)]
  if (size === 'md') return circleTeamMdComponents[Math.floor(Math.random() * circleTeamMdComponents.length)]
  return circleTeamLgComponents[Math.floor(Math.random() * circleTeamLgComponents.length)]
}

// Helper to get deterministic team circle component
function getDeterministicCircleTeamComponent(size: TeamCircleSize, seed: string) {
  const arr = size === 'sm' ? circleTeamSmComponents : size === 'md' ? circleTeamMdComponents : circleTeamLgComponents
  const index = getDeterministicIndex(seed, arr.length)
  return arr[index]
}

// Helper to map status to warning tooltip
const statusWarningMap: Record<string, string> = {
  postponed: 'Postponed',
  wdelay: 'Delayed (Weather)',
  fdelay: 'Delayed (Facility)',
  odelay: 'Delayed',
  delayed: 'Delayed',
  suspended: 'Suspended',
  canceled: 'Cancelled',
  cancelled: 'Cancelled',
  maintenance: 'Maintenance',
  unnecessary: 'Unnecessary',
  'if-necessary': 'If Necessary',
}

// Add a helper for likely postponed heuristic
function isLikelyPostponed(game: any) {
  return (
    game.status === 'post' &&
    (!game.homeScore || Number(game.homeScore) === 0) &&
    (!game.awayScore || Number(game.awayScore) === 0)
  )
}

// Skeleton loading component
function DashboardSkeleton() {
  return (
    <div className="min-w-fit font-chakra text-2xl pb-16 select-none">
      <Navigation />

      <div className="flex flex-col pt-10 pr-10 lg:mx-8 md:mx-4 sm:mx-2 bg-neutral-100">
        <div className="md:pb-8 pb-4">
          <table className="min-w-full bg-neutral-100 border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="bg-neutral-100">
                {/* Week selector skeleton */}
                <th className="sticky top-0 left-0 z-50 bg-neutral-100 shadow-[1px_0_0_#cccccc] w-48 min-w-fit h-16 align-middle p-0">
                  <div className="week-selector h-16 flex items-center justify-center relative">
                    <div className="w-full flex justify-center items-center gap-1 px-8 whitespace-nowrap font-bold uppercase xl:text-base text-sm">
                      <div className="w-24 h-6 bg-black/10 animate-pulse"></div>
                    </div>
                  </div>
                </th>
                {/* User name headers skeleton */}
                {Array.from({ length: 5 }, (_, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-50 bg-neutral-100 shadow-[inset_1px_0_0_#cccccc] w-32 h-16 align-middle p-0"
                  >
                    <div className="w-full h-16 flex items-center justify-center">
                      <div className="w-16 h-8 bg-black/10 animate-pulse"></div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="h-8"></tr>
              {/* Generate 10 matchup rows (20 team rows + spacers) */}
              {Array.from({ length: 10 }, (_, matchupIndex) => [
                // Home team row
                <tr key={`skeleton-home-${matchupIndex}`}>
                  <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_1px_0_#cccccc,1px_0_0_#cccccc] px-2 xl:h-12 h-6 align-middle">
                    <div className="flex items-center justify-center h-full">
                      <div className="w-32 h-6 bg-black/10 animate-pulse"></div>
                    </div>
                  </td>
                  {Array.from({ length: 5 }, (_, userIndex) => (
                    <td
                      key={userIndex}
                      className="shadow-[inset_1px_0_0_#cccccc,inset_0_-1px_0_#cccccc] px-0 xl:h-12 h-6 align-middle"
                    >
                      <div className="w-8 h-8 bg-black/10 animate-pulse mx-auto"></div>
                    </td>
                  ))}
                </tr>,
                // Away team row
                <tr key={`skeleton-away-${matchupIndex}`}>
                  <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_-1px_0_#cccccc,1px_0_0_#cccccc] px-2 xl:h-12 h-6 align-middle">
                    <div className="flex items-center justify-center h-full">
                      <div className="w-32 h-6 bg-black/10 animate-pulse"></div>
                    </div>
                  </td>
                  {Array.from({ length: 5 }, (_, userIndex) => (
                    <td
                      key={userIndex}
                      className="shadow-[inset_1px_0_0_#cccccc] px-0 xl:h-12 h-6 align-middle"
                    >
                      <div className="w-8 h-8 bg-black/10 animate-pulse mx-auto"></div>
                    </td>
                  ))}
                </tr>,
                // Spacer row
                <tr key={`skeleton-spacer-${matchupIndex}`}>
                  <td colSpan={6} className="h-8"></td>
                </tr>
              ]).flat()}
            </tbody>
          </table>
        </div>
      </div>

      <div className="w-[] mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>
    </div>
  )
}

function WeeklyMatchesPage() {
  const { user: currentUser } = useAuthStore()
  const { settings: clipboardSettings, isLoading: clipboardLoading, loadSettings, subscribeToChanges } = useClipboardVisibilityStore()
  const { currentWeek: apiCurrentWeek, weekInfo, loading: weekLoading, error: weekError } = useCurrentWeek()
  const [weekOffset, setWeekOffset] = useState(0)
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false)
  const [allAvailableWeeks, setAllAvailableWeeks] = useState<Array<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason'; startDate: Date; endDate: Date; label?: string }>>([])
  const [loadingWeeks, setLoadingWeeks] = useState(true)
  
  // Fetch all available weeks from API
  useEffect(() => {
    const fetchAllWeeks = async () => {
      if (!weekInfo) return
      
      try {
        setLoadingWeeks(true)
        const { espnApi } = await import('@/lib/espn-api')
        const weeks = await espnApi.getAllAvailableWeeks(weekInfo.season)
        setAllAvailableWeeks(weeks)
      } catch (error) {
        console.error('Error fetching all available weeks:', error)
        setAllAvailableWeeks([])
      } finally {
        setLoadingWeeks(false)
      }
    }
    
    fetchAllWeeks()
  }, [weekInfo?.season])

  // Get available weeks - use all weeks from API, filter to show only past/current weeks
  const availableWeeks = React.useMemo(() => {
    const today = new Date()
    const isWednesday = dateHelpers.isNewWeekDay(today)
    
    // If we have all available weeks from API, use them
    if (allAvailableWeeks.length > 0 && weekInfo) {
      const weeks: Array<{ index: number; weekNumber: number; weekType: 'preseason' | 'regular' | 'postseason'; weekKey: string; label?: string; startDate: Date }> = []
      
      // Find the index of the current week
      const currentWeekIndex = allAvailableWeeks.findIndex(w => 
        w.week === weekInfo.week && 
        w.weekType === weekInfo.weekType &&
        w.season === weekInfo.season
      )
      
      // Show all weeks up to and including the current week
      // Only show weeks that have started or are starting today
      for (let i = 0; i <= currentWeekIndex; i++) {
        const week = allAvailableWeeks[i]
        const weekHasStarted = week.startDate <= today
        
        // Show current week if it's Wednesday or later, or if it has started
        const isCurrentWeek = i === currentWeekIndex
        const shouldShowCurrentWeek = isCurrentWeek && (isWednesday || weekHasStarted)
        
        if (shouldShowCurrentWeek || (i < currentWeekIndex && weekHasStarted)) {
          const weekKey = week.weekType === 'preseason' 
            ? `preseason-${week.week}` 
            : week.weekType === 'postseason' && week.label
              ? week.label.toLowerCase().replace(/\s+/g, '-')
              : `week-${week.week}`
          
          weeks.push({
            index: i,
            weekNumber: week.week,
            weekType: week.weekType,
            weekKey: `${week.season}_${weekKey}`,
            label: week.label,
            startDate: week.startDate
          })
        }
      }
      
      return weeks
    }
    
    // Fallback: if API data not available yet, return empty array
    return []
  }, [allAvailableWeeks, weekInfo])

  // Calculate week data based on the selected week offset
  const getWeekData = (offset: number) => {
    // If we have available weeks from the filtered list, use the one at the offset index
    if (availableWeeks.length > 0 && offset < availableWeeks.length && allAvailableWeeks.length > 0) {
      const selectedWeekItem = availableWeeks[offset]
      // Find the full week info from allAvailableWeeks
      const selectedWeek = allAvailableWeeks.find(w => 
        w.week === selectedWeekItem.weekNumber && 
        w.weekType === selectedWeekItem.weekType &&
        w.season === weekInfo?.season
      )
      
      if (selectedWeek) {
        const weekKey = selectedWeek.weekType === 'preseason' 
          ? `preseason-${selectedWeek.week}` 
          : selectedWeek.weekType === 'postseason' && selectedWeek.label
            ? selectedWeek.label.toLowerCase().replace(/\s+/g, '-')
            : `week-${selectedWeek.week}`
        
        return {
          start: selectedWeek.startDate,
          end: selectedWeek.endDate,
          season: String(selectedWeek.season),
          week: weekKey,
          weekNumber: selectedWeek.week,
          weekInfo: selectedWeek
        }
      }
    }
    
    // Fallback to old calculation if weeks not loaded yet
    if (weekInfo) {
      const targetWeekNumber = weekInfo.week - offset
      const targetWeekStart = new Date(weekInfo.startDate.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      const targetWeekEnd = new Date(weekInfo.endDate.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
      
      return {
        start: targetWeekStart,
        end: targetWeekEnd,
        season: String(weekInfo.season),
        week: weekInfo.weekType === 'preseason' ? `preseason-${targetWeekNumber}` : `week-${targetWeekNumber}`,
        weekNumber: targetWeekNumber
      }
    }
    
    // Final fallback
    const today = new Date()
    const fallbackWeekStart = new Date(today.getTime() - (offset * 7 * 24 * 60 * 60 * 1000))
    const fallbackWeekEnd = new Date(fallbackWeekStart.getTime() + (6 * 24 * 60 * 60 * 1000))
    
    return {
      start: fallbackWeekStart,
      end: fallbackWeekEnd,
      season: '2025',
      week: `week-${2 - offset}`,
      weekNumber: 2 - offset
    }
  }

  const currentWeekData = getWeekData(weekOffset)
  const { data: games, isLoading } = useGamesForWeek(currentWeekData.start, currentWeekData.end)
  

  const [users, setUsers] = useState<any[]>([])
  const [userPicksByUser, setUserPicksByUser] = useState<Record<string, any>>({})
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPicks, setLoadingPicks] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)

  const [loadTimeout, setLoadTimeout] = useState(false)

  // Filter and sort users based on clipboard visibility settings and user order
  const visibleUsers = React.useMemo(() => {
    const filteredUsers = users.filter(user => {
      // Always show current user
      if (user.id === currentUser?.uid) return true
      // Show other users only if they're in the visible users set
      return clipboardSettings.visibleUsers.has(user.id)
    })

    // Sort users based on the user order from settings
    if (clipboardSettings.userOrder.length) {
      // Create a map for quick lookup
      const orderMap = new Map(clipboardSettings.userOrder.map((id, index) => [id, index]))

      return filteredUsers.sort((a, b) => {
        const aIndex = orderMap.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const bIndex = orderMap.get(b.id) ?? Number.MAX_SAFE_INTEGER
        return aIndex - bIndex
      })
    }

    return filteredUsers
  }, [users, currentUser?.uid, clipboardSettings.visibleUsers, clipboardSettings.userOrder])
  useEffect(() => {
    // Reset timeout when loading states change
    setLoadTimeout(false)
    const timer = setTimeout(() => setLoadTimeout(true), 10000) // 10 seconds
    return () => clearTimeout(timer)
  }, [isLoading, loadingUsers, loadingPicks, clipboardLoading])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element
      if (!target.closest('.week-selector')) {
        setIsWeekDropdownOpen(false)
      }
    }

    if (isWeekDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isWeekDropdownOpen])

  // Load clipboard visibility settings when current user changes
  useEffect(() => {
    if (currentUser?.uid) {
      // Pass all user IDs to ensure all users are visible by default
      const allUserIds = users.map(user => user.id)
      loadSettings(currentUser.uid, allUserIds)
      const unsubscribe = subscribeToChanges(currentUser.uid)
      return unsubscribe
    }
  }, [currentUser?.uid, loadSettings, subscribeToChanges, users])

  // Fetch all users
  useEffect(() => {
    setLoadingUsers(true)
    const fetchUsers = async () => {
      try {
        // Check if Firebase is initialized
        if (!db) {
          console.warn('Firebase not initialized, cannot fetch users')
          setUsers([])
          return
        }

        const usersSnapshot = await getDocs(collection(db, 'users'))
        const usersData = usersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as any)).filter((user: any) => user.displayName) // Only include users with display names

        setUsers(usersData)
      } catch (error) {
        console.error('Error fetching users:', error)
        setUsers([])
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchUsers()
  }, [currentUser])

  // Note: Phil's picks are generated automatically on Wednesday mornings via cron job
  // However, we also generate them on-demand if they're missing to ensure they always appear

  // Fetch all user picks for this week
  useEffect(() => {
    if (visibleUsers.length === 0 || clipboardLoading || !games || games.length === 0) return

    // Add a small delay to prevent rapid re-fetching when settings change
    const timeoutId = setTimeout(() => {
      setLoadingPicks(true)
      const fetchAllPicks = async () => {
        try {
          // Check if Firebase is initialized
          if (!db) {
            console.warn('Firebase not initialized, cannot fetch picks')
            setUserPicksByUser({})
            return
          }

          const picksPromises = visibleUsers.map(async (user) => {
            const weekKey = `${currentWeekData.season}_${currentWeekData.week}`
            const picksDocRef = doc(db, 'users', user.id, 'picks', weekKey)
            const picksDoc = await getDoc(picksDocRef)
            
            // If this is Phil and picks don't exist, generate them on-demand
            if (isPhil(user.id) && !picksDoc.exists() && games && games.length > 0) {
              console.log(`🏈 Phil's picks missing for ${weekKey}, generating on-demand...`)
              try {
                await generateAndStorePhilPicks(games, weekKey)
                // Fetch the newly created picks
                const newPicksDoc = await getDoc(picksDocRef)
                return {
                  userId: user.id,
                  picks: newPicksDoc.exists() ? newPicksDoc.data() : {}
                }
              } catch (error) {
                console.error('❌ Error generating Phil picks on-demand:', error)
                // Fall back to generating picks in memory (won't persist but will display)
                const philPicks = getPhilPicks(games, weekKey)
                return {
                  userId: user.id,
                  picks: philPicks
                }
              }
            }
            
            return {
              userId: user.id,
              picks: picksDoc.exists() ? picksDoc.data() : {}
            }
          })

          const picksResults = await Promise.all(picksPromises)
          const picksMap: Record<string, any> = {}
          picksResults.forEach(result => {
            picksMap[result.userId] = result.picks
          })
          setUserPicksByUser(picksMap)
        } catch (error) {
          console.error('Error fetching picks:', error)
          setUserPicksByUser({})
        } finally {
          setLoadingPicks(false)
        }
      }
      fetchAllPicks()
    }, 100) // 100ms delay

    return () => clearTimeout(timeoutId)
  }, [visibleUsers.map(u => u.id).join(','), currentWeekData.season, currentWeekData.week, games])

  // Group games by day
  const gamesByDay: Record<string, typeof games> = {}
  games?.forEach((game) => {
    const day = format(parseISO(game.date), "EEE, MMM d")
    if (!gamesByDay[day]) gamesByDay[day] = []
    gamesByDay[day].push(game)
  })

  // Helper to filter unique games by id
  function getUniqueGamesById(games: any[]) {
    const seen = new Set()
    return games.filter(game => {
      if (seen.has(game.id)) return false
      seen.add(game.id)
      return true
    })
  }

  // Helper to convert text to title case
  function toTitleCase(text: string): string {
    return text
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ')
  }

  // Helper to truncate text if longer than 8 characters
  function truncateName(name: string): string {
    if (name.length > 8) {
      return name.substring(0, 8) + '...'
    }
    return name
  }

  // User display names for header
  const userDisplayNames = React.useMemo(() => {
    return visibleUsers.map(u => truncateName(toTitleCase(u.displayName || u.id)))
  }, [visibleUsers])

  // Save pick to Firestore
  const handlePick = async (gameId: string, pick: 'home' | 'away') => {
    if (!currentUser) return
    setSaving(true)
    setToast(null)

    // Check if game is locked
    const game = games?.find(g => g.id === gameId)
    if (game && isBefore(parseISO(game.date), new Date())) {
      // Check if game has finished vs just started
      if (game.status === 'final' || game.status === 'post') {
        setToast({ message: 'Game has concluded!', type: 'error' })
      } else {
        setToast({ message: 'Game has already started!', type: 'error' })
      }
      setSaving(false)
      return
    }

    // Toggle logic: if same team is clicked again, remove the pick
    const currentPick = userPicksByUser[currentUser.uid]?.[gameId]?.pickedTeam
    let newPicks
    if (currentPick === pick) {
      // Remove the pick
      const { [gameId]: removed, ...rest } = userPicksByUser[currentUser.uid] || {}
      newPicks = rest
    } else {
      // Set new pick
      newPicks = {
        ...userPicksByUser[currentUser.uid],
        [gameId]: { pickedTeam: pick, pickedAt: serverTimestamp() }
      }
    }

    // Update local state immediately for responsive UI
    setUserPicksByUser(prev => ({
      ...prev,
      [currentUser.uid]: newPicks
    }))

    try {
      await setDoc(doc(db, 'users', currentUser.uid, 'picks', `${currentWeekData.season}_${currentWeekData.week}`), newPicks, { merge: true })
      setToast({ message: currentPick === pick ? 'Pick removed!' : 'Pick saved!', type: 'success' })
    } catch (err) {
      setToast({ message: 'Failed to save pick. Please try again.', type: 'error' })
      // Revert local state on error
      setUserPicksByUser(prev => ({
        ...prev,
        [currentUser.uid]: userPicksByUser[currentUser.uid]
      }))
    } finally {
      setSaving(false)
    }
  }

  // Set initial week offset to current week when weeks are loaded
  useEffect(() => {
    if (availableWeeks.length > 0 && weekInfo) {
      const currentWeekIndex = availableWeeks.findIndex(w => 
        w.weekNumber === weekInfo.week && 
        w.weekType === weekInfo.weekType
      )
      if (currentWeekIndex >= 0 && weekOffset === 0) {
        setWeekOffset(currentWeekIndex)
      }
    }
  }, [availableWeeks.length, weekInfo])

  // Show skeleton while loading
  if ((isLoading || loadingUsers || loadingPicks || clipboardLoading || weekLoading || loadingWeeks) && !loadTimeout) {
    return <DashboardSkeleton />
  }

  // Show error if week loading fails
  if (weekError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen font-chakra text-2xl bg-neutral-100">
        <div className="mb-4 text-red-600 font-bold">Unable to load NFL schedule data.</div>
        <div className="mb-4 text-neutral-600 text-lg">The ESPN API is currently unavailable.</div>
        <button
          className="px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-neutral-800 transition"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  // Show error if timeout occurs
  if (loadTimeout && (isLoading || loadingUsers || loadingPicks || clipboardLoading || weekLoading)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen font-chakra text-2xl bg-neutral-100">
        <div className="mb-4 text-red-600 font-bold">Something went wrong loading the dashboard.</div>
        <button
          className="px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-neutral-800 transition"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    )
  }

  return (
    <div className="font-chakra pb-16 select-none">

      <Navigation />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col lg:px-8 md:px-4 sm:px-2">
        <div className="flex flex-col pt-10 bg-neutral-100">
          {/* Main scrollable container */}
          <div className="md:pb-8 pb-4">
            <table className="min-w-full bg-neutral-100 border-separate" style={{ borderSpacing: 0 }}>
              <thead>
                <tr className="bg-neutral-100">
                  {/* Sticky week selector header cell */}
                  <th className="sticky top-0 left-0 z-[60] bg-neutral-100 shadow-[1px_0_0_#000000] w-48 min-w-fit h-16 align-middle p-0" style={{ willChange: 'transform' }}>
                    <div className="week-selector h-16 flex items-center justify-center px-4 relative cursor-pointer">
                      <div
                        className="w-full flex items-center justify-between gap-1 p-2 pl-4 whitespace-nowrap font-bold uppercase xl:text-base text-sm shadow-[inset_0_0_0_1px_#000000]"
                        onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                      >
                        {/* label */}
                        {(() => {
                          // Find the current week info from available weeks
                          const currentWeekInfo = availableWeeks.find(w => w.index === weekOffset)

                          if (currentWeekInfo) {
                            // Use label from API if available (especially for postseason)
                            if (currentWeekInfo.label) {
                              return currentWeekInfo.label.toUpperCase()
                            }
                            
                            // Handle preseason vs regular season week display
                            if (currentWeekInfo.weekType === 'preseason') {
                              return `PRESEASON ${currentWeekInfo.weekNumber}`
                            } else if (currentWeekInfo.weekType === 'postseason') {
                              // Fallback for postseason without label
                              return `POSTSEASON ${currentWeekInfo.weekNumber}`
                            } else {
                              return `WEEK ${currentWeekInfo.weekNumber}`
                            }
                          }

                          // Fallback if week not found
                          return 'Loading...'
                        })()}
                        <span className={`material-symbols-sharp transition-transform`}>
                          arrow_drop_down
                        </span>
                      </div>
                      {/* Dropdown overlay */}
                      {isWeekDropdownOpen && (
                        <div className="absolute top-full left-1/2 right-0 -translate-x-1/2 -translate-y-2 w-[calc(100%-20px)] xl:text-base text-sm bg-white shadow-[inset_0_0_0_1px_#000000] z-[70] shadow-2xl max-h-[60vh] overflow-y-auto">
                          {[...availableWeeks].reverse().map((weekItem, index) => (
                            <div
                              key={weekItem.index}
                              className={`px-3 py-2 cursor-pointer hover:bg-black hover:text-white font-bold text-center uppercase ${weekItem.index === weekOffset ? 'bg-black/10' : ''}`}
                              onClick={() => {
                                setWeekOffset(weekItem.index)
                                setIsWeekDropdownOpen(false)
                              }}
                            >
                              {(() => {
                                // Use label from API if available (especially for postseason)
                                if (weekItem.label) {
                                  return weekItem.label.toUpperCase()
                                }
                                
                                // Handle preseason vs regular season week display
                                let weekDisplay
                                if (weekItem.weekType === 'preseason') {
                                  weekDisplay = `PRESEASON ${weekItem.weekNumber}`
                                } else if (weekItem.weekType === 'postseason') {
                                  // Fallback for postseason without label
                                  weekDisplay = `POSTSEASON ${weekItem.weekNumber}`
                                } else {
                                  weekDisplay = `WEEK ${weekItem.weekNumber}`
                                }

                                return weekDisplay
                              })()}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </th>
                  {/* User name headers */}
                  {userDisplayNames.map((name, userIndex) => (
                    <th
                      key={userIndex}
                      className="sticky top-0 z-50 bg-neutral-100 shadow-[-1px_0_0_#000000] h-16 align-middle px-2"
                      style={{ willChange: 'transform' }}
                    >
                      <div
                        className="w-full h-16 flex lg:items-center items-end justify-center font-jim xl:text-4xl text-3xl cursor-pointer"
                        onClick={() => {
                          setSelectedUser({ id: visibleUsers[userIndex].id, name })
                        }}
                      >
                        <span className="max-lg:max-w-8 flex lg:justify-center justify-start font-light max-lg:-rotate-90">{name}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>


                {/* weekly recap here */}

                {(() => {
                  // Only show recap if all games are finished
                  const allGames = games || [];
                  const allGamesFinished = allGames.length > 0 && allGames.every(g => g.status === 'final' || g.status === 'post');
                  if (!allGamesFinished) return null;

                  // Compute recap stats for each user
                  const playedGames = allGames.filter(g => g.status === 'final' || g.status === 'post');
                  const recapStats = visibleUsers.map(user => {
                    let correct = 0;
                    // For each played game, check if user picked and if correct
                    playedGames.forEach(game => {
                      const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam;
                      const homeScore = Number(game.homeScore) ?? 0;
                      const awayScore = Number(game.awayScore) ?? 0;
                      const homeWon = homeScore > awayScore;
                      const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon);
                      if (pick && pickCorrect) correct++;
                      // If no pick, counts as incorrect (do nothing)
                    });
                    const total = playedGames.length;
                    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
                    return { userId: user.id, correct, total, percentage };
                  });

                  // Find the max correct picks
                  const maxCorrect = Math.max(...recapStats.map(s => s.correct));
                  // Find all winners (could be a tie)
                  const winnerIds = recapStats.filter(s => s.correct === maxCorrect && maxCorrect > 0).map(s => s.userId);

                  // Save week recap data to Firestore for modal use
                  // Always save to ensure data is up-to-date (cron job handles initial calculation)
                  // ⚠️ CRITICAL: We ONLY write to weekRecaps collection here - NEVER touch user picks
                  // User picks are sacred and only modified by user actions (handlePick function)
                  const saveWeekRecap = async () => {
                    try {
                      const weekRecapData = {
                        weekId: `${currentWeekData.season}_${currentWeekData.week}`,
                        season: currentWeekData.season,
                        week: currentWeekData.week,
                        calculatedAt: serverTimestamp(),
                        userStats: recapStats.map(stat => ({
                          userId: stat.userId,
                          correct: stat.correct,
                          total: stat.total,
                          percentage: stat.percentage,
                          isTopScore: winnerIds.includes(stat.userId)
                        }))
                      };

                      await setDoc(doc(db, 'weekRecaps', `${currentWeekData.season}_${currentWeekData.week}`), weekRecapData);
                      console.log('💾 Saved/updated week recap data');
                    } catch (error) {
                      console.error('❌ Error saving week recap data:', error);
                    }
                  };

                  // Save the recap data (don't await to avoid blocking the UI)
                  saveWeekRecap();

                  return (
                    <tr className="font-bold uppercase text-center xl:text-base text-sm bg-yellow-200">
                      <td className="sticky left-0 z-20 bg-yellow-200 text-center px-2 xl:h-16 h-12 align-middle font-bold xl:text-base text-sm shadow-[1px_0_0_#000000]">
                        RECAP
                      </td>
                      {recapStats.map((stat, idx) => (
                        <td key={stat.userId} className="text-center align-middle font-bold xl:text-base text-sm shadow-[-1px_0_0_#000000]">
                          <span className="inline-flex items-center justify-center gap-1">
                            {stat.percentage}%
                            {winnerIds.includes(stat.userId) && (
                              <span title="Top Score" className="ml-0.5" role="img">🔥</span>
                            )}
                          </span>
                          <br />
                          {stat.correct}/{stat.total}
                        </td>
                      ))}
                    </tr>
                  );
                })()}


                <tr className="h-8"></tr>
                {Object.entries(gamesByDay).flatMap(([day, dayGames], dayIdx) => [
                  // Day header row
                  <tr key={day + '-header'}>
                    <td
                      className="sticky top-[66px] left-0 z-30 xl:text-base text-sm bg-neutral-100 shadow-[inset_0_1px_0_#000000,inset_0_-1px_0_#000000] font-bold uppercase py-2 px-8 whitespace-nowrap"
                    >
                      {day}
                    </td>
                    {visibleUsers.map((user, userIndex) => (
                      <td
                        key={userIndex}
                        className="sticky top-[66px] z-20 xl:text-base text-sm bg-neutral-100 shadow-[inset_0_1px_0_#000000,inset_0_-1px_0_#000000] font-bold uppercase py-2 px-4"
                      >
                      </td>
                    ))}
                  </tr>,
                  // Blank row below day header
                  <tr key={day + '-spacer-below'}>
                    <td colSpan={1 + userDisplayNames.length} className="h-8"></td>
                  </tr>,
                  // All game rows for this day, flattened
                  ...(getUniqueGamesById(dayGames ?? [])).flatMap((game, gameIdx) => {
                    return [
                      <tr key={game.id + '-' + game.date + '-away'}>
                        {/* Sticky left: Away team info */}
                        <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_1px_0_#000000,1px_0_0_#000000] px-2 xl:h-12 h-6 align-middle font-jim xl:text-4xl text-3xl">
                          <div className="relative flex whitespace-nowrap items-center justify-center h-full">
                            {(() => {
                              const isFinal = game.status === 'final' || game.status === 'post'
                              const awayWon = isFinal && (game.awayScore ?? 0) > (game.homeScore ?? 0)
                              if (awayWon) {
                                const CircleTeam = getDeterministicCircleTeamComponent(getTeamCircleSize(game.awayTeam), `${game.id}_away`)
                                return <CircleTeam className="w-full h-[0.9em]" />
                              }
                              return null
                            })()}
                            <span className="text-black">
                              {getTeamDisplayNameWithFavorite(game.awayTeam, game, false)}
                            </span>
                          </div>
                        </td>
                        {/* User picks for away team */}
                        {visibleUsers.map((user, userIndex) => {
                          const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                          const awayCorrect = pick === 'away' && (game.awayScore ?? 0) > (game.homeScore ?? 0)
                          const isCurrentUser = user.id === currentUser?.uid
                          const isGameFinished = game.status === 'final' || game.status === 'post'
                          const AwayCheck = getDeterministicCheckComponent(`${game.id}_${user.id}_away`)
                          const AwayCircleCheck = getDeterministicCircleCheckComponent(`${game.id}_${user.id}_away`)
                          return (
                            <td
                              key={userIndex}
                              className={`shadow-[inset_1px_0_0_#000000,inset_0_-1px_0_#000000] px-0 xl:h-12 h-6 align-middle font-jim xl:text-4xl text-3xl min-w-14 ${isCurrentUser && game.status === 'scheduled' && !saving
                                ? 'cursor-pointer hover:bg-white'
                                : isCurrentUser && game.status !== 'scheduled'
                                  ? 'cursor-not-allowed'
                                  : ''
                                }`}
                              onClick={isCurrentUser ? () => handlePick(game.id, 'away') : undefined}
                            >
                              {pick === 'away' && (
                                <div className="relative flex items-center justify-center h-full">
                                  <AwayCheck className="xl:w-9 xl:h-9 w-7 h-7 transform translate-x-1 -translate-y-1" />
                                  {awayCorrect && isGameFinished && <AwayCircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>,
                      <tr key={game.id + '-' + game.date + '-home'}>
                        {/* Sticky left: Home team info */}
                        <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_-1px_0_#000000,1px_0_0_#000000] px-2 xl:h-12 h-6 align-middle font-jim xl:text-4xl text-3xl">
                          <div className="relative flex items-center justify-center h-full whitespace-nowrap">
                            {/* Show warning icon if needed, else live icon if live */}
                            {((statusWarningMap[game.status?.toLowerCase?.()] || isLikelyPostponed(game)) ? (
                              <div className="absolute right-[-18.5px] top-[-1.5px] -translate-y-1/2 h-5 w-5 flex items-center justify-center bg-yellow-400 rounded-full">
                                <Tooltip content={
                                  isLikelyPostponed(game)
                                    ? 'Likely postponed (no result reported)'
                                    : statusWarningMap[game.status.toLowerCase()]
                                } position="right">
                                  <span className="material-symbols-sharp !text-sm mb-[1px]">warning</span>
                                </Tooltip>
                              </div>
                            ) : game.status === "live" && (
                              <div className="absolute right-[-18.5px] top-[-1.5px] -translate-y-1/2 h-5 w-5 flex items-center justify-center bg-green-400 shadow-[0_0_0_1px_#000000] rounded-full">
                                <Tooltip content="Game in Progress" position="right">
                                  <span className="material-symbols-sharp !text-sm mb-[1px] animate-ping">sports_football</span>
                                </Tooltip>
                              </div>
                            ))}
                            {(() => {
                              const isFinal = game.status === 'final' || game.status === 'post'
                              const homeWon = isFinal && (game.homeScore ?? 0) > (game.awayScore ?? 0)
                              if (homeWon) {
                                const CircleTeam = getDeterministicCircleTeamComponent(getTeamCircleSize(game.homeTeam), `${game.id}_home`)
                                return <CircleTeam className="w-full h-[0.9em]" />
                              }
                              return null
                            })()}
                            <span className="text-black">
                              {getTeamDisplayNameWithFavorite(game.homeTeam, game, true)}
                            </span>
                          </div>
                        </td>
                        {/* User picks for home team */}
                        {visibleUsers.map((user, userIndex) => {
                          const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                          const homeCorrect = pick === 'home' && (game.homeScore ?? 0) > (game.awayScore ?? 0)
                          const isCurrentUser = user.id === currentUser?.uid
                          const isGameFinished = game.status === 'final' || game.status === 'post'
                          const HomeCheck = getDeterministicCheckComponent(`${game.id}_${user.id}_home`)
                          const HomeCircleCheck = getDeterministicCircleCheckComponent(`${game.id}_${user.id}_home`)
                          return (
                            <td
                              key={userIndex}
                              className={`shadow-[inset_1px_0_0_#000000] px-0 xl:h-12 h-6 align-middle font-jim xl:text-4xl text-3xl min-w-14 ${isCurrentUser && game.status === 'scheduled' && !saving
                                ? 'cursor-pointer hover:bg-white'
                                : isCurrentUser && game.status !== 'scheduled'
                                  ? 'cursor-not-allowed'
                                  : ''
                                }`}
                              onClick={isCurrentUser ? () => handlePick(game.id, 'home') : undefined}
                            >
                              {pick === 'home' && (
                                <div className="relative flex items-center justify-center h-full">
                                  <HomeCheck className="xl:w-9 xl:h-9 w-7 h-7 transform translate-x-1" />
                                  {homeCorrect && isGameFinished && <HomeCircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                                </div>
                              )}
                            </td>
                          )
                        })}
                      </tr>,
                      // New: LiveGameDisplay row (only for live games)
                      ...(game.status === 'live' ? [
                        <tr key={game.id + '-' + game.date + '-livegame'}>
                          <td colSpan={1 + userDisplayNames.length} className="p-0 align-middle shadow-lg">
                            <LiveGameDisplay gameId={game.id} />
                          </td>
                        </tr>
                      ] : []),
                      // Blank row between matchups
                      <tr key={game.id + '-' + game.date + '-spacer'}>
                        <td colSpan={1 + userDisplayNames.length} className="h-8"></td>
                      </tr>
                    ]
                  })
                ])}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="w-[98dvw] mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>

      {/* User Stats Modal */}
      {selectedUser && (
        <UserStatsModal
          isOpen={!!selectedUser}
          onClose={() => {
            console.log('🚪 Closing modal for user:', selectedUser)
            setSelectedUser(null)
          }}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}

    </div>
  )
}

export default WeeklyMatchesPage