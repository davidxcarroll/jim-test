'use client'

import { useState, useEffect, useMemo } from 'react'
import { useAuthStore } from '@/store/auth-store'
import { useGamesForWeek } from '@/hooks/use-nfl-data'
import { getNFLSeasonStart, getSeasonAndWeek, dateHelpers } from '@/utils/date-helpers'
import { getTeamDisplayNameFromTeam } from '@/utils/team-names'
import { getTeamCircleSize } from '@/utils/team-utils'
import { format, parseISO, isBefore } from 'date-fns'
import { ProtectedRoute } from '@/components/protected-route'
import { Navigation } from '@/components/navigation'
import { Toast } from '@/components/toast'
import { db } from '@/lib/firebase'
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
// @ts-ignore
import * as Circles from '@/components/circles'

function getCurrentWeekStart() {
  const today = new Date()
  const { start } = dateHelpers.getTuesdayWeekRange(today)
  return start
}

type TeamCircleSize = 'sm' | 'md' | 'lg'
const circleTeamSmComponents = [Circles.CircleTeamSm01, Circles.CircleTeamSm02, Circles.CircleTeamSm03]
const circleTeamMdComponents = [Circles.CircleTeamMd01, Circles.CircleTeamMd02, Circles.CircleTeamMd03]
const circleTeamLgComponents = [Circles.CircleTeamLg01, Circles.CircleTeamLg02, Circles.CircleTeamLg03]

// Deterministic index function
function getDeterministicIndex(seed: string, arrLength: number) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash += seed.charCodeAt(i);
  }
  return hash % arrLength;
}

function PickPage() {
  const { user } = useAuthStore()
  const today = new Date()
  const startOfWeek = getCurrentWeekStart()
  const { season, week } = getSeasonAndWeek(startOfWeek)
  const { data: games, isLoading } = useGamesForWeek(startOfWeek, startOfWeek)
  const [userPicks, setUserPicks] = useState<{ [gameId: string]: { pickedTeam: string, pickedAt: any } }>({})
  const [loadingPicks, setLoadingPicks] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  // Load user picks from Firestore for the current week
  useEffect(() => {
    if (!user) return
    setLoadingPicks(true)
    const fetchPicks = async () => {
      try {
        // Check if Firebase is initialized
        if (!db) {
          console.warn('Firebase not initialized, cannot fetch picks')
          setUserPicks({})
          return
        }

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

  // Save pick to Firestore
  const handlePick = async (gameId: string, pick: 'home' | 'away') => {
    if (!user) return
    
    // Check if Firebase is initialized
    if (!db) {
      setToast({ message: 'Firebase not initialized. Please refresh the page.', type: 'error' })
      return
    }

    setSaving(true)
    setToast(null)

    // Toggle logic: if same team is clicked again, remove the pick
    const currentPick = userPicks[gameId]?.pickedTeam
    let newPicks
    if (currentPick === pick) {
      // Remove the pick
      const { [gameId]: removed, ...rest } = userPicks
      newPicks = rest
    } else {
      // Set new pick
      newPicks = {
        ...userPicks,
        [gameId]: { pickedTeam: pick, pickedAt: serverTimestamp() }
      }
    }

    setUserPicks(newPicks)
    try {
      await setDoc(doc(db, 'users', user.uid, 'picks', `${season}_${week}`), newPicks, { merge: true })
      setToast({ message: currentPick === pick ? 'Pick removed!' : 'Pick saved!', type: 'success' })
    } catch (err) {
      setToast({ message: 'Failed to save pick. Please try again.', type: 'error' })
    } finally {
      setSaving(false)
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
      <div className="bg-white">
        {toast && (
          <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
        )}
        {loadingPicks || isLoading ? (
          <div className="min-h-screen flex items-center justify-center">
            <div className="px-2 text-2xl font-chakra uppercase font-bold bg-black text-white">Loading games and picks...</div>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {Object.keys(gamesByDay).length === 0 && <div>No games found for this week.</div>}
            {Object.entries(gamesByDay).map(([day, dayGames]) => (
              <div className="flex flex-col gap-4" key={day}>
                <div className="p-2 text-center text-xl uppercase font-bold bg-white border-b-[1px] border-black sticky top-0 z-10">{day}</div>
                <div className="flex flex-col gap-4">
                  {(dayGames ?? []).map((game, index) => {
                    const gameStart = parseISO(game.date)
                    const locked = isBefore(gameStart, today)
                    const pick = userPicks[game.id]?.pickedTeam
                    const homeCircleSize = getTeamCircleSize(game.homeTeam)
                    const awayCircleSize = getTeamCircleSize(game.awayTeam)
                    
                    const homeCircleArr = homeCircleSize === 'sm' ? circleTeamSmComponents : homeCircleSize === 'md' ? circleTeamMdComponents : circleTeamLgComponents;
                    const awayCircleArr = awayCircleSize === 'sm' ? circleTeamSmComponents : awayCircleSize === 'md' ? circleTeamMdComponents : circleTeamLgComponents;
                    const homeCircleIndex = getDeterministicIndex(game.id + 'home', homeCircleArr.length);
                    const awayCircleIndex = getDeterministicIndex(game.id + 'away', awayCircleArr.length);
                    const HomeCircleTeam = homeCircleArr[homeCircleIndex];
                    const AwayCircleTeam = awayCircleArr[awayCircleIndex];

                    return (
                      <div key={game.id} className={`flex flex-row items-center justify-center ${index < (dayGames?.length ?? 0) - 1 ? 'border-b border-black' : ''} pb-4`}>
                        <div
                          className={`relative w-2/5 xl:min-w-60 min-w-40 flex items-center justify-center pl-2 font-jim xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl select-none ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => !locked && !saving && handlePick(game.id, 'home')}
                        >
                          {pick === 'home' && (
                            <HomeCircleTeam className={`w-full h-full ${locked ? 'text-red-600' : ''}`} />
                          )}
                          <span className={`${locked ? 'text-red-600' : pick === 'home' ? 'text-black' : 'text-black/50'}`}>
                            {getTeamDisplayNameFromTeam(game.homeTeam)}
                          </span>
                        </div>
                        <div className="flex flex-col items-center mx-4 font-bold xl:text-2xl text-lg">
                          {locked && <span className="material-symbols-sharp text-red-600 xl:!text-2xl md:!text-xl !text-lg">lock</span>}
                          <span className={`leading-none ${locked ? 'text-red-600' : 'text-black/50'}`}>@</span>
                        </div>
                        <div
                          className={`relative w-2/5 xl:min-w-60 min-w-40 flex items-center justify-center pl-2 font-jim xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl select-none ${locked ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                          onClick={() => !locked && !saving && handlePick(game.id, 'away')}
                        >
                          {pick === 'away' && (
                            <AwayCircleTeam className={`w-full h-full ${locked ? 'text-red-600' : ''}`} />
                          )}
                          <span className={`${locked ? 'text-red-600' : pick === 'away' ? 'text-black' : 'text-black/50'}`}>
                            {getTeamDisplayNameFromTeam(game.awayTeam)}
                          </span>
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