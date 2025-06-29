'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useGamesForWeek } from '@/hooks/use-mlb-data'
import { dateHelpers } from '@/utils/date-helpers'
import { getTeamDisplayNameFromTeam } from '@/utils/team-names'
import { format, parseISO, isBefore } from 'date-fns'
import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'

const NUM_WEEKS = 5
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

function PickPage() {
  const { user } = useAuthStore()
  const today = new Date()
  // Default to current week (weekOffset = 0)
  const [weekOffset, setWeekOffset] = useState(0)
  const startOfWeek = getStartOfWeekNDaysAgo(weekOffset)
  const { start, end } = dateHelpers.getSundayWeekRange(startOfWeek)
  const { data: games, isLoading } = useGamesForWeek(start, end)
  const [userPicks, setUserPicks] = useState<{ [gameId: string]: { pickedTeam: string, pickedAt: any } }>({})
  const [loadingPicks, setLoadingPicks] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const { season, week } = getSeasonAndWeek(startOfWeek)
  const { season: currentSeason, week: currentWeek } = getSeasonAndWeek(getStartOfWeekNDaysAgo(0))
  const isCurrentWeek = season === currentSeason && week === currentWeek

  // Load user picks from Firestore for the selected week
  useEffect(() => {
    if (!user) return
    setLoadingPicks(true)
    const fetchPicks = async () => {
      try {
        const picksDoc = await getDoc(doc(db, 'users', user.uid, 'picks', `${season}_${week}`))
        if (picksDoc.exists()) {
          setUserPicks(picksDoc.data() || {})
        } else {
          setUserPicks({})
        }
      } catch (err) {
        setUserPicks({})
      } finally {
        setLoadingPicks(false)
      }
    }
    fetchPicks()
  }, [user, season, week])

  // Save pick to Firestore (only for current week)
  const handlePick = async (gameId: string, pick: 'home' | 'away') => {
    if (!user || !isCurrentWeek) return
    setSaving(true)
    setMessage(null)
    setError(null)
    const newPicks = {
      ...userPicks,
      [gameId]: { pickedTeam: pick, pickedAt: serverTimestamp() }
    }
    setUserPicks(newPicks)
    try {
      await setDoc(doc(db, 'users', user.uid, 'picks', `${season}_${week}`), newPicks, { merge: true })
      setMessage('Pick saved!')
    } catch (err) {
      setError('Failed to save pick. Please try again.')
    } finally {
      setSaving(false)
      setTimeout(() => setMessage(null), 2000)
    }
  }

  // Group games by day
  const gamesByDay: Record<string, typeof games> = {}
  games?.forEach((game) => {
    const day = format(parseISO(game.date), 'EEEE, MMM d')
    if (!gamesByDay[day]) gamesByDay[day] = []
    gamesByDay[day].push(game)
  })

  return (
    <div className="font-chakra text-2xl">
      <Navigation />
      <div className="max-w-3xl mx-auto p-4">
        <h1 className="text-4xl font-jim font-bold text-center mb-8">Make Your Picks</h1>
        <div className="flex flex-row items-center justify-center mb-4">
          <select
            className="px-3 py-1 bg-black/10 text-black font-bold uppercase"
            value={weekOffset}
            onChange={(e) => setWeekOffset(Number(e.target.value))}
          >
            {Array.from({ length: NUM_WEEKS }, (_, i) => {
              // Calculate the actual MLB season week number
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
          <span className="ml-4 text-lg font-bold">
            {isCurrentWeek ? '(Current Week)' : ''}
          </span>
        </div>
        <div className="text-center mb-4 text-lg">
          {isCurrentWeek
            ? `You can make or change your picks for games from ${format(start, 'MMM d')} to ${format(end, 'MMM d')}.`
            : `Viewing picks for ${format(start, 'MMM d')} to ${format(end, 'MMM d')}.`}
        </div>
        {message && (
          <div className="mb-4 text-green-600 bg-green-50 border border-green-200 rounded p-2 text-center">{message}</div>
        )}
        {error && (
          <div className="mb-4 text-red-600 bg-red-50 border border-red-200 rounded p-2 text-center">{error}</div>
        )}
        {loadingPicks || isLoading ? (
          <div>Loading games and picks...</div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.keys(gamesByDay).length === 0 && <div>No games found for this week.</div>}
            {Object.entries(gamesByDay).map(([day, dayGames]) => (
              <div className="flex flex-col gap-4" key={day}>
                <div className="p-2 text-center text-xl uppercase font-bold bg-white border-b-[1px] border-black z-10">{day}</div>
                <div className="flex flex-col gap-4">
                  {(dayGames ?? []).map((game) => {
                    const gameStart = parseISO(game.date)
                    const locked = !isCurrentWeek || isBefore(gameStart, today)
                    const pick = userPicks[game.id]?.pickedTeam
                    return (
                      <div key={game.id} className="flex flex-row items-center justify-between bg-white rounded shadow p-4">
                        <div className={`flex-1 flex flex-col items-center ${pick === 'home' ? 'border-2 border-blue-600 rounded' : ''}`}>
                          <span className="font-jim text-3xl mb-2 flex items-center gap-2">
                            {getTeamDisplayNameFromTeam(game.homeTeam)}
                            {pick === 'home' && <span className="text-green-500 text-2xl">✔</span>}
                          </span>
                          <button
                            className={`px-4 py-2 rounded font-bold ${pick === 'home' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'} ${locked || saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500 hover:text-white'}`}
                            disabled={locked || saving}
                            onClick={() => handlePick(game.id, 'home')}
                          >
                            Pick Home
                          </button>
                        </div>
                        <div className="mx-4 font-bold text-lg">vs</div>
                        <div className={`flex-1 flex flex-col items-center ${pick === 'away' ? 'border-2 border-blue-600 rounded' : ''}`}>
                          <span className="font-jim text-3xl mb-2 flex items-center gap-2">
                            {getTeamDisplayNameFromTeam(game.awayTeam)}
                            {pick === 'away' && <span className="text-green-500 text-2xl">✔</span>}
                          </span>
                          <button
                            className={`px-4 py-2 rounded font-bold ${pick === 'away' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-black'} ${locked || saving ? 'opacity-50 cursor-not-allowed' : 'hover:bg-blue-500 hover:text-white'}`}
                            disabled={locked || saving}
                            onClick={() => handlePick(game.id, 'away')}
                          >
                            Pick Away
                          </button>
                        </div>
                        {locked && <div className="ml-4 text-red-500 font-bold">Locked</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ProtectedPickPage() {
  return (
    <ProtectedRoute>
      <PickPage />
    </ProtectedRoute>
  )
} 