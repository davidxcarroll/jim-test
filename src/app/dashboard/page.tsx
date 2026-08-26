"use client"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { useGamesForWeek } from "@/hooks/use-nfl-data"
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
import { OffSeasonContent } from '@/components/off-season-content'
import { ClipboardFooter } from '@/components/clipboard-footer'
import { isWeekComplete, shouldWaitUntilNextMorning, getWeekKey, getRoundDisplayName, getSelectableWeeks, getPickableWeek, getFirstRegularSeasonWeek } from '@/utils/date-helpers'
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

function GamesSkeletonRows({ userCount }: { userCount: number }) {
  const columns = Math.max(userCount, 1)
  const colSpan = 1 + columns
  return (
    <>
      <tr className="h-8"></tr>
      {/* Day header skeleton */}
      <tr>
        <td
          colSpan={colSpan}
          className="sticky top-[66px] z-30 xl:text-base text-sm bg-neutral-100 shadow-[inset_0_1px_0_#cccccc,inset_0_-1px_0_#cccccc] font-bold uppercase p-0"
        >
          <div className="sticky left-0 w-[98dvw] py-2 text-center whitespace-nowrap">
            <div className="sm:w-48 w-40 h-5 bg-black/10 animate-pulse mx-auto"></div>
          </div>
        </td>
      </tr>
      <tr>
        <td colSpan={colSpan} className="h-8"></td>
      </tr>
      {/* Generate 4 matchup rows (8 team rows + spacers) */}
      {Array.from({ length: 4 }, (_, matchupIndex) => [
        // Home team row
        <tr key={`skeleton-home-${matchupIndex}`}>
          <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_1px_0_#cccccc,1px_0_0_#cccccc] xl:h-12 h-6 align-middle">
            <div className="flex items-center justify-center h-full">
              <div className="w-32 h-6 bg-black/10 animate-pulse"></div>
            </div>
          </td>
          {Array.from({ length: columns }, (_, userIndex) => (
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
          <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_-1px_0_#cccccc,1px_0_0_#cccccc] xl:h-12 h-6 align-middle">
            <div className="flex items-center justify-center h-full">
              <div className="w-32 h-6 bg-black/10 animate-pulse"></div>
            </div>
          </td>
          {Array.from({ length: columns }, (_, userIndex) => (
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
          <td colSpan={colSpan} className="h-8"></td>
        </tr>
      ]).flat()}
    </>
  )
}

// Skeleton loading component
function DashboardSkeleton() {
  return (
    <div className="clipboard-wide min-w-fit font-chakra text-2xl pb-16 select-none">
      <Navigation />

      <div className="flex flex-col pr-10 lg:mx-8 md:mx-4 sm:mx-2 bg-neutral-100">
        {/* Week title skeleton */}
        <div className="sm:-mx-2 md:-mx-4 lg:-mx-8">
          <p className="sticky left-0 self-start shrink-0 w-[98dvw] p-6 sm:pt-12 pt-8 font-chakra font-bold text-[clamp(2rem,min(5dvw,7dvh),5rem)] text-center text-balance uppercase leading-none">
            <span className="inline-block align-middle w-[10ch] h-[0.85em] bg-black/10 animate-pulse" aria-hidden />
          </p>
        </div>

        <div className="md:pb-8 pb-4">
          <table className="min-w-full bg-neutral-100 border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="bg-neutral-100">
                {/* Week selector skeleton */}
                <th className="sticky top-0 left-0 z-50 bg-neutral-100 shadow-[1px_0_0_#cccccc] sm:w-48 w-40 min-w-fit h-16 align-middle p-0">
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
              <GamesSkeletonRows userCount={5} />
            </tbody>
          </table>
        </div>
      </div>

      <ClipboardFooter />
    </div>
  )
}

function WeeklyMatchesPage() {
  const router = useRouter()
  const { user: currentUser } = useAuthStore()
  const { settings: clipboardSettings, isLoading: clipboardLoading, loadSettings, subscribeToChanges } = useClipboardVisibilityStore()
  const { currentWeek: apiCurrentWeek, weekInfo, loading: weekLoading, error: weekError } = useCurrentWeek()
  const [weekOffset, setWeekOffset] = useState(0)
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false)
  const [allAvailableWeeks, setAllAvailableWeeks] = useState<Array<{ week: number; season: number; weekType: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'; startDate: Date; endDate: Date; label?: string }>>([])
  const [, setLoadingWeeks] = useState(true)

  type WeekSelectorItem = {
    index: number
    label?: string
    weekNumber?: number
    weekType?: 'preseason' | 'regular' | 'postseason' | 'pro-bowl'
    weekKey?: string
    startDate?: Date
  }

  // Fetch weeks for the current ESPN season only (off-season: no week list — wrap-up view)
  useEffect(() => {
    const fetchAllWeeks = async () => {
      if (!weekInfo) {
        setAllAvailableWeeks([])
        setLoadingWeeks(false)
        return
      }
      try {
        setLoadingWeeks(true)
        const { espnApi } = await import('@/lib/espn-api')
        const weeks = await espnApi.getAllAvailableWeeks(weekInfo.season)
        const weeksWithoutProBowl = weeks.filter(
          (w) => w.weekType !== 'pro-bowl' && !w.label?.toLowerCase().includes('pro bowl')
        )
        const firstRegular = getFirstRegularSeasonWeek(weeksWithoutProBowl)
        // Preseason does not count: only Week 1. Regular/postseason: exclude preseason.
        const filtered =
          weekInfo.weekType === 'preseason'
            ? firstRegular
              ? [firstRegular]
              : []
            : weeksWithoutProBowl.filter((w) => w.weekType !== 'preseason')
        setAllAvailableWeeks(filtered)
      } catch (error) {
        console.error('Error fetching all available weeks:', error)
        setAllAvailableWeeks([])
      } finally {
        setLoadingWeeks(false)
      }
    }
    fetchAllWeeks()
  }, [weekInfo?.season, weekInfo?.weekType])

  // Week selector items for current season (no prior-season bookend in the picks UI)
  const availableWeeks = React.useMemo((): WeekSelectorItem[] => {
    if (!weekInfo) return []

    const selectable = getSelectableWeeks(allAvailableWeeks, weekInfo)
    const weeks: WeekSelectorItem[] = selectable.map((week, index) => {
      const weekKey = getWeekKey(week.weekType, week.week, week.label)
      return {
        index,
        weekNumber: week.week,
        weekType: week.weekType,
        weekKey: `${week.season}_${weekKey}`,
        label: week.label,
        startDate: week.startDate
      }
    })

    // Always expose the current week if the calendar list is empty or match failed
    // (not during preseason — we only show Week 1 there)
    if (weeks.length === 0 && weekInfo.weekType !== 'preseason') {
      const weekKey = getWeekKey(weekInfo.weekType, weekInfo.week, weekInfo.label)
      weeks.push({
        index: 0,
        weekNumber: weekInfo.week,
        weekType: weekInfo.weekType,
        weekKey: `${weekInfo.season}_${weekKey}`,
        label: weekInfo.label,
        startDate: weekInfo.startDate
      })
    }

    return weeks
  }, [allAvailableWeeks, weekInfo])

  // Calculate week data based on the selected week offset
  const getWeekData = (offset: number) => {
    // Off-season wrap-up: no games
    if (!weekInfo) {
      const dummyStart = new Date('2000-01-01')
      const dummyEnd = new Date('2000-01-02')
      return {
        start: dummyStart,
        end: dummyEnd,
        season: String(new Date().getFullYear()),
        week: 'season',
        weekNumber: 0,
        isSeasonSummary: true as const
      }
    }

    const selectedItem = availableWeeks[offset]
    const seasonForLookup = weekInfo.season
    if (availableWeeks.length > 0 && selectedItem) {
      const selectedWeek = allAvailableWeeks.find(
        (w) =>
          w.week === selectedItem.weekNumber &&
          w.weekType === selectedItem.weekType &&
          w.season === seasonForLookup
      )
      if (selectedWeek) {
        const weekKey = getWeekKey(selectedWeek.weekType, selectedWeek.week, selectedWeek.label)
        return {
          start: selectedWeek.startDate,
          end: selectedWeek.endDate,
          season: String(selectedWeek.season),
          week: weekKey,
          weekNumber: selectedWeek.week,
          weekInfo: selectedWeek,
          isSeasonSummary: false as const
        }
      }
    }

    const weekKey = getWeekKey(weekInfo.weekType, weekInfo.week, weekInfo.label)
    return {
      start: weekInfo.startDate,
      end: weekInfo.endDate,
      season: String(weekInfo.season),
      week: weekKey,
      weekNumber: weekInfo.week,
      isSeasonSummary: false as const
    }
  }

  const currentWeekData = getWeekData(weekOffset)
  const { data: games, isLoading, isError: gamesError } = useGamesForWeek(
    currentWeekData.start,
    currentWeekData.end,
    !currentWeekData.isSeasonSummary
  )


  const [users, setUsers] = useState<any[]>([])
  const [userPicksByUser, setUserPicksByUser] = useState<Record<string, any>>({})
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [, setLoadingPicks] = useState(false)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)
  const [visibleLiveGames, setVisibleLiveGames] = useState<Set<string>>(new Set())

  const clipboardSettingsPending =
    clipboardLoading ||
    (clipboardSettings.lastUpdated === null && clipboardSettings.userOrder.length === 0)

  // Filter and sort users based on clipboard visibility settings and user order.
  // Until settings load, show everyone so columns don't flash in one-at-a-time.
  const visibleUsers = React.useMemo(() => {
    const filteredUsers = clipboardSettingsPending
      ? users
      : users.filter(user => {
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
  }, [users, currentUser?.uid, clipboardSettings.visibleUsers, clipboardSettings.userOrder, clipboardSettingsPending])
  const visibleUserIdsKey = visibleUsers.map(u => u.id).join(',')

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
    if (!currentUser?.uid) return
    // Wait for the user list so we don't persist empty visibleUsers on first run
    if (users.length > 0) {
      loadSettings(currentUser.uid, users.map(user => user.id))
    }
    const unsubscribe = subscribeToChanges(currentUser.uid)
    return unsubscribe
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

  // Fetch all user picks for this week (skip when "2025 Season" bookend is selected)
  useEffect(() => {
    if ('isSeasonSummary' in currentWeekData && currentWeekData.isSeasonSummary) {
      setLoadingPicks(false)
      return
    }
    if (visibleUsers.length === 0 || !games || games.length === 0) {
      setLoadingPicks(false)
      return
    }

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
  }, [visibleUserIdsKey, currentWeekData.season, currentWeekData.week, games])

  // Group games by day
  const gamesByDay: Record<string, typeof games> = {}
  games?.forEach((game) => {
    const day = format(parseISO(game.date), "EEEE, MMMM d")
    if (!gamesByDay[day]) gamesByDay[day] = []
    gamesByDay[day].push(game)
  })

  // Clean up visibleLiveGames set - remove games that are no longer live
  useEffect(() => {
    if (!games) return
    setVisibleLiveGames(prev => {
      const newSet = new Set(prev)
      let changed = false
      prev.forEach(gameId => {
        const game = games.find(g => g.id === gameId)
        if (!game || game.status !== 'live') {
          newSet.delete(gameId)
          changed = true
        }
      })
      return changed ? newSet : prev
    })
  }, [games])

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

  // Default to current week when the selector is ready
  const hasSetInitialWeek = React.useRef(false)
  useEffect(() => {
    hasSetInitialWeek.current = false
  }, [weekInfo?.season, weekInfo?.weekType, weekInfo?.week])
  useEffect(() => {
    if (hasSetInitialWeek.current || !weekInfo || availableWeeks.length === 0) return
    // Wait for the ESPN calendar list so we don't lock onto the 1-item fallback at index 0
    if (allAvailableWeeks.length === 0) return
    const firstRegular = getFirstRegularSeasonWeek(allAvailableWeeks)
    const pickable = getPickableWeek(new Date(), weekInfo, allAvailableWeeks)
    const defaultWeek =
      weekInfo.weekType === 'preseason' && firstRegular ? firstRegular : pickable
    const defaultItem = availableWeeks.find(
      (w) => w.weekNumber === defaultWeek.week && w.weekType === defaultWeek.weekType
    )
    if (defaultItem !== undefined) {
      setWeekOffset(defaultItem.index)
      hasSetInitialWeek.current = true
    } else {
      setWeekOffset(availableWeeks.length - 1)
      hasSetInitialWeek.current = true
    }
  }, [availableWeeks, weekInfo, allAvailableWeeks])

  const isSeasonSummaryView = !weekInfo
  const stillLoadingForSeasonView = weekLoading
  const stillLoadingForWeekView = weekLoading || loadingUsers

  // Show error if week loading fails (but only if it's a real error, not off-season)
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

  if (isSeasonSummaryView ? stillLoadingForSeasonView : stillLoadingForWeekView) {
    return <DashboardSkeleton />
  }

  const selectedWeekInfo = availableWeeks.find(w => w.index === weekOffset)
  const weekTitle = selectedWeekInfo
    ? getRoundDisplayName(
        selectedWeekInfo.label,
        selectedWeekInfo.weekType!,
        selectedWeekInfo.weekNumber!,
        { verbose: true }
      )
    : 'Loading...'
  const hasPastWeeks = availableWeeks.length > 1

  return (
    <div className="clipboard-wide min-h-dvh flex flex-col font-chakra select-none">

      <Navigation />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col lg:px-8 md:px-4 sm:px-2">
        <div className="flex flex-col bg-neutral-100">
          {/* Off-season wrap-up (winner + stats) */}
          {isSeasonSummaryView ? (
            <OffSeasonContent />
          ) : (
            <>

              {/* Week title */}
              <div className="sm:-mx-2 md:-mx-4 lg:-mx-8">
                <p className="sticky left-0 self-start shrink-0 w-[98dvw] p-6 sm:pt-12 pt-8 font-chakra font-bold text-[clamp(2rem,min(5dvw,7dvh),5rem)] text-center text-balance uppercase leading-none">
                  {weekTitle}
                </p>
              </div>

              {/* Main scrollable container */}
              <div className="md:pb-8 pb-4">
                <table className="min-w-full bg-neutral-100 border-separate" style={{ borderSpacing: 0 }}>
                  <thead>
                    <tr className="bg-neutral-100">
                      {/* Sticky week selector header cell */}
                      <th className="sticky top-0 left-0 z-[60] bg-neutral-100 shadow-[1px_0_0_#000000] sm:w-48 w-40 min-w-fit h-16 align-middle p-0" style={{ willChange: 'transform' }}>
                        {hasPastWeeks && (
                          <div className="week-selector h-16 flex items-center justify-center px-4 relative cursor-pointer">
                            <div
                              className="w-fit flex items-center justify-between gap-1 p-2 pl-4 bg-neutral-100 whitespace-nowrap font-bold uppercase xl:text-base text-sm shadow-[inset_0_0_0_1px_#000000]"
                              onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                            >
                              {/* label */}
                              Weeks
                              <span className={`material-symbols-sharp transition-transform`}>
                                arrow_drop_down
                              </span>
                            </div>
                            {/* Dropdown overlay */}
                            {isWeekDropdownOpen && (
                              <div className="absolute top-full left-1/2 right-0 -translate-x-1/2 -translate-y-2 w-[calc(100%-20px)] xl:text-base text-sm bg-white shadow-[inset_0_0_0_1px_#000000] z-[70] shadow-2xl max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-black scrollbar-track-black">
                                {[...availableWeeks].reverse().map((weekItem) => (
                                  <div
                                    key={weekItem.index}
                                    className={`px-3 py-2 cursor-pointer hover:bg-black hover:text-white font-bold text-center uppercase ${weekItem.index === weekOffset ? 'bg-black/30' : ''}`}
                                    onClick={() => {
                                      setWeekOffset(weekItem.index)
                                      setIsWeekDropdownOpen(false)
                                    }}
                                  >
                                    {getRoundDisplayName(
                                      weekItem.label,
                                      weekItem.weekType!,
                                      weekItem.weekNumber!
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </th>
                      {/* User name headers */}
                      {userDisplayNames.map((name, userIndex) => (
                        <th
                          key={userIndex}
                          className="sticky top-0 z-50 bg-neutral-100 shadow-[-1px_0_0_#000000] h-16 align-middle px-1"
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
                    {gamesError ? (
                      <tr>
                        <td colSpan={1 + userDisplayNames.length} className="px-2 py-12 text-center">
                          <div className="mb-4 text-red-600 font-bold">Unable to load games.</div>
                          <button
                            className="px-6 py-3 bg-black text-white rounded-lg font-bold hover:bg-neutral-800 transition"
                            onClick={() => window.location.reload()}
                          >
                            Retry
                          </button>
                        </td>
                      </tr>
                    ) : isLoading ? (
                      <GamesSkeletonRows userCount={userDisplayNames.length} />
                    ) : (
                      <>
                    {/* weekly recap here */}

                    {(() => {
                      // Only show recap if all games are finished
                      const allGames = games || [];
                      const allGamesFinished = allGames.length > 0 && allGames.every(g => g.status === 'final' || g.status === 'post');
                      if (!allGamesFinished) return null;

                      // Compute recap stats for visible users (for display in this row)
                      const playedGames = allGames.filter(g => g.status === 'final' || g.status === 'post');
                      const recapStats = visibleUsers.map(user => {
                        let correct = 0;
                        playedGames.forEach(game => {
                          const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam;
                          const homeScore = Number(game.homeScore) ?? 0;
                          const awayScore = Number(game.awayScore) ?? 0;
                          const homeWon = homeScore > awayScore;
                          const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon);
                          if (pick && pickCorrect) correct++;
                        });
                        const total = playedGames.length;
                        const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
                        return { userId: user.id, correct, total, percentage };
                      });

                      // Find the max correct picks (among visible users, for display)
                      const maxCorrect = Math.max(...recapStats.map(s => s.correct));
                      const winnerIds = recapStats.filter(s => s.correct === maxCorrect && maxCorrect > 0).map(s => s.userId);

                      // Save week recap to Firestore with ALL users so overall leaderboard is complete.
                      // We must not overwrite with only visibleUsers (clipboard subset) or users like Jon/Carter disappear from stats.
                      const saveWeekRecap = async () => {
                        if (!db || users.length === 0) return
                        try {
                          const weekId = `${currentWeekData.season}_${currentWeekData.week}`
                          const picksByUser: Record<string, Record<string, { pickedTeam?: string }>> = {}
                          await Promise.all(users.map(async (user) => {
                            const snap = await getDoc(doc(db, 'users', user.id, 'picks', weekId))
                            picksByUser[user.id] = snap.exists() ? (snap.data() as Record<string, { pickedTeam?: string }>) : {}
                          }))
                          const allUserStats = users.map(user => {
                            let correct = 0
                            playedGames.forEach(game => {
                              const pick = picksByUser[user.id]?.[String(game.id)]?.pickedTeam
                              const homeScore = Number(game.homeScore) ?? 0
                              const awayScore = Number(game.awayScore) ?? 0
                              const homeWon = homeScore > awayScore
                              const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon)
                              if (pick && pickCorrect) correct++
                            })
                            const total = playedGames.length
                            const percentage = total > 0 ? Math.round((correct / total) * 100) : 0
                            return { userId: user.id, correct, total, percentage }
                          })
                          const globalMaxCorrect = Math.max(...allUserStats.map(s => s.correct))
                          const globalWinnerIds = allUserStats.filter(s => s.correct === globalMaxCorrect && globalMaxCorrect > 0).map(s => s.userId)
                          const weekRecapData = {
                            weekId,
                            season: currentWeekData.season,
                            week: currentWeekData.week,
                            calculatedAt: serverTimestamp(),
                            userStats: allUserStats.map(stat => ({
                              userId: stat.userId,
                              correct: stat.correct,
                              total: stat.total,
                              percentage: stat.percentage,
                              isTopScore: globalWinnerIds.includes(stat.userId)
                            }))
                          }
                          await setDoc(doc(db, 'weekRecaps', weekId), weekRecapData)
                          console.log('💾 Saved week recap for', allUserStats.length, 'users')
                        } catch (error) {
                          console.error('❌ Error saving week recap data:', error)
                        }
                      }

                      saveWeekRecap()

                      return (
                        <tr className="font-bold uppercase text-center xl:text-base text-sm bg-yellow-200">
                          <td className="sticky left-0 z-20 bg-yellow-200 text-center px-2 xl:h-16 h-12 align-middle font-bold xl:text-base text-sm shadow-[1px_0_0_#000000]">
                            RECAP
                          </td>
                          {recapStats.map((stat, idx) => (
                            <td key={stat.userId} className="text-center align-middle font-bold xl:text-base text-sm shadow-[-1px_0_0_#000000]">
                              <span className="inline-flex items-center justify-center">
                                {stat.percentage}%
                                {winnerIds.includes(stat.userId) && (
                                  <span title="Top Score" className="ml-0.5 text-orange-600" role="img">🔥</span>
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
                          colSpan={1 + userDisplayNames.length}
                          className="sticky top-[66px] z-30 xl:text-base text-sm bg-neutral-100 shadow-[inset_0_1px_0_#000000,inset_0_-1px_0_#000000] font-bold uppercase p-0"
                        >
                          <div className="sticky left-0 sm:left-2 md:left-4 lg:left-8 w-[98dvw] sm:w-[calc(98dvw-1rem)] md:w-[calc(98dvw-2rem)] lg:w-[calc(98dvw-4rem)] py-2 text-center whitespace-nowrap">
                            {day}
                          </div>
                        </td>
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
                            <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_1px_0_#000000,1px_0_0_#000000] sm:xl:h-12 h-6 align-middle font-jim xl:text-4xl text-3xl">
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
                            <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_-1px_0_#000000,1px_0_0_#000000] xl:h-12 h-6 align-middle font-jim xl:text-4xl text-3xl">
                              <div className="relative flex w-full items-center justify-center h-full whitespace-nowrap">
                                {/* Show warning icon if needed, else live icon if live */}
                                {((statusWarningMap[game.status?.toLowerCase?.()] || isLikelyPostponed(game)) ? (
                                  <div className="absolute right-0 top-[-1.5px] translate-x-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center bg-yellow-400 rounded-full">
                                    <Tooltip content={
                                      isLikelyPostponed(game)
                                        ? 'Likely postponed (no result reported)'
                                        : statusWarningMap[game.status.toLowerCase()]
                                    } position="right">
                                      <span className="material-symbols-sharp !text-sm mb-[1px]">warning</span>
                                    </Tooltip>
                                  </div>
                                ) : game.status === "live" && (
                                  <div
                                    className="absolute right-0 top-[-1.5px] translate-x-1/2 -translate-y-1/2 h-5 w-5 flex items-center justify-center bg-green-400 shadow-[0_0_0_1px_#000000] rounded-full cursor-pointer hover:bg-green-500 transition-colors z-20"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      setVisibleLiveGames(prev => {
                                        const newSet = new Set(prev)
                                        if (newSet.has(game.id)) {
                                          newSet.delete(game.id)
                                        } else {
                                          newSet.add(game.id)
                                        }
                                        return newSet
                                      })
                                    }}
                                  >
                                    <Tooltip content="Game in Progress - Tap to show live data" position="right">
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
                          // New: LiveGameDisplay row (only for live games that are toggled visible)
                          ...(game.status === 'live' && visibleLiveGames.has(game.id) ? [
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
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </div>

      <ClipboardFooter />

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