'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCurrentWeek } from '@/hooks/use-current-week'
import { getWeekKey } from '@/utils/date-helpers'
import { getTeamByAbbreviation, getTeamLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'

interface User {
    id: string
    displayName: string
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
}

/** Movie that appears in the most users' top 10 lists */
interface MostInTop10Movie {
    title: string
    count: number
}

/** Underdog hero: user(s) with most underdog picks (favorite from odds/records) */
interface UnderdogHeroUser {
    userId: string
    userName: string
    underdogPicks: number
    underdogCorrect: number
}

/** Best single week: user(s) with highest correct count in any one week */
interface BestSingleWeekEntry {
    userId: string
    userName: string
    correct: number
    totalInWeek: number
    weekLabel: string
}

const SUPER_BOWL_WINNER_ABBREV = 'SEA' // Seahawks

function getWeekLabelFromWeekId(weekId: string): string {
    const [, weekStr] = (weekId || '_').split('_')
    if (!weekStr) return weekId
    if (weekStr.startsWith('week-')) return `Week ${weekStr.replace('week-', '')}`
    if (weekStr === 'wild-card' || weekStr.startsWith('wild-card')) return 'Wild Card'
    if (weekStr === 'divisional' || weekStr.startsWith('divisional')) return 'Divisional'
    if (weekStr === 'conference' || weekStr.startsWith('conference')) return 'Conference'
    if (weekStr === 'super-bowl' || weekStr.startsWith('super-bowl')) return 'Super Bowl'
    return weekStr
}

export default function StatsPage() {
    const [loading, setLoading] = useState(true)
    const [userStats, setUserStats] = useState<UserStats[]>([])
    const [includedWeekIds, setIncludedWeekIds] = useState<string[]>([])
    const [mostInTop10Movies, setMostInTop10Movies] = useState<MostInTop10Movie[]>([])
    const [seahawksSuperBowlPickers, setSeahawksSuperBowlPickers] = useState<string[]>([])
    const [seahawksTeam, setSeahawksTeam] = useState<Team | null>(null)
    const [underdogHeroUsers, setUnderdogHeroUsers] = useState<UnderdogHeroUser[]>([])
    const [bestSingleWeekEntries, setBestSingleWeekEntries] = useState<BestSingleWeekEntry[]>([])
    const [error, setError] = useState<string | null>(null)
    const { weekInfo, loading: weekLoading } = useCurrentWeek()

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            if (!db) {
                throw new Error('Firebase not initialized')
            }

            // Fetch ALL users from Firestore — stats page never uses clipboard/visible-user settings.
            const usersSnapshot = await getDocs(collection(db, 'users'))
            const users: User[] = usersSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as any))
                .filter((user: any) => user.displayName)

            // Fetch all week recaps
            const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'))
            // When in-season: use API week to exclude current week. When off-season or API failed: no current week to exclude; derive season from recaps.
            const currentWeekId = weekInfo
                ? `${weekInfo.season}_${getWeekKey(weekInfo.weekType, weekInfo.week, weekInfo.label)}`
                : null
            const isPostseasonWeek = (weekStr: string) =>
                ['wild-card', 'divisional', 'conference', 'super-bowl'].some((k) => weekStr === k || weekStr?.startsWith(k + '-'))

            // Expected NFL game counts: 18 regular season weeks = 272 games; postseason = 13 (6+4+2+1). Total = 285 (excl. Pro Bowl).
            // Derive effective season when off-season (weekInfo null): use latest season present in recaps
            const allRecapIds = weekRecapsSnapshot.docs.map(doc => doc.id)
            const seasonsInRecaps = allRecapIds
                .map(id => (id || '_').split('_')[0])
                .filter((s): s is string => /^\d+$/.test(s))
                .map(s => parseInt(s, 10))
            const effectiveSeason = weekInfo
                ? weekInfo.season
                : (seasonsInRecaps.length > 0 ? Math.max(...seasonsInRecaps) : new Date().getFullYear())

            const weekRecapsRaw: WeekRecap[] = weekRecapsSnapshot.docs
                .map(doc => ({
                    weekId: doc.id,
                    ...doc.data()
                } as any))
                .filter((recap: any) => {
                    const [seasonStr, weekStr] = (recap.weekId || '_').split('_')
                    if (!/^\d+$/.test(seasonStr) || !seasonStr) return false
                    const season = parseInt(seasonStr, 10)
                    // Only include the most recent season (from API when in-season, or derived from recaps when off-season)
                    if (season !== effectiveSeason) return false
                    const isRegular = weekStr?.startsWith('week-') && !weekStr?.includes('pro-bowl')
                    const weekNumber = isRegular ? parseInt(weekStr.replace('week-', ''), 10) : NaN
                    const isPostseason = isPostseasonWeek(weekStr)
                    if (!isRegular && !isPostseason) return false
                    if (isRegular && Number.isNaN(weekNumber)) return false
                    // NFL regular season is 18 weeks (272 games total). Exclude week-19 or any ESPN quirk.
                    if (isRegular && (weekNumber < 1 || weekNumber > 18)) return false
                    if (currentWeekId && recap.weekId === currentWeekId) return false
                    return true
                })

            // Sort: regular season 1–18, then postseason order (wild-card, divisional, conference, super-bowl)
            const postseasonOrder: Record<string, number> = { 'wild-card': 1, 'divisional': 2, 'conference': 3, 'super-bowl': 4 }
            const sortKey = (recap: WeekRecap) => {
                const [, weekStr] = (recap.weekId || '_').split('_')
                if (weekStr?.startsWith('week-')) return parseInt(weekStr.replace('week-', ''), 10)
                for (const k of ['super-bowl', 'conference', 'divisional', 'wild-card']) {
                    if (weekStr === k || weekStr?.startsWith(k + '-')) return 100 + (postseasonOrder[k] ?? 0)
                }
                return 0
            }
            const weekRecaps: WeekRecap[] = weekRecapsRaw.sort((a, b) => sortKey(a) - sortKey(b))

            // Calculate stats for each user
            const statsMap = new Map<string, UserStats>()

            // Initialize stats for each user
            users.forEach(user => {
                statsMap.set(user.id, {
                    userId: user.id,
                    userName: user.displayName,
                    totalCorrect: 0,
                    totalGames: 0,
                    overallPercentage: 0,
                    weeksWon: 0,
                    weeksPlayed: 0
                })
            })

            // Process each week recap
            weekRecaps.forEach(recap => {
                recap.userStats.forEach(stat => {
                    const userStat = statsMap.get(stat.userId)
                    if (!userStat) return

                    // Add to totals
                    userStat.totalCorrect += stat.correct
                    userStat.totalGames += stat.total
                    userStat.weeksPlayed++

                    // Track weeks won
                    if (stat.isTopScore) {
                        userStat.weeksWon++
                    }
                })
            })

            // Calculate overall percentages (one decimal place)
            statsMap.forEach(stat => {
                if (stat.totalGames > 0) {
                    stat.overallPercentage = Math.round((stat.totalCorrect / stat.totalGames) * 1000) / 10
                }
            })

            // Leaderboard = all users who appear in at least one week recap (no clipboard/visible filter).
            const statsArray = Array.from(statsMap.values())
                .filter(stat => stat.weeksPlayed > 0) // Only include users who have at least one week in recaps
                .sort((a, b) => b.totalCorrect - a.totalCorrect)

            // Double-check: re-aggregate from recaps and warn if any mismatch (catches aggregation bugs)
            const verifyMap = new Map<string, { correct: number; total: number; weeksWon: number }>()
            weekRecaps.forEach(recap => {
                recap.userStats?.forEach((stat: { userId: string; correct: number; total: number; isTopScore: boolean }) => {
                    const v = verifyMap.get(stat.userId) ?? { correct: 0, total: 0, weeksWon: 0 }
                    v.correct += stat.correct
                    v.total += stat.total
                    if (stat.isTopScore) v.weeksWon++
                    verifyMap.set(stat.userId, v)
                })
            })
            statsArray.forEach(stat => {
                const v = verifyMap.get(stat.userId)
                if (v && (v.correct !== stat.totalCorrect || v.total !== stat.totalGames || v.weeksWon !== stat.weeksWon)) {
                    console.warn('[Stats] Verification mismatch for', stat.userName, { expected: v, got: { totalCorrect: stat.totalCorrect, totalGames: stat.totalGames, weeksWon: stat.weeksWon } })
                }
            })

            setUserStats(statsArray)
            setIncludedWeekIds(weekRecaps.map((r) => r.weekId))

            // Movie in most people's top 10: aggregate moviePicks across all users
            const movieCountByKey = new Map<string, { displayTitle: string; count: number }>()
            users.forEach((user: any) => {
                const picks = user.moviePicks || []
                picks.forEach((pick: any) => {
                    const title = typeof pick === 'string' ? pick : pick?.title
                    const trimmed = typeof title === 'string' ? title.trim() : ''
                    if (!trimmed) return
                    const key = trimmed.toLowerCase()
                    const existing = movieCountByKey.get(key)
                    if (existing) {
                        existing.count += 1
                    } else {
                        movieCountByKey.set(key, { displayTitle: trimmed, count: 1 })
                    }
                })
            })
            const movieCounts = Array.from(movieCountByKey.values()).filter((m) => m.count > 0)
            const maxCount = movieCounts.length > 0 ? Math.max(...movieCounts.map((m) => m.count)) : 0
            const topMovies = movieCounts.filter((m) => m.count === maxCount).map((m) => ({ title: m.displayTitle, count: m.count }))
            setMostInTop10Movies(topMovies)

            // Who picked the Seahawks (super bowl winners) to win the super bowl
            const pickers = users
                .filter((u: any) => u.superBowlPick === SUPER_BOWL_WINNER_ABBREV)
                .map((u: any) => u.displayName)
                .filter(Boolean)
            setSeahawksSuperBowlPickers(pickers)
            getTeamByAbbreviation(SUPER_BOWL_WINNER_ABBREV).then((t) => setSeahawksTeam(t ?? null))

            // Underdog Hero: who picked underdogs most often (favorite from odds/records)
            const underdogByUser = new Map<string, { underdogPicks: number; underdogCorrect: number }>()
            weekRecaps.forEach(recap => {
                recap.userStats.forEach((stat: { userId: string; underdogPicks?: number; underdogCorrect?: number }) => {
                    const u = stat.underdogPicks ?? 0
                    const c = stat.underdogCorrect ?? 0
                    const existing = underdogByUser.get(stat.userId) ?? { underdogPicks: 0, underdogCorrect: 0 }
                    existing.underdogPicks += u
                    existing.underdogCorrect += c
                    underdogByUser.set(stat.userId, existing)
                })
            })
            const maxUnderdogPicks = underdogByUser.size > 0 ? Math.max(...Array.from(underdogByUser.values()).map(v => v.underdogPicks)) : 0
            const underdogHeroList: UnderdogHeroUser[] = maxUnderdogPicks > 0
                ? Array.from(underdogByUser.entries())
                    .filter(([, v]) => v.underdogPicks === maxUnderdogPicks)
                    .map(([userId, v]) => {
                        const u = users.find((x: any) => x.id === userId)
                        return { userId, userName: (u as any)?.displayName ?? 'Unknown', underdogPicks: v.underdogPicks, underdogCorrect: v.underdogCorrect }
                    })
                    .filter(e => e.userName !== 'Unknown')
                : []
            setUnderdogHeroUsers(underdogHeroList)

            // Best single week: who had the highest correct count in any one week
            let bestSingleWeekCorrect = 0
            weekRecaps.forEach(recap => {
                recap.userStats.forEach((stat: { correct: number }) => {
                    if (stat.correct > bestSingleWeekCorrect) bestSingleWeekCorrect = stat.correct
                })
            })
            const bestSingleWeekCandidates: Array<{ userId: string; correct: number; totalInWeek: number; weekId: string }> = []
            if (bestSingleWeekCorrect > 0) {
                weekRecaps.forEach(recap => {
                    recap.userStats.forEach((stat: { userId: string; correct: number; total: number }) => {
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
            const bestSingleWeekList: BestSingleWeekEntry[] = bestSingleWeekCandidates.map(({ userId, correct, totalInWeek, weekId }) => {
                const u = users.find((x: any) => x.id === userId)
                return {
                    userId,
                    userName: (u as any)?.displayName ?? 'Unknown',
                    correct,
                    totalInWeek,
                    weekLabel: getWeekLabelFromWeekId(weekId)
                }
            }).filter(e => e.userName !== 'Unknown')
            setBestSingleWeekEntries(bestSingleWeekList)
        } catch (err) {
            console.error('Error fetching stats:', err)
            setError(err instanceof Error ? err.message : 'Failed to load stats')
        } finally {
            setLoading(false)
        }
    }, [weekInfo])

    // Load stats once we know current week (or that we're off-season). Works in-season and off-season.
    useEffect(() => {
        if (!weekLoading) {
            fetchStats()
        }
    }, [weekLoading, fetchStats])

    // Subscribe to weekRecaps collection changes to auto-refresh when a week finishes
    useEffect(() => {
        if (!db || weekLoading) return

        const weekRecapsRef = collection(db, 'weekRecaps')

        // Set up real-time listener for week recap changes
        const unsubscribe = onSnapshot(
            weekRecapsRef,
            (snapshot) => {
                // When week recaps change (new recap added or updated), refresh stats
                console.log('📊 Week recap change detected, refreshing stats...')
                fetchStats()
            },
            (error) => {
                console.error('Error listening to week recap changes:', error)
                setError('Failed to listen for updates')
            }
        )

        // Cleanup listener on unmount
        return () => unsubscribe()
    }, [weekLoading, fetchStats])

    if (weekLoading || loading) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center font-chakra">
                <div className="text-2xl font-bold uppercase">Loading Stats...</div>
            </div>
        )
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center font-chakra">
                <div className="text-center">
                    <div className="text-2xl font-bold uppercase text-red-600 mb-4">Error</div>
                    <div className="text-lg">{error}</div>
                </div>
            </div>
        )
    }

    // Calculate ranks with ties
    const userStatsWithRanks: Array<UserStats & { rank: number }> = []
    let currentRank = 1

    userStats.forEach((stat, index) => {
        // If this is not the first user and has different totalCorrect than previous, update rank
        if (index > 0 && stat.totalCorrect !== userStats[index - 1].totalCorrect) {
            currentRank = index + 1
        }
        userStatsWithRanks.push({ ...stat, rank: currentRank })
    })

    // Find users with most correct picks (handle ties)
    const maxCorrect = userStats.length > 0 ? userStats[0].totalCorrect : 0
    const mostCorrectUsers = userStats.filter(stat => stat.totalCorrect === maxCorrect)

    // Find users with most weeks won (handle ties)
    const maxWeeksWon = Math.max(...userStats.map(stat => stat.weeksWon), 0)
    const mostWeeksWonUsers = userStats.filter(stat => stat.weeksWon === maxWeeksWon)

    return (
        <div className="min-h-screen bg-neutral-100 font-chakra lg:pt-4 lg:p-16 p-4">
            <div className="">

                <h1 className="lg:text-9xl text-7xl font-bold uppercase mb-8">Stats</h1>

                <section className="mb-16">
                    <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-12">

                        {/* Most Correct Picks */}
                        {mostCorrectUsers.length > 0 && (
                            <div className="">
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

                        {/* Most Weeks Won */}
                        {mostWeeksWonUsers.length > 0 && (
                            <div className="">
                                <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                                    <span role="img">🔥</span> Most Weeks Won
                                </div>
                                {mostWeeksWonUsers.map((user, index) => (
                                    <div key={user.userId} className={index > 0 ? 'mt-3' : ''}>
                                        <div className="-mb-1 font-jim text-4xl">
                                            {user.userName}
                                        </div>
                                        <div className="text-lg">
                                            {user.weeksWon} week{user.weeksWon !== 1 ? 's' : ''} with top score
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Picked Seahawks to win the Super Bowl */}
                        {seahawksSuperBowlPickers.length > 0 && (
                            <div className="">
                                <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2 flex items-center gap-2">
                                    {seahawksTeam && getTeamLogo(seahawksTeam, 'default') && (
                                        <img
                                            src={getTeamLogo(seahawksTeam, 'default')}
                                            alt="Seattle Seahawks"
                                            className="w-16 aspect-video object-cover"
                                        />
                                    )}
                                    Super Bowl pick
                                </div>
                                {seahawksSuperBowlPickers.map((name, index) => (
                                    <div key={name} className={index > 0 ? '' : ''}>
                                        <div className="font-jim text-4xl">{name}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Best single week */}
                        {bestSingleWeekEntries.length > 0 && (
                            <div className="">
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

                        {/* Underdog Hero: most underdog picks (favorite from odds/records) */}
                        {underdogHeroUsers.length > 0 && (
                            <div className="">
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

                        {/* Movie in most people's top 10 */}
                        {mostInTop10Movies.length > 0 && (
                            <div className="">
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

                {/* Overall Leaderboard */}
                <section className="mb-4">
                    <h2 className="text-2xl font-bold uppercase mb-4 shadow-[0_1px_0_0_#000000] p-2">
                        <span role="img">📋</span> Overall Leaderboard
                    </h2>
                    <div className="">
                        <div className="mb-8">
                            <table className="w-full">
                                <thead className="">
                                    <tr className="border-b border-black font-bold uppercase text-sm">
                                        <th className="text-center py-2 px-2">Rank</th>
                                        <th className="text-center py-2 px-2">Name</th>
                                        <th className="text-center py-2 px-2">Correct</th>
                                        <th className="text-center py-2 px-2">Percentage</th>
                                        <th className="text-center py-2 px-2">Weeks Won</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userStatsWithRanks.map((stat) => (
                                        <tr key={stat.userId} className="border-b border-black">
                                            <td className="py-2 px-2 font-bold text-center">#{stat.rank}</td>
                                            <td className="py-2 px-2 font-jim text-4xl text-center">
                                                {stat.userName}
                                                {stat.weeksPlayed < includedWeekIds.length && (
                                                    <span title="Did not enter picks for all weeks"> *</span>
                                                )}
                                            </td>
                                            <td className="py-2 px-2 text-center">{stat.totalCorrect}</td>
                                            <td className="py-2 px-2 text-center">{stat.overallPercentage.toFixed(1)}%</td>
                                            <td className="py-2 px-2 text-center">
                                                {stat.weeksWon > 0 && (
                                                    <span className="inline-flex items-center gap-0.5 justify-center">
                                                        {'🔥'.repeat(stat.weeksWon)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        {includedWeekIds.length > 0 && userStatsWithRanks.some(s => s.weeksPlayed < includedWeekIds.length) && (
                            <p className="">
                                <span className="text-5xl font-jim">*</span>
                                Did not enter picks for all weeks (all regular season and postseason weeks, excluding Pro Bowl)
                            </p>
                        )}
                    </div>
                </section>

            </div>
        </div>
    )
}
