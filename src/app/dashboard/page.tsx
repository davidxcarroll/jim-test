"use client"
import { useState, useEffect } from "react"
import { useGamesForWeek } from "@/hooks/use-mlb-data"
import { dateHelpers } from "@/utils/date-helpers"
import { getTeamDisplayNameFromTeam } from "@/utils/team-names"
import { getTeamCircleSize } from "@/utils/team-utils"
import { format, parseISO, isBefore } from "date-fns"
import { ProtectedRoute } from "@/components/protected-route"
import { Navigation } from "@/components/navigation"
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { useAuthStore } from '@/store/auth-store'
import { Toast } from '@/components/toast'
import { Tooltip } from '@/components/tooltip'
import { UserStatsModal } from '@/components/user-stats-modal'
// @ts-ignore
import * as Checks from '@/components/checks'
// @ts-ignore
import * as Circles from '@/components/circles'
import React from 'react'

const NUM_WEEKS = 5

// MLB season start (adjust as needed)
const MLB_SEASON_START = new Date('2024-03-28')

function getStartOfWeekNDaysAgo(weeksAgo: number) {
  const today = new Date()
  const { start } = dateHelpers.getSundayWeekRange(
    new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7 * weeksAgo)
  )
  return start
}

function getSeasonAndWeek(sunday: Date) {
  const season = String(sunday.getFullYear())
  const week = Math.ceil((sunday.getTime() - MLB_SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
  return { season, week: `week-${week}` }
}

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
    <div className="min-w-fit font-chakra text-2xl pb-16 select-none overflow-x-clip">
      <Navigation />

      <div className="flex flex-col pt-10 lg:mx-8 md:mx-4 sm:mx-2 bg-neutral-100 overflow-x-clip">
        <div className="md:pb-8 pb-4">
          <table className="min-w-full bg-neutral-100 border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="bg-neutral-100">
                {/* Week selector skeleton */}
                <th className="sticky top-0 left-0 z-50 bg-neutral-100 shadow-[1px_0_0_#cccccc] w-48 min-w-fit h-16 align-middle p-0">
                  <div className="week-selector h-16 flex items-center justify-center relative">
                    <div className="w-full h-full flex items-center justify-center gap-1 font-bold uppercase max-xl:text-sm">
                      <div className="w-24 h-6 bg-black/10 animate-pulse"></div>
                    </div>
                  </div>
                </th>
                {/* User name headers skeleton */}
                {Array.from({ length: 5 }, (_, i) => (
                  <th
                    key={i}
                    className="sticky top-0 z-50 bg-neutral-100 shadow-[-1px_0_0_#cccccc] w-32 h-16 align-middle p-0"
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
                  <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_1px_0_#cccccc,1px_0_0_#cccccc] px-2 xl:h-16 h-10 align-middle">
                    <div className="flex items-center justify-center h-full">
                      <div className="w-32 h-6 bg-black/10 animate-pulse"></div>
                    </div>
                  </td>
                  {Array.from({ length: 5 }, (_, userIndex) => (
                    <td
                      key={userIndex}
                      className="shadow-[inset_1px_0_0_#cccccc,inset_0_-1px_0_#cccccc] px-0 xl:h-16 h-10 align-middle"
                    >
                      <div className="w-8 h-8 bg-black/10 animate-pulse mx-auto"></div>
                    </td>
                  ))}
                </tr>,
                // Away team row
                <tr key={`skeleton-away-${matchupIndex}`}>
                  <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_-1px_0_#cccccc,1px_0_0_#cccccc] px-2 xl:h-16 h-10 align-middle">
                    <div className="flex items-center justify-center h-full">
                      <div className="w-32 h-6 bg-black/10 animate-pulse"></div>
                    </div>
                  </td>
                  {Array.from({ length: 5 }, (_, userIndex) => (
                    <td
                      key={userIndex}
                      className="shadow-[inset_1px_0_0_#cccccc] px-0 xl:h-16 h-10 align-middle"
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

      <div className="mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>
    </div>
  )
}

function WeeklyMatchesPage() {
  const { user: currentUser } = useAuthStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const [isWeekDropdownOpen, setIsWeekDropdownOpen] = useState(false)
  const startOfWeek = getStartOfWeekNDaysAgo(weekOffset)
  const { start, end } = dateHelpers.getSundayWeekRange(startOfWeek)
  const { data: games, isLoading } = useGamesForWeek(start, end)

  const [users, setUsers] = useState<any[]>([])
  const [userPicksByUser, setUserPicksByUser] = useState<Record<string, any>>({})
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPicks, setLoadingPicks] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  const [selectedUser, setSelectedUser] = useState<{ id: string; name: string } | null>(null)

  const { season, week } = getSeasonAndWeek(startOfWeek)

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

  // Fetch all user picks for this week
  useEffect(() => {
    if (users.length === 0) return
    setLoadingPicks(true)
    const fetchAllPicks = async () => {
      try {
        // Check if Firebase is initialized
        if (!db) {
          console.warn('Firebase not initialized, cannot fetch picks')
          setUserPicksByUser({})
          return
        }

        const picksPromises = users.map(async (user) => {
          const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', `${season}_${week}`))
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
  }, [users, season, week])

  // Group games by day
  const gamesByDay: Record<string, typeof games> = {}
  games?.forEach((game) => {
    const day = format(parseISO(game.date), "EEEE, MMM d")
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

// User display names for header
const userDisplayNames = users.map(u => toTitleCase(u.displayName || u.id))

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
      await setDoc(doc(db, 'users', currentUser.uid, 'picks', `${season}_${week}`), newPicks, { merge: true })
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

  // Show skeleton while loading
  if (isLoading || loadingUsers || loadingPicks) {
    return <DashboardSkeleton />
  }

  return (
    <div className="min-w-fit font-chakra text-2xl pb-16 select-none overflow-x-clip">
      <Navigation />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col pt-10 lg:mx-8 md:mx-4 sm:mx-2 bg-neutral-100 overflow-x-clip">
        {/* Main scrollable container */}
        <div className="md:pb-8 pb-4">
          <table className="min-w-full bg-neutral-100 border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr className="bg-neutral-100">
                {/* Sticky week selector header cell */}
                <th className="sticky top-0 left-0 z-50 bg-neutral-100 shadow-[1px_0_0_#000000] w-48 min-w-fit h-16 align-middle p-0">
                  <div className="week-selector h-16 flex items-center justify-center relative">
                    <div
                      className="w-full h-full flex items-center justify-center gap-1 font-bold uppercase max-xl:text-sm"
                      onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                    >
                      {/* label */}
                      {(() => {
                        const seasonStart = new Date('2024-03-28')
                        const weekStart = getStartOfWeekNDaysAgo(weekOffset)
                        const weekNumber = Math.ceil((weekStart.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                        return `Week ${weekNumber}`
                      })()}
                      <span className={`material-symbols-sharp transition-transform`}>
                        arrow_drop_down
                      </span>
                    </div>
                    {/* Dropdown overlay */}
                    {isWeekDropdownOpen && (
                      <div className="absolute top-full left-1/2 right-0 -translate-x-1/2 -translate-y-2 w-[calc(100%-20px)] max-xl:text-sm bg-white shadow-[inset_0_0_0_1px_#000000] z-50-2xl shadow-2xl overflow-clip">
                        {Array.from({ length: NUM_WEEKS }, (_, i) => {
                          const seasonStart = new Date('2024-03-28')
                          const weekStart = getStartOfWeekNDaysAgo(i)
                          const weekNumber = Math.ceil((weekStart.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                          return (
                            <div
                              key={i}
                              className={`px-3 py-2 cursor-pointer hover:bg-black hover:text-white font-bold text-center uppercase ${i === weekOffset ? 'bg-black/10' : ''}`}
                              onClick={() => {
                                setWeekOffset(i)
                                setIsWeekDropdownOpen(false)
                              }}
                            >
                              Week {weekNumber}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </th>
                {/* User name headers */}
                {userDisplayNames.map((name, userIndex) => (
                  <th
                    key={userIndex}
                    className="sticky top-0 z-50 bg-neutral-100 shadow-[-1px_0_0_#000000] w-32 h-16 align-middle p-0"
                  >
                    <div 
                      className="w-full h-16 flex items-center justify-center font-jim xl:text-5xl text-3xl cursor-pointer"
                      onClick={() => setSelectedUser({ id: users[userIndex].id, name })}
                    >
                      <span className="max-w-8 flex justify-center font-light max-xl:-rotate-[55deg]">{name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="h-8"></tr>
              {Object.entries(gamesByDay).flatMap(([day, dayGames], dayIdx) => [
                // Day header row
                <tr key={day + '-header'}>
                  <td
                    className="sticky top-16 left-0 z-30 max-xl:text-sm bg-neutral-100 shadow-[inset_0_1px_0_#000000,inset_0_-1px_0_#000000] font-bold uppercase text-center p-2 align-middle"
                    colSpan={1 + userDisplayNames.length}
                  >
                    {day}
                  </td>
                </tr>,
                // Blank row below day header
                <tr key={day + '-spacer-below'}>
                  <td colSpan={1 + userDisplayNames.length} className="h-8"></td>
                </tr>,
                // All game rows for this day, flattened
                ...(getUniqueGamesById(dayGames ?? [])).flatMap((game, gameIdx) => {
                  return [
                    <tr key={game.id + '-' + game.date + '-home'}>
                      {/* Sticky left: Home team info */}
                      <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_1px_0_#000000,1px_0_0_#000000] px-2 xl:h-16 h-10 align-middle font-jim xl:text-5xl text-3xl">
                        <div className="relative flex items-center justify-center h-full">
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
                            {getTeamDisplayNameFromTeam(game.homeTeam)}
                          </span>
                        </div>
                      </td>
                      {/* User picks for home team */}
                      {users.map((user, userIndex) => {
                        const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                        const homeCorrect = pick === 'home' && (game.homeScore ?? 0) > (game.awayScore ?? 0)
                        const isCurrentUser = user.id === currentUser?.uid
                        const isGameFinished = game.status === 'final' || game.status === 'post'
                        const HomeCheck = getDeterministicCheckComponent(`${game.id}_${user.id}_home`)
                        const HomeCircleCheck = getDeterministicCircleCheckComponent(`${game.id}_${user.id}_home`)
                        return (
                          <td
                            key={userIndex}
                            className={`shadow-[inset_1px_0_0_#000000,inset_0_-1px_0_#000000] px-0 xl:h-16 h-10 align-middle font-jim xl:text-5xl text-3xl ${isCurrentUser && game.status === 'scheduled' && !saving
                              ? 'cursor-pointer hover:bg-white'
                              : isCurrentUser && game.status !== 'scheduled'
                                ? 'cursor-not-allowed'
                                : ''
                            }`}
                            onClick={isCurrentUser ? () => handlePick(game.id, 'home') : undefined}
                          >
                            {pick === 'home' && (
                              <div className="relative flex items-center justify-center h-full">
                                <HomeCheck className="w-10 h-10 xl:w-12 xl:h-12 transform translate-x-3 -translate-y-2" />
                                {homeCorrect && isGameFinished && <HomeCircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>,
                    <tr key={game.id + '-' + game.date + '-away'}>
                      {/* Sticky left: Away team info */}
                      <td className="sticky left-0 z-10 bg-neutral-100 shadow-[0_-1px_0_#000000,1px_0_0_#000000] px-2 xl:h-16 h-10 align-middle font-jim xl:text-5xl text-3xl">
                        <div className="relative flex items-center justify-center h-full">
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
                            <div className="absolute right-[-18.5px] top-[-1.5px] -translate-y-1/2 h-5 w-5 flex items-center justify-center bg-green-400 rounded-full">
                              <Tooltip content="Game in Progress" position="right">
                              <span className="material-symbols-sharp !text-sm mb-[1px] animate-ping">sports_baseball</span>
                              </Tooltip>
                            </div>
                          ))}
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
                            {getTeamDisplayNameFromTeam(game.awayTeam)}
                          </span>
                        </div>
                      </td>
                      {/* User picks for away team */}
                      {users.map((user, userIndex) => {
                        const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                        const awayCorrect = pick === 'away' && (game.awayScore ?? 0) > (game.homeScore ?? 0)
                        const isCurrentUser = user.id === currentUser?.uid
                        const isGameFinished = game.status === 'final' || game.status === 'post'
                        const AwayCheck = getDeterministicCheckComponent(`${game.id}_${user.id}_away`)
                        const AwayCircleCheck = getDeterministicCircleCheckComponent(`${game.id}_${user.id}_away`)
                        return (
                          <td
                            key={userIndex}
                            className={`shadow-[inset_1px_0_0_#000000] px-0 xl:h-16 h-10 align-middle font-jim xl:text-5xl text-3xl ${isCurrentUser && game.status === 'scheduled' && !saving
                              ? 'cursor-pointer hover:bg-white'
                              : isCurrentUser && game.status !== 'scheduled'
                                ? 'cursor-not-allowed'
                                : ''
                            }`}
                            onClick={isCurrentUser ? () => handlePick(game.id, 'away') : undefined}
                          >
                            {pick === 'away' && (
                              <div className="relative flex items-center justify-center h-full">
                                <AwayCheck className="w-10 h-10 xl:w-12 xl:h-12 transform translate-x-2" />
                                {awayCorrect && isGameFinished && <AwayCircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                              </div>
                            )}
                          </td>
                        )
                      })}
                    </tr>,
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

      <div className="mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>

      {/* User Stats Modal */}
      {selectedUser && (
        <UserStatsModal
          isOpen={!!selectedUser}
          onClose={() => setSelectedUser(null)}
          userId={selectedUser.id}
          userName={selectedUser.name}
        />
      )}

    </div>
  )
}

export default WeeklyMatchesPage