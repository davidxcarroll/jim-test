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
// @ts-ignore
import * as Checks from '@/components/checks'
// @ts-ignore
import * as Circles from '@/components/circles'

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

        const usersSnap = await getDocs(collection(db, 'users'))
        const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))

        // Reorder users so current user appears first
        const reorderedUsers = usersList.sort((a, b) => {
          if (a.id === currentUser?.uid) return -1
          if (b.id === currentUser?.uid) return 1
          return 0
        })

        setUsers(reorderedUsers)
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

        const picksByUser: Record<string, any> = {}
        await Promise.all(users.map(async (user) => {
          const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', `${season}_${week}`))
          picksByUser[user.id] = picksDoc.exists() ? picksDoc.data() : {}
        }))
        setUserPicksByUser(picksByUser)
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

  // User display names for header
  const userDisplayNames = users.map(u => u.displayName || u.id)

  // Save pick to Firestore
  const handlePick = async (gameId: string, pick: 'home' | 'away') => {
    if (!currentUser) return
    
    // Check if Firebase is initialized
    if (!db) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }
    
    setSaving(true)
    setToast(null)

    // Check if game is locked
    const game = games?.find(g => g.id === gameId)
    if (game && isBefore(parseISO(game.date), new Date())) {
      setToast({ message: 'Game has already started!', type: 'error' })
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

  return (
    <div className="font-chakra text-2xl pb-16 select-none">
      <Navigation />

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}

      <div className="flex flex-col pt-10 bg-neutral-100">
        {/* Main scrollable container */}
        <div className="overflow-x-auto">
          <div className="inline-flex min-w-full pb-8">
            {/* Sticky left column */}
            <div className="sticky left-0 z-30 bg-neutral-100 flex flex-col gap-8 xl:gap-16">
              {/* Week selector row */}
              <div className="week-selector h-16 flex items-center justify-center shadow-[1px_0_0_rgba(0,0,0,1)] font-bold uppercase relative">
                <div
                  className="w-full h-full flex items-center justify-center gap-1 max-xl:text-sm hover:bg-white cursor-pointer"
                  onClick={() => setIsWeekDropdownOpen(!isWeekDropdownOpen)}
                >
                  {/* label */}
                  {(() => {
                    const seasonStart = new Date('2024-03-28')
                    const weekStart = getStartOfWeekNDaysAgo(weekOffset)
                    const weekNumber = Math.ceil((weekStart.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                    return `Week ${weekNumber}`
                  })()}
                  <span className={`material-symbols-sharp transition-transform ${isWeekDropdownOpen ? 'rotate-180' : ''}`}>
                    arrow_drop_down
                  </span>
                </div>

                {/* Dropdown overlay */}
                {isWeekDropdownOpen && (
                  <div className="absolute top-full left-0 right-0 translate-x-2 -translate-y-2 max-xl:text-sm bg-white border border-black z-50 rounded-2xl shadow-2xl overflow-clip">
                    {Array.from({ length: NUM_WEEKS }, (_, i) => {
                      // Calculate the actual MLB season week number
                      const seasonStart = new Date('2024-03-28')
                      const weekStart = getStartOfWeekNDaysAgo(i)
                      const weekNumber = Math.ceil((weekStart.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                      return (
                        <div
                          key={i}
                          className={`px-3 py-2 cursor-pointer hover:bg-black/10 font-bold text-center uppercase ${i === weekOffset ? 'bg-black/5' : ''}`}
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

              {/* Game rows - team names */}
              {isLoading || loadingUsers || loadingPicks ? (
                <div className="flex items-center justify-center">
                  <div className="px-2 text-sm font-chakra uppercase font-bold bg-black text-white">Loading...</div>
                </div>
              ) : (
                Object.entries(gamesByDay).map(([day, dayGames]) => (
                  <div key={day} className="flex flex-col gap-8 xl:gap-16">
                    {/* Day header */}
                    <div className="relative xl:h-16 h-10 flex items-center justify-center p-2 text-center max-xl:text-sm uppercase font-bold bg-neutral-100 border-y-[1px] border-black">
                      <div className="absolute left-0 top-0 w-screen xl:h-16 h-10 flex items-center justify-center">
                        {day}
                      </div>
                    </div>
                    {/* Games for this day */}
                    {(dayGames ?? []).map((game) => {
                      const homeScore = game.homeScore !== undefined ? Number(game.homeScore) : null
                      const awayScore = game.awayScore !== undefined ? Number(game.awayScore) : null
                      const isFinal = game.status === "final" || game.status === "post"
                      const liveStatuses = ["live", "in_progress", "in"]
                      const isLive = liveStatuses.includes(game.status)
                      const validScores = homeScore !== null && awayScore !== null && Number.isFinite(homeScore) && Number.isFinite(awayScore)

                      let homeWon = false
                      let awayWon = false

                      if (isFinal && validScores) {
                        if (homeScore > awayScore) {
                          homeWon = true
                        } else if (awayScore > homeScore) {
                          awayWon = true
                        }
                      }

                      const homeCircleSize = getTeamCircleSize(game.homeTeam)
                      const awayCircleSize = getTeamCircleSize(game.awayTeam)

                      // Check if game is locked (has started)
                      const gameStart = parseISO(game.date)
                      const isGameLocked = isBefore(gameStart, new Date())

                      return (
                        <div key={game.id} className="relative flex flex-col shadow-[1px_0_0_rgba(0,0,0,1)]">

                          {/* Lock icon */}
                          {isGameLocked && (
                            <div className="absolute z-10 left-2 top-1/2 -translate-y-1/2 h-3 w-3 flex items-center justify-center bg-white">
                              <Tooltip content="Locked" position="right">
                                <div className="h-3 w-3 flex items-center justify-center cursor-default">
                                  <span className="material-symbols-sharp xl:!text-lg !text-sm">lock</span>
                                </div>
                              </Tooltip>
                            </div>
                          )}

                          {/* Game in progress icon */}
                          {isLive && (
                            <div className="absolute z-10 left-2 top-1/2 -translate-y-1/2 h-3 w-3 flex items-center justify-center bg-white">
                              <Tooltip content="Game in Progress" position="right">
                                <div className="h-3 w-3 flex items-center justify-center">
                                  <span className="material-symbols-sharp xl:!text-lg !text-sm animate-spin text-green-500">motion_photos_on</span>
                                </div>
                              </Tooltip>
                            </div>
                          )}

                          {/* Home team row */}
                          <div className="relative xl:h-16 h-10 flex items-center justify-center px-2 font-jim xl:text-5xl text-3xl">
                            {homeWon && (() => {
                              const CircleTeam = getDeterministicCircleTeamComponent(homeCircleSize, `${game.id}_home`)
                              return <CircleTeam className="w-full h-[0.9em]" />
                            })()}
                            <span className="text-black">
                              {getTeamDisplayNameFromTeam(game.homeTeam)}
                            </span>
                          </div>

                          <hr className="w-full border-t-[1px] border-black" />

                          {/* Away team row */}
                          <div className="relative xl:h-16 h-10 flex items-center justify-center px-2 font-jim xl:text-5xl text-3xl">
                            {awayWon && (() => {
                              const CircleTeam = getDeterministicCircleTeamComponent(awayCircleSize, `${game.id}_away`)
                              return <CircleTeam className="w-full h-[0.9em]" />
                            })()}
                            <span className="text-black">
                              {getTeamDisplayNameFromTeam(game.awayTeam)}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Scrollable user columns */}
            <div className="w-full flex">
              {userDisplayNames.map((name, userIndex) => (
                <div key={userIndex} className="min-w-24 flex flex-1 flex-col gap-8 xl:gap-16">
                  {/* User name header */}
                  <div className="w-full min-w-16 h-16 flex items-center justify-center font-jim xl:text-5xl text-3xl border-l-[1px] border-black">
                    <span className="max-w-8 flex justify-center max-xl:-rotate-[55deg]">{name}</span>
                  </div>

                  {/* Game rows for this user */}
                  {isLoading || loadingUsers || loadingPicks ? (
                    <div className="w-full min-w-24 flex items-center justify-center">
                      <div className="px-2 text-sm font-chakra uppercase font-bold bg-black text-white">Loading...</div>
                    </div>
                  ) : (
                    Object.entries(gamesByDay).map(([day, dayGames]) => (
                      <div key={day} className="flex flex-col gap-8 xl:gap-16">
                        {/* Day header (hidden since it's in the sticky column) */}
                        <div className="w-full min-w-24 xl:h-16 h-10 bg-neutral-100 border-y-[1px] border-black"></div>
                        {/* Games for this day */}
                        {(dayGames ?? []).map((game) => {
                          const homeScore = game.homeScore !== undefined ? Number(game.homeScore) : null
                          const awayScore = game.awayScore !== undefined ? Number(game.awayScore) : null
                          const isFinal = game.status === "final" || game.status === "post"
                          const validScores = homeScore !== null && awayScore !== null && Number.isFinite(homeScore) && Number.isFinite(awayScore)

                          let homeWon = false
                          let awayWon = false

                          if (isFinal && validScores) {
                            if (homeScore > awayScore) {
                              homeWon = true
                            } else if (awayScore > homeScore) {
                              awayWon = true
                            }
                          }

                          const user = users[userIndex]
                          const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                          const homeCorrect = pick === 'home' && homeWon
                          const awayCorrect = pick === 'away' && awayWon
                          const isCurrentUser = user.id === currentUser?.uid

                          // Check if game is locked (has started)
                          const gameStart = parseISO(game.date)
                          const isGameLocked = isBefore(gameStart, new Date())

                          // Use deterministic components to prevent reshuffling
                          const HomeCheck = getDeterministicCheckComponent(`${game.id}_${user.id}_home`)
                          const HomeCircleCheck = getDeterministicCircleCheckComponent(`${game.id}_${user.id}_home`)
                          const AwayCheck = getDeterministicCheckComponent(`${game.id}_${user.id}_away`)
                          const AwayCircleCheck = getDeterministicCircleCheckComponent(`${game.id}_${user.id}_away`)

                          return (
                            <div key={game.id} className="flex flex-col">
                              {/* Home team pick */}
                              <div
                                className={`w-full min-w-24 xl:h-16 h-10 flex items-center justify-center font-jim xl:text-5xl text-3xl border-l-[1px] border-black ${isCurrentUser && !isGameLocked && !saving
                                  ? 'cursor-pointer hover:bg-white'
                                  : isCurrentUser && isGameLocked
                                    ? 'cursor-not-allowed'
                                    : ''
                                  }`}
                                onClick={() => {
                                  if (isCurrentUser && !isGameLocked && !saving) {
                                    handlePick(game.id, 'home')
                                  }
                                }}
                              >
                                {pick === 'home' && (
                                  <div className="relative">
                                    <HomeCheck className="w-10 h-10 xl:w-12 xl:h-12 transform translate-x-2 -translate-y-2" />
                                    {homeCorrect && <HomeCircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                                  </div>
                                )}
                              </div>
                              <hr className="w-full border-t-[1px] border-black" />
                              {/* Away team pick */}
                              <div
                                className={`w-full min-w-24 xl:h-16 h-10 flex items-center justify-center font-jim xl:text-5xl text-3xl border-l-[1px] border-black ${isCurrentUser && !isGameLocked && !saving
                                  ? 'cursor-pointer hover:bg-white'
                                  : isCurrentUser && isGameLocked
                                    ? 'cursor-not-allowed'
                                    : ''
                                  }`}
                                onClick={() => {
                                  if (isCurrentUser && !isGameLocked && !saving) {
                                    handlePick(game.id, 'away')
                                  }
                                }}
                              >
                                {pick === 'away' && (
                                  <div className="relative">
                                    <AwayCheck className="w-10 h-10 xl:w-12 xl:h-12 transform translate-x-2 -translate-y-1" />
                                    {awayCorrect && <AwayCircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                                  </div>
                                )}
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ))
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ProtectedWeeklyMatchesPage() {
  return (
    <ProtectedRoute>
      <WeeklyMatchesPage />
    </ProtectedRoute>
  )
} 