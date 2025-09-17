"use client"
import { useState, useEffect } from "react"
import { useGamesForWeek } from "@/hooks/use-nfl-data"
import { dateHelpers } from "@/utils/date-helpers"
import { getTeamDisplayNameFromTeam } from "@/utils/team-names"
import { getTeamCircleSize } from "@/utils/team-utils"
import { format, parseISO } from "date-fns"
import { ProtectedRoute } from "@/components/protected-route"
import { Navigation } from "@/components/navigation"
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'
import { useAuthStore } from '@/store/auth-store'
import { isPhil, getPhilPicks, generateAndStorePhilPicks } from '@/utils/phil-user'
// @ts-ignore
import * as Checks from '@/components/checks'
// @ts-ignore
import * as Circles from '@/components/circles'

const NUM_WEEKS = 5

  // NFL season start (adjust as needed)
  const NFL_SEASON_START = new Date('2025-09-04')

function getStartOfWeekNDaysAgo(weeksAgo: number) {
  const today = new Date()
  const { start } = dateHelpers.getWednesdayWeekRange(today)
  // Subtract the number of weeks from the current week start
  const targetWeekStart = new Date(start.getTime() - (7 * 24 * 60 * 60 * 1000) * weeksAgo)
  return targetWeekStart
}

function getSeasonAndWeek(sunday: Date) {
  const season = String(sunday.getFullYear())
      const week = Math.ceil((sunday.getTime() - NFL_SEASON_START.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
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

// Helper to randomize check component
const checkComponents = [
  Checks.Check01, Checks.Check02, Checks.Check03, Checks.Check04, Checks.Check05, Checks.Check06, Checks.Check07
]
function getRandomCheckComponent() {
  return checkComponents[Math.floor(Math.random() * checkComponents.length)]
}

// Helper to randomize circle-check component
const circleCheckComponents = [
  Circles.CircleCheck01, Circles.CircleCheck02, Circles.CircleCheck03, Circles.CircleCheck04, Circles.CircleCheck05, Circles.CircleCheck06, Circles.CircleCheck07, Circles.CircleCheck08, Circles.CircleCheck09
]
function getRandomCircleCheckComponent() {
  return circleCheckComponents[Math.floor(Math.random() * circleCheckComponents.length)]
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

function WeeklyMatchesPage() {
  const { user: currentUser } = useAuthStore()
  const [weekOffset, setWeekOffset] = useState(0)
  const startOfWeek = getStartOfWeekNDaysAgo(weekOffset)
  const { start, end } = dateHelpers.getSundayWeekRange(startOfWeek)
  const { data: games, isLoading } = useGamesForWeek(start, end)

  const [users, setUsers] = useState<any[]>([])
  const [userPicksByUser, setUserPicksByUser] = useState<Record<string, any>>({})
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [loadingPicks, setLoadingPicks] = useState(true)

  const { season, week } = getSeasonAndWeek(startOfWeek)

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

  // Generate Phil's picks for the current week if they don't exist
  useEffect(() => {
    if (!games || games.length === 0) return

    const generatePhilPicksIfNeeded = async () => {
      try {
        await generateAndStorePhilPicks(games, `${season}_${week}`)
      } catch (error) {
        console.error('Error generating Phil picks:', error)
      }
    }

    generatePhilPicksIfNeeded()
  }, [games, season, week])

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
          // All users (including Phil) - fetch from Firestore
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

  return (
    <div className="font-chakra text-2xl">
      <Navigation />

      <div className="w-full h-16 flex flex-row bg-white sticky left-0 top-0 z-20">
        <div className="w-1/5 xl:min-w-60 min-w-40 flex items-center justify-center">
          <select
            className="px-3 py-1 border-[1px] border-black max-xl:text-sm text-black font-bold uppercase"
            value={weekOffset}
            onChange={(e) => setWeekOffset(Number(e.target.value))}
          >
            {(() => {
              const currentDate = new Date()
              const availableWeeks = []
              const preseasonStart = new Date('2025-07-25')
              const regularSeasonStart = new Date('2025-09-04')
              
              for (let i = 0; i < 20; i++) {
                const weekStart = getStartOfWeekNDaysAgo(i)
                const seasonStart = new Date('2025-08-01')
                const weekNumber = Math.ceil((weekStart.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                
                // Check if this week is in preseason or regular season
                const isPreseason = weekStart >= preseasonStart && weekStart < regularSeasonStart
                const isWeekInPastOrCurrent = weekStart <= currentDate
                
                // Only show weeks that are in the past or current (not future)
                if (isWeekInPastOrCurrent) {
                  let weekDisplay
                  if (isPreseason) {
                    const preseasonWeek = Math.floor((weekStart.getTime() - preseasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
                    weekDisplay = `PRESEASON ${preseasonWeek}`
                  } else {
                    weekDisplay = `WEEK ${weekNumber}`
                  }
                  
                  availableWeeks.push(
                    <option key={i} value={i}>
                      {weekDisplay}
                    </option>
                  )
                }
              }
              
              return availableWeeks
            })()}
          </select>
        </div>
        <ul className="w-full flex flex-row justify-evenly">
          {userDisplayNames.map((name, idx) => (
            <li key={idx} className="w-full min-w-24 flex items-center justify-center font-jim xl:text-5xl text-3xl border-l-[1px] border-black">
              <span className="max-w-8 flex justify-center max-xl:-rotate-45">{name}</span>
            </li>
          ))}
        </ul>
      </div>

      {isLoading || loadingUsers || loadingPicks ? (
        <div className="min-h-screen flex items-center justify-center">
          <div className="px-2 text-2xl font-chakra uppercase font-bold bg-black text-white">Loading games and picks...</div>
        </div>
      ) : (
        <div className="flex flex-col bg-white">
          {Object.keys(gamesByDay).length === 0 && <div>No games found for this week.</div>}
          {Object.entries(gamesByDay).map(([day, dayGames]) => (
            <div className="flex flex-col gap-16 py-12" key={day}>
              <div className="p-2 text-center max-xl:text-sm uppercase font-bold bg-white sticky left-0 top-16 border-y-[1px] border-black z-10">{day}</div>
              <div className="flex flex-col gap-8">
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
                  const homeCircleTeamNumber = getRandomCircleTeamNumber()
                  const awayCircleTeamNumber = getRandomCircleTeamNumber()

                  return (
                    <div key={game.id} className="flex flex-col">
                      {/* Home row */}
                      <div className="xl:h-16 h-10 flex flex-row">
                        <div className="relative w-1/5 xl:min-w-60 min-w-40 flex items-center justify-center pl-2 font-jim xl:text-5xl text-3xl">
                          {homeWon && (() => {
                            const CircleTeam = getRandomCircleTeamComponent(homeCircleSize)
                            return <CircleTeam className="w-full h-[0.9em]" />
                          })()}
                          <span className="text-black">
                            {getTeamDisplayNameFromTeam(game.homeTeam)}
                          </span>
                        </div>
                        <ul className="w-full flex flex-row justify-evenly">
                          {users.map((user, index) => {
                            const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                            const correct = pick === 'home' && homeWon
                            const Check = getRandomCheckComponent()
                            const CircleCheck = getRandomCircleCheckComponent()
                            
                            return (
                              <li key={index} className="w-full min-w-24 flex items-center justify-center font-jim xl:text-5xl text-3xl border-l-[1px] border-black">
                                {pick === 'home' && (() => {
                                  return (
                                    <div className="relative">
                                      <Check className="w-10 h-10 xl:w-12 xl:h-12 transform translate-x-2 -translate-y-2" />
                                      {correct && <CircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                                    </div>
                                  )
                                })()}
                              </li>
                            )
                          })}
                        </ul>
                      </div>

                      <hr className="w-full border-[.5px] border-black" />

                      {/* Away row */}
                      <div className="xl:h-16 h-10 flex flex-row">
                        <div className="relative w-1/5 xl:min-w-60 min-w-40 flex items-center justify-center pl-2 font-jim xl:text-5xl text-3xl">
                          {awayWon && (() => {
                            const CircleTeam = getRandomCircleTeamComponent(awayCircleSize)
                            return <CircleTeam className="w-full h-[0.9em]" />
                          })()}
                          <span className="text-black">
                            {getTeamDisplayNameFromTeam(game.awayTeam)}
                          </span>
                        </div>
                        <ul className="w-full flex flex-row justify-evenly">
                          {users.map((user, index) => {
                            const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                            const correct = pick === 'away' && awayWon
                            const Check = getRandomCheckComponent()
                            const CircleCheck = getRandomCircleCheckComponent()
                            
                            return (
                              <li key={index} className="w-full min-w-24 flex items-center justify-center font-jim xl:text-5xl text-3xl border-l-[1px] border-black">
                                {pick === 'away' && (() => {
                                  return (
                                    <div className="relative">
                                      <Check className="w-10 h-10 xl:w-12 xl:h-12 transform translate-x-2 -translate-y-2" />
                                      {correct && <CircleCheck className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-12 xl:w-20 xl:h-15" />}
                                    </div>
                                  )
                                })()}
                              </li>
                            )
                          })}
                        </ul>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
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