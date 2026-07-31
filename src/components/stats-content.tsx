'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCurrentWeek } from '@/hooks/use-current-week'
import { getWeekKey } from '@/utils/date-helpers'
import { getSuperBowlWinnerForSeason } from '@/utils/season-winners'
import { getSuperBowlPickForSeason } from '@/utils/super-bowl-picks'
import { PHIL_USER } from '@/utils/phil-user'

interface User {
  id: string
  displayName: string
  superBowlPick?: string
  superBowlPicks?: Record<string, string>
  moviePicks?: unknown[]
}

interface WeekRecap {
  weekId: string
  season: string
  week: string
  userStats: Array<{
    userId: string
    correct: number
    total: number
    percentage: number
    isTopScore: boolean
    underdogPicks?: number
    underdogCorrect?: number
  }>
}

interface UserStats {
  userId: string
  userName: string
  totalCorrect: number
  totalGames: number
  overallPercentage: number
  weeksWon: number
  weeksPlayed: number
  weekIdsPresent?: string[]
}

interface MostInTop10Movie {
  title: string
  count: number
}

interface UnderdogHeroUser {
  userId: string
  userName: string
  underdogPicks: number
  underdogCorrect: number
}

interface BestSingleWeekEntry {
  userId: string
  userName: string
  correct: number
  totalInWeek: number
  weekLabel: string
}

function getWeekLabelFromWeekId(weekId: string): string {
  const [, weekStr] = (weekId || '_').split('_')
  if (!weekStr) return weekId
  if (weekStr.startsWith('preseason-')) return `PRESEASON ${weekStr.replace('preseason-', '')}`
  if (weekStr.startsWith('week-')) return `Week ${weekStr.replace('week-', '')}`
  if (weekStr === 'wild-card' || weekStr.startsWith('wild-card')) return 'Wild Card'
  if (weekStr === 'divisional' || weekStr.startsWith('divisional')) return 'Divisional'
  if (weekStr === 'conference' || weekStr.startsWith('conference')) return 'Conference'
  if (weekStr === 'super-bowl' || weekStr.startsWith('super-bowl')) return 'Super Bowl'
  return weekStr
}

const isPostseasonWeek = (weekStr: string) =>
  ['wild-card', 'divisional', 'conference', 'super-bowl'].some(
    (k) => weekStr === k || weekStr?.startsWith(k + '-')
  )

export type StatsContentProps = {
  /** When set, lock to this season (e.g. completed year on off-season bookend). */
  lockedSeason?: number | null
  /** Hide the Stats h1 / season dropdown chrome (embedded under off-season wrap-up). */
  embedded?: boolean
}

