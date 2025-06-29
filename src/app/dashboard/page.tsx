"use client"
import { useState, useEffect } from "react"
import { useGamesForWeek } from "@/hooks/use-mlb-data"
import { dateHelpers } from "@/utils/date-helpers"
import { getTeamDisplayNameFromTeam } from "@/utils/team-names"
import { format, parseISO } from "date-fns"
import { ProtectedRoute } from "@/components/protected-route"
import { Navigation } from "@/components/navigation"
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc } from 'firebase/firestore'

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

function WeeklyMatchesPage() {
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
      const usersSnap = await getDocs(collection(db, 'users'))
      const usersList = usersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setUsers(usersList)
      setLoadingUsers(false)
    }
    fetchUsers()
  }, [])

  // Fetch all user picks for this week
  useEffect(() => {
    if (users.length === 0) return
    setLoadingPicks(true)
    const fetchAllPicks = async () => {
      const picksByUser: Record<string, any> = {}
      await Promise.all(users.map(async (user) => {
        const picksDoc = await getDoc(doc(db, 'users', user.id, 'picks', `${season}_${week}`))
        picksByUser[user.id] = picksDoc.exists() ? picksDoc.data() : {}
      }))
      setUserPicksByUser(picksByUser)
      setLoadingPicks(false)
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

      <div className="w-full h-24 flex flex-row bg-white sticky left-0 top-0 z-20">
        <div className="w-1/5 min-w-60 flex items-center justify-center">
          <select
            className="px-3 py-1 bg-black/10 text-black font-bold uppercase"
            value={weekOffset}
            onChange={(e) => setWeekOffset(Number(e.target.value))}
          >
            {Array.from({ length: NUM_WEEKS }, (_, i) => {
              // Calculate the actual MLB season week number
              // Assuming MLB season started around March 28, 2024
              const seasonStart = new Date('2024-03-28')
              const weekStart = getStartOfWeekNDaysAgo(i)
              const weekNumber = Math.ceil((seasonStart.getTime() - weekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1
              return (
                <option key={i} value={i}>
                  Week {weekNumber}
                </option>
              )
            })}
          </select>
        </div>
        <ul className="w-full flex flex-row justify-evenly">
          {userDisplayNames.map((name, idx) => (
            <li key={idx} className="w-full min-w-24 flex items-center justify-center font-jim text-5xl border-l-[1px] border-black">
              <span className="max-w-8 flex justify-center -rotate-45">{name}</span>
            </li>
          ))}
        </ul>
      </div>

      {isLoading || loadingUsers || loadingPicks ? (
        <div>Loading games and picks...</div>
      ) : (
        <div className="flex flex-col">
          {Object.keys(gamesByDay).length === 0 && <div>No games found for this week.</div>}
          {Object.entries(gamesByDay).map(([day, dayGames]) => (
            <div className="flex flex-col gap-16 py-12" key={day}>
              <div className="p-2 text-center text-xl uppercase font-bold bg-white sticky left-0 top-24 border-b-[1px] border-black z-10">{day}</div>
              <div className="flex flex-col gap-16">
                {(dayGames ?? []).map((game) => {
                  const homeScore = game.homeScore !== undefined ? Number(game.homeScore) : null
                  const awayScore = game.awayScore !== undefined ? Number(game.awayScore) : null
                  const isFinal = game.status === "final" || game.status === "post"
                  const liveStatuses = ["live", "in_progress", "in"]
                  const isLive = liveStatuses.includes(game.status)
                  const validScores = homeScore !== null && awayScore !== null && Number.isFinite(homeScore) && Number.isFinite(awayScore)

                  let homeClass = ""
                  let awayClass = ""
                  let homeWon = false
                  let awayWon = false

                  if (isFinal && validScores) {
                    if (homeScore > awayScore) {
                      homeClass = "text-green-500"
                      awayClass = "text-black"
                      homeWon = true
                    } else if (awayScore > homeScore) {
                      awayClass = "text-green-500"
                      homeClass = "text-black"
                      awayWon = true
                    }
                  } else if (isLive) {
                    homeClass = "text-yellow-400"
                    awayClass = "text-yellow-400"
                  }

                  return (
                    <div key={game.id} className="flex flex-col">
                      {/* Home row */}
                      <div className="h-16 flex flex-row">
                        <div className="w-1/5 min-w-60 flex items-center justify-center pl-2 font-jim text-5xl">
                          <span className={homeClass}>
                            {getTeamDisplayNameFromTeam(game.homeTeam)}
                          </span>
                        </div>
                        <ul className="w-full flex flex-row justify-evenly">
                          {users.map((user, index) => {
                            const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                            const correct = pick === 'home' && homeWon
                            return (
                              <li key={index} className="w-full min-w-24 flex items-center justify-center font-jim text-5xl border-l-[1px] border-black">
                                {pick === 'home' ? (
                                  <span className={correct ? "text-green-500" : "text-black"}>✔</span>
                                ) : ""}
                              </li>
                            )
                          })}
                        </ul>
                      </div>

                      <hr className="w-full border-[.5px] border-black" />

                      {/* Away row */}
                      <div className="h-16 flex flex-row">
                        <div className="w-1/5 min-w-60 flex items-center justify-center pl-2 font-jim text-5xl">
                          <span className={awayClass}>
                            {getTeamDisplayNameFromTeam(game.awayTeam)}
                          </span>
                        </div>
                        <ul className="w-full flex flex-row justify-evenly">
                          {users.map((user, index) => {
                            const pick = userPicksByUser[user.id]?.[game.id]?.pickedTeam
                            const correct = pick === 'away' && awayWon
                            return (
                              <li key={index} className="w-full min-w-24 flex items-center justify-center font-jim text-5xl border-l-[1px] border-black">
                                {pick === 'away' ? (
                                  <span className={correct ? "text-green-500" : "text-black"}>✔</span>
                                ) : ""}
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