'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { StatsContent } from '@/components/stats-content'
import { computeSeasonChampionNames } from '@/utils/season-champions'

type CountdownParts = {
  days: number
  hours: number
  minutes: number
  seconds: number
}

function getCountdownParts(target: Date, now: Date = new Date()): CountdownParts {
  const totalMs = Math.max(0, target.getTime() - now.getTime())
  const totalSeconds = Math.floor(totalMs / 1000)
  const days = Math.floor(totalSeconds / (24 * 60 * 60))
  const hours = Math.floor((totalSeconds % (24 * 60 * 60)) / (60 * 60))
  const minutes = Math.floor((totalSeconds % (60 * 60)) / 60)
  const seconds = totalSeconds % 60
  return { days, hours, minutes, seconds }
}

function formatCountdown(parts: CountdownParts): string {
  const { days, hours, minutes, seconds } = parts
  if (days === 0 && hours === 0 && minutes === 0 && seconds === 0) {
    return 'now...'
  }
  const dayLabel = days === 1 ? '1 day' : `${days} days`
  const hourLabel = hours === 1 ? '1 hour' : `${hours} hours`
  const minuteLabel = minutes === 1 ? '1 minute' : `${minutes} minutes`
  const secondLabel = seconds === 1 ? '1 second' : `${seconds} seconds`
  return `in ${dayLabel}, ${hourLabel}, ${minuteLabel}, ${secondLabel}...`
}

/** First Thursday of August for a given year (typical preseason kickoff window). */
function fallbackNextSeasonStart(afterSeasonYear: number): Date {
  const year = afterSeasonYear + 1
  // Find first Thursday in August
  const d = new Date(`${year}-08-01T17:00:00-07:00`)
  const day = d.getDay()
  const daysUntilThu = (4 - day + 7) % 7
  d.setDate(d.getDate() + daysUntilThu)
  return d
}

/** Bookend content for a completed season — winner banner, countdown, then full stats below. */
export function OffSeasonContent() {
  const [completedSeasonYear, setCompletedSeasonYear] = useState<number | null>(null)
  const [championNames, setChampionNames] = useState<string[]>([])
  const [nextSeasonStart, setNextSeasonStart] = useState<Date | null>(null)
  const [countdown, setCountdown] = useState<CountdownParts | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        let completedYear: number | null = null
        let champions: string[] = []

        if (db) {
          const [weekRecapsSnap, usersSnap] = await Promise.all([
            getDocs(collection(db, 'weekRecaps')),
            getDocs(collection(db, 'users')),
          ])
          if (cancelled) return

          const superBowls = weekRecapsSnap.docs.filter((d) => {
            const weekStr = (d.id || '_').split('_')[1] || ''
            return weekStr === 'super-bowl' || weekStr.startsWith('super-bowl-')
          })
          const seasonsWithSuperBowl = superBowls
            .map((d) => parseInt((d.id || '_').split('_')[0], 10))
            .filter((n) => !Number.isNaN(n))
          completedYear =
            seasonsWithSuperBowl.length > 0
              ? Math.max(...seasonsWithSuperBowl)
              : new Date().getFullYear() - 1

          const users = usersSnap.docs
            .map((d) => {
              const data = d.data()
              return {
                id: d.id,
                displayName: typeof data.displayName === 'string' ? data.displayName : '',
              }
            })
            .filter((u) => u.displayName)

          const recaps = weekRecapsSnap.docs.map((d) => ({
            weekId: d.id,
            userStats: d.data().userStats,
          }))

          champions = computeSeasonChampionNames(recaps, users, completedYear)
          setCompletedSeasonYear(completedYear)
          setChampionNames(champions)
        } else {
          completedYear = new Date().getFullYear() - 1
          setCompletedSeasonYear(completedYear)
        }

        const yearToUse = completedYear ?? new Date().getFullYear() - 1

        // Countdown to next season's first preseason week (ESPN), with Aug Thursday fallback
        let nextStart = fallbackNextSeasonStart(yearToUse)
        try {
          const { espnApi } = await import('@/lib/espn-api')
          const nextSeason = yearToUse + 1
          const weeks = await espnApi.getAllAvailableWeeks(nextSeason)
          const firstPreseason = weeks.find((w) => w.weekType === 'preseason')
          if (firstPreseason?.startDate) {
            nextStart = firstPreseason.startDate
          }
        } catch {
          // keep fallback
        }
        if (!cancelled) setNextSeasonStart(nextStart)
      } catch {
        if (!cancelled) {
          const year = new Date().getFullYear() - 1
          setCompletedSeasonYear(year)
          setNextSeasonStart(fallbackNextSeasonStart(year))
        }
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!nextSeasonStart) return

    const tick = () => setCountdown(getCountdownParts(nextSeasonStart))
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [nextSeasonStart])

  const winnerLabel =
    championNames.length === 0
      ? '—'
      : championNames.length === 1
        ? `${championNames[0]}!`
        : `${championNames.join(' & ')}!`

  return (
    <div className="flex flex-col gap-8 items-center justify-center flex-1 pt-8 pb-24 px-4">
      <div className="flex flex-col">
        <div className="w-full uppercase md:text-5xl text-3xl text-center font-bold text-balance">
          {completedSeasonYear != null ? completedSeasonYear : '—'} 🏆 Winner
        </div>
        <div className="w-full max-w-6xl font-jim text-center text-6xl md:text-7xl lg:text-8xl xl:text-9xl leading-none text-balance">
          {winnerLabel}
        </div>
      </div>

      <hr className="w-full my-4 border-t-2 border-black/10" />

      <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
        Thanks for playing!
      </div>
      
      <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
        Next season starts{' '}
        {countdown == null ? 'soon' : formatCountdown(countdown)}
      </div>

      <hr className="w-full my-4 border-t-2 border-black/10" />

      <div className="w-full max-w-6xl">
        <StatsContent lockedSeason={completedSeasonYear} embedded />
      </div>
    </div>
  )
}