export function StatsContent({ lockedSeason = null, embedded = false }: StatsContentProps) {
  const [loading, setLoading] = useState(true)
  const [userStats, setUserStats] = useState<UserStats[]>([])
  const [includedWeekIds, setIncludedWeekIds] = useState<string[]>([])
  const [mostInTop10Movies, setMostInTop10Movies] = useState<MostInTop10Movie[]>([])
  const [superBowlPickers, setSuperBowlPickers] = useState<string[]>([])
  const [winnerAbbrev, setWinnerAbbrev] = useState<string | null>(null)
  const [underdogHeroUsers, setUnderdogHeroUsers] = useState<UnderdogHeroUser[]>([])
  const [bestSingleWeekEntries, setBestSingleWeekEntries] = useState<BestSingleWeekEntry[]>([])
  const [error, setError] = useState<string | null>(null)
  const [effectiveSeason, setEffectiveSeason] = useState<number | null>(null)
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null)
  const [availableSeasons, setAvailableSeasons] = useState<number[]>([])
  const { weekInfo, loading: weekLoading } = useCurrentWeek()

  const fetchStats = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      if (!db) {
        throw new Error('Firebase not initialized')
      }

      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users: User[] = usersSnapshot.docs
        .map((docSnap) => ({
          id: docSnap.id,
          ...docSnap.data()
        } as User))
        .filter((user) => user.displayName)

      const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'))
      const currentWeekId = weekInfo
        ? `${weekInfo.season}_${getWeekKey(weekInfo.weekType, weekInfo.week, weekInfo.label)}`
        : null

      const allRecapIds = weekRecapsSnapshot.docs.map((docSnap) => docSnap.id)
      const seasonsInRecaps = allRecapIds
        .map((id) => (id || '_').split('_')[0])
        .filter((s): s is string => /^\d+$/.test(s))
        .map((s) => parseInt(s, 10))
      const uniqueSeasons = Array.from(new Set(seasonsInRecaps)).sort((a, b) => b - a)
      setAvailableSeasons(uniqueSeasons)

      let defaultEffectiveSeason: number
      if (lockedSeason != null) {
        defaultEffectiveSeason = lockedSeason
      } else if (weekInfo) {
        defaultEffectiveSeason = weekInfo.season
      } else {
        const superBowls = weekRecapsSnapshot.docs.filter((d) => {
          const weekStr = (d.id || '_').split('_')[1] || ''
          return weekStr === 'super-bowl' || weekStr.startsWith('super-bowl-')
        })
        const seasonsWithSuperBowl = superBowls
          .map((d) => parseInt((d.id || '_').split('_')[0], 10))
          .filter((n) => !Number.isNaN(n))
        defaultEffectiveSeason =
          seasonsWithSuperBowl.length > 0
            ? Math.max(...seasonsWithSuperBowl)
            : seasonsInRecaps.length > 0
              ? Math.max(...seasonsInRecaps)
              : new Date().getFullYear()
      }

      const seasonToUse = lockedSeason != null ? lockedSeason : selectedSeason ?? defaultEffectiveSeason
      const isViewingCurrentSeason = seasonToUse === weekInfo?.season
      const includePreseason =
        weekInfo?.weekType === 'preseason' && isViewingCurrentSeason

      const filtered: WeekRecap[] = weekRecapsSnapshot.docs
        .map((docSnap) => ({
          weekId: docSnap.id,
          ...docSnap.data()
        } as WeekRecap))
        .filter((recap) => {
          const [seasonStr, weekStr] = (recap.weekId || '_').split('_')
          if (!/^\d+$/.test(seasonStr) || !seasonStr) return false
          const season = parseInt(seasonStr, 10)
          if (season !== seasonToUse) return false
          const isRegular = weekStr?.startsWith('week-') && !weekStr?.includes('pro-bowl')
          const isPreseason = weekStr?.startsWith('preseason-')
          const weekNumber = isRegular ? parseInt(weekStr.replace('week-', ''), 10) : NaN
          const isPostseason = isPostseasonWeek(weekStr)
          if (!isRegular && !isPostseason && !(includePreseason && isPreseason)) return false
          if (isRegular && Number.isNaN(weekNumber)) return false
          if (isRegular && (weekNumber < 1 || weekNumber > 18)) return false
          if (isViewingCurrentSeason && currentWeekId && recap.weekId === currentWeekId) return false
          return true
        })

      const canonicalKey = (recap: WeekRecap) => {
        const [, weekStr] = (recap.weekId || '_').split('_')
        if (!weekStr) return recap.weekId
        const seasonStr = (recap.weekId || '_').split('_')[0] ?? ''
        if (weekStr.startsWith('week-')) {
          const n = parseInt(weekStr.replace('week-', ''), 10)
          if (!Number.isNaN(n) && n >= 1 && n <= 18) return `${seasonStr}_week-${n}`
        }
        return recap.weekId
      }
      const dedupeMap = new Map<string, WeekRecap>()
      filtered.forEach((recap) => {
        const canonical = canonicalKey(recap)
        const existing = dedupeMap.get(canonical)
        const userCount = recap.userStats?.length ?? 0
        const existingCount = existing?.userStats?.length ?? 0
        if (!existing || userCount > existingCount) {
          dedupeMap.set(canonical, recap)
        }
      })

      const postseasonOrder: Record<string, number> = {
        'wild-card': 1,
        divisional: 2,
        conference: 3,
        'super-bowl': 4
      }
      const sortKey = (recap: WeekRecap) => {
        const [, weekStr] = (recap.weekId || '_').split('_')
        if (weekStr?.startsWith('preseason-')) {
          return -100 + parseInt(weekStr.replace('preseason-', ''), 10)
        }
        if (weekStr?.startsWith('week-')) return parseInt(weekStr.replace('week-', ''), 10)
        for (const k of ['super-bowl', 'conference', 'divisional', 'wild-card']) {
          if (weekStr === k || weekStr?.startsWith(k + '-')) return 100 + (postseasonOrder[k] ?? 0)
        }
        return 0
      }
      const weekRecaps: WeekRecap[] = Array.from(dedupeMap.values()).sort(
        (a, b) => sortKey(a) - sortKey(b)
      )

      const statsMap = new Map<string, UserStats>()
      users.forEach((user) => {
        statsMap.set(user.id, {
          userId: user.id,
          userName: user.displayName,
          totalCorrect: 0,
          totalGames: 0,
          overallPercentage: 0,
          weeksWon: 0,
          weeksPlayed: 0,
          weekIdsPresent: []
        })
      })

      weekRecaps.forEach((recap) => {
        recap.userStats?.forEach((stat) => {
          const userStat = statsMap.get(stat.userId)
          if (!userStat) return
          userStat.totalCorrect += stat.correct
          userStat.totalGames += stat.total
          userStat.weeksPlayed++
          userStat.weekIdsPresent?.push(recap.weekId)
          if (stat.isTopScore) userStat.weeksWon++
        })
      })

      statsMap.forEach((stat) => {
        if (stat.totalGames > 0) {
          stat.overallPercentage = Math.round((stat.totalCorrect / stat.totalGames) * 1000) / 10
        }
      })

      const statsArray = Array.from(statsMap.values())
        .filter((stat) => stat.weeksPlayed > 0)
        .sort((a, b) => b.totalCorrect - a.totalCorrect)

      setUserStats(statsArray)
      setIncludedWeekIds(weekRecaps.map((r) => r.weekId))
      setEffectiveSeason(seasonToUse)

      const movieCountByKey = new Map<string, { displayTitle: string; count: number }>()
      users.forEach((user) => {
        const picks = user.moviePicks || []
        picks.forEach((pick: unknown) => {
          const title = typeof pick === 'string' ? pick : (pick as { title?: string })?.title
          const trimmed = typeof title === 'string' ? title.trim() : ''
          if (!trimmed) return
          const key = trimmed.toLowerCase()
          const existing = movieCountByKey.get(key)
          if (existing) existing.count += 1
          else movieCountByKey.set(key, { displayTitle: trimmed, count: 1 })
        })
      })
      const movieCounts = Array.from(movieCountByKey.values()).filter((m) => m.count > 0)
      const maxCount = movieCounts.length > 0 ? Math.max(...movieCounts.map((m) => m.count)) : 0
      setMostInTop10Movies(
        movieCounts.filter((m) => m.count === maxCount).map((m) => ({ title: m.displayTitle, count: m.count }))
      )

      const superBowlWinnerAbbrev = getSuperBowlWinnerForSeason(seasonToUse)
      if (superBowlWinnerAbbrev) {
        const pickers = users
          .filter((u) => getSuperBowlPickForSeason(u, seasonToUse) === superBowlWinnerAbbrev)
          .map((u) => u.displayName)
          .filter(Boolean)
        if (getSuperBowlPickForSeason(PHIL_USER, seasonToUse) === superBowlWinnerAbbrev) {
          if (!pickers.includes(PHIL_USER.displayName)) pickers.push(PHIL_USER.displayName)
        }
        setSuperBowlPickers(pickers)
        setWinnerAbbrev(superBowlWinnerAbbrev)
      } else {
        setSuperBowlPickers([])
        setWinnerAbbrev(null)
      }

      const underdogByUser = new Map<string, { underdogPicks: number; underdogCorrect: number }>()
      weekRecaps.forEach((recap) => {
        recap.userStats?.forEach((stat) => {
          const existing = underdogByUser.get(stat.userId) ?? { underdogPicks: 0, underdogCorrect: 0 }
          existing.underdogPicks += stat.underdogPicks ?? 0
          existing.underdogCorrect += stat.underdogCorrect ?? 0
          underdogByUser.set(stat.userId, existing)
        })
      })
      const maxUnderdogPicks =
        underdogByUser.size > 0
          ? Math.max(...Array.from(underdogByUser.values()).map((v) => v.underdogPicks))
          : 0
      setUnderdogHeroUsers(
        maxUnderdogPicks > 0
          ? Array.from(underdogByUser.entries())
            .filter(([, v]) => v.underdogPicks === maxUnderdogPicks)
            .map(([userId, v]) => ({
              userId,
              userName: users.find((x) => x.id === userId)?.displayName ?? 'Unknown',
              underdogPicks: v.underdogPicks,
              underdogCorrect: v.underdogCorrect
            }))
            .filter((e) => e.userName !== 'Unknown')
          : []
      )

      let bestSingleWeekCorrect = 0
      weekRecaps.forEach((recap) => {
        recap.userStats?.forEach((stat) => {
          if (stat.correct > bestSingleWeekCorrect) bestSingleWeekCorrect = stat.correct
        })
      })
      const bestSingleWeekCandidates: Array<{
        userId: string
        correct: number
        totalInWeek: number
        weekId: string
      }> = []
      if (bestSingleWeekCorrect > 0) {
        weekRecaps.forEach((recap) => {
          recap.userStats?.forEach((stat) => {
            if (stat.correct === bestSingleWeekCorrect) {
              bestSingleWeekCandidates.push({
                userId: stat.userId,
                correct: stat.correct,
                totalInWeek: stat.total ?? 0,
                weekId: recap.weekId
              })
            }
          })
        })
      }
      setBestSingleWeekEntries(
        bestSingleWeekCandidates
          .map(({ userId, correct, totalInWeek, weekId }) => ({
            userId,
            userName: users.find((x) => x.id === userId)?.displayName ?? 'Unknown',
            correct,
            totalInWeek,
            weekLabel: getWeekLabelFromWeekId(weekId)
          }))
          .filter((e) => e.userName !== 'Unknown')
      )
    } catch (err) {
      console.error('Error fetching stats:', err)
      setError(err instanceof Error ? err.message : 'Failed to load stats')
    } finally {
      setLoading(false)
    }
  }, [weekInfo, selectedSeason, lockedSeason])

  useEffect(() => {
    if (!weekLoading) fetchStats()
  }, [weekLoading, fetchStats])

  useEffect(() => {
    if (!db || weekLoading) return
    const unsubscribe = onSnapshot(
      collection(db, 'weekRecaps'),
      () => fetchStats(),
      (err) => {
        console.error('Error listening to week recap changes:', err)
        setError('Failed to listen for updates')
      }
    )
    return () => unsubscribe()
  }, [weekLoading, fetchStats])

  if (weekLoading || loading) {
    return (
      <div className={embedded ? 'w-full py-8 text-center' : 'flex items-center justify-center py-20'}>
        <div className="text-2xl font-bold uppercase">Loading Stats...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="text-2xl font-bold uppercase text-red-600 mb-4">Error</div>
        <div className="text-lg">{error}</div>
      </div>
    )
  }

  const userStatsWithRanks: Array<UserStats & { rank: number }> = []
  let currentRank = 1
  userStats.forEach((stat, index) => {
    if (index > 0 && stat.totalCorrect !== userStats[index - 1].totalCorrect) {
      currentRank = index + 1
    }
    userStatsWithRanks.push({ ...stat, rank: currentRank })
  })

  const maxCorrect = userStats.length > 0 ? userStats[0].totalCorrect : 0
  const mostCorrectUsers = userStats.filter((stat) => stat.totalCorrect === maxCorrect)
  const maxWeeksWon = Math.max(...userStats.map((stat) => stat.weeksWon), 0)
  const mostWeeksWonUsers = userStats.filter((stat) => stat.weeksWon === maxWeeksWon)

  return (
    <div className={embedded ? 'w-full text-left' : ''}>
      {!embedded && (
        <div className="flex flex-wrap items-baseline gap-4 mb-8">
          <h1 className="lg:text-9xl text-7xl font-bold uppercase">Stats</h1>
          {availableSeasons.length > 0 && effectiveSeason != null && lockedSeason == null && (
            <label className="flex items-center gap-2 font-bold uppercase text-sm">
              <span>Season:</span>
              <select
                value={effectiveSeason}
                onChange={(e) => setSelectedSeason(Number(e.target.value))}
                className="bg-neutral-100 border border-black px-2 py-1 shadow-[inset_0_0_0_1px_#000000] font-chakra"
              >
                {availableSeasons.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>
      )}

      {embedded && effectiveSeason != null && (
        <div className="w-full mb-8 uppercase md:text-5xl text-3xl text-center font-bold text-balance">
          {effectiveSeason} Stats
        </div>
      )}

      <section className="mb-16">
        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-12">
          {mostCorrectUsers.length > 0 && (
            <div>
              <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                <span role="img">🏆</span> Most Correct Picks
                {mostCorrectUsers.length > 1 && ` (Tie - ${mostCorrectUsers.length} users)`}
              </div>
              {mostCorrectUsers.map((user, index) => (
                <div key={user.userId} className={index > 0 ? 'mt-3' : ''}>
                  <div className="-mb-1 font-jim text-4xl">{user.userName}</div>
                  <div className="text-lg">
                    {user.totalCorrect} correct out of {user.totalGames} games ({user.overallPercentage.toFixed(1)}%)
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostWeeksWonUsers.length > 0 && (
            <div>
              <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                <span role="img">🔥</span> Most Weeks Won
              </div>
              {mostWeeksWonUsers.map((user, index) => (
                <div key={user.userId} className={index > 0 ? 'mt-3' : ''}>
                  <div className="-mb-1 font-jim text-4xl">{user.userName}</div>
                  <div className="text-lg">
                    {user.weeksWon} week{user.weeksWon !== 1 ? 's' : ''} with top score
                  </div>
                </div>
              ))}
            </div>
          )}

          {superBowlPickers.length > 0 && (
            <div>
              <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2 flex items-center gap-2">
                {winnerAbbrev && (
                  <img
                    src={`https://a.espncdn.com/i/teamlogos/nfl/500/${winnerAbbrev.toLowerCase()}.png`}
                    alt={winnerAbbrev}
                    className="w-16 aspect-video object-cover"
                  />
                )}
                Super Bowl pick
              </div>
              {superBowlPickers.map((name) => (
                <div key={name}>
                  <div className="font-jim text-4xl">{name}</div>
                </div>
              ))}
            </div>
          )}

          {bestSingleWeekEntries.length > 0 && (
            <div>
              <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                <span role="img">☝️</span> Best Single Week
              </div>
              {bestSingleWeekEntries.map((entry, index) => (
                <div key={`${entry.userId}-${entry.weekLabel}-${index}`} className={index > 0 ? 'mt-3' : ''}>
                  <div className="-mb-1 font-jim text-4xl">{entry.userName}</div>
                  <div className="text-lg">
                    {entry.correct}/{entry.totalInWeek} in {entry.weekLabel}
                  </div>
                </div>
              ))}
            </div>
          )}

          {underdogHeroUsers.length > 0 && (
            <div>
              <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                <span role="img">🐶</span> Underdog Hero
              </div>
              {underdogHeroUsers.map((entry, index) => (
                <div key={entry.userId} className={index > 0 ? 'mt-3' : ''}>
                  <div className="-mb-1 font-jim text-4xl">{entry.userName}</div>
                  <div className="text-lg">
                    {entry.underdogPicks} underdog pick{entry.underdogPicks !== 1 ? 's' : ''}
                    {entry.underdogCorrect > 0 && ` (${entry.underdogCorrect} correct)`}
                  </div>
                </div>
              ))}
            </div>
          )}

          {mostInTop10Movies.length > 0 && (
            <div>
              <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                <span role="img">🎬</span> Top of Top 10
              </div>
              {mostInTop10Movies.map((movie, index) => (
                <div key={movie.title} className={index > 0 ? 'mt-3' : ''}>
                  <div className="-mb-1 font-jim text-4xl">{movie.title}</div>
                  <div className="text-lg">
                    In {movie.count} list{movie.count !== 1 ? 's' : ''}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="mb-4">
        <h2 className="text-2xl font-bold uppercase mb-4 shadow-[0_1px_0_0_#000000] p-2">
          <span role="img">📋</span> Overall Leaderboard
        </h2>
        <div>
          <div className="mb-8">
            <table className="w-full">
              <thead className="sticky top-0 bg-neutral-100 font-bold uppercase text-sm shadow-[0_1px_0_0_rgba(0,0,0,0.2)]">
                <tr>
                  <th className="text-center py-2 px-2">Rank</th>
                  <th className="text-center py-2 px-2">Name</th>
                  <th className="text-center py-2 px-2">Correct</th>
                  <th className="text-center py-2 px-2">Percentage</th>
                </tr>
              </thead>
              <tbody>
                {userStatsWithRanks.map((stat) => (
                  <tr key={stat.userId} className="border-b border-black/20">
                    <td className="py-2 px-2 font-bold text-center">#{stat.rank}</td>
                    <td className="py-2 px-2 font-jim text-4xl text-center">
                      {stat.userName}
                      {stat.weeksPlayed < includedWeekIds.length && (
                        <span title="Did not enter picks for all weeks"> *</span>
                      )}
                    </td>
                    <td className="py-2 px-2 text-center">{stat.totalCorrect}</td>
                    <td className="py-2 px-2 text-center">{stat.overallPercentage.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {includedWeekIds.length > 0 &&
            userStatsWithRanks.some((s) => s.weeksPlayed < includedWeekIds.length) && (
              <p>
                <span className="text-5xl font-jim">*</span>
                Did not enter picks for all weeks
              </p>
            )}
        </div>
      </section>
    </div>
  )
}
