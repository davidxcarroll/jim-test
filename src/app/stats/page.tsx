'use client'

import { useState, useEffect, useCallback } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { useCurrentWeek } from '@/hooks/use-current-week'

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

export default function StatsPage() {
    const [loading, setLoading] = useState(true)
    const [userStats, setUserStats] = useState<UserStats[]>([])
    const [error, setError] = useState<string | null>(null)
    const { weekInfo } = useCurrentWeek()

    const fetchStats = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            if (!db) {
                throw new Error('Firebase not initialized')
            }

            // Fetch all users
            const usersSnapshot = await getDocs(collection(db, 'users'))
            const users: User[] = usersSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data()
                } as any))
                .filter((user: any) => user.displayName)

            // Fetch all week recaps
            const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'))
            const weekRecaps: WeekRecap[] = weekRecapsSnapshot.docs
                .map(doc => ({
                    weekId: doc.id,
                    ...doc.data()
                } as any))
                .filter((recap: any) => {
                    // Only include regular season weeks (exclude preseason and postseason)
                    // Check for normalized round names: wild-card, divisional, conference, super-bowl
                    if (!recap.week || recap.week.includes('preseason') || recap.week.includes('wild-card') || recap.week.includes('divisional') || recap.week.includes('conference') || recap.week.includes('super-bowl')) {
                        return false
                    }
                    
                    // Exclude the current week (matching user stats modal behavior)
                    if (weekInfo) {
                        const [season, weekStr] = recap.weekId.split('_')
                        let weekNumber: number
                        let weekType: 'preseason' | 'regular' | 'postseason' = 'regular'
                        
                        if (weekStr.startsWith('week-')) {
                            weekNumber = parseInt(weekStr.replace('week-', ''))
                            weekType = 'regular'
                        } else if (weekStr.startsWith('preseason-')) {
                            weekNumber = parseInt(weekStr.replace('preseason-', ''))
                            weekType = 'preseason'
                        } else {
                            return true // Include unknown formats (let other filters handle them)
                        }
                        
                        // Check if this is the current week
                        const isCurrentWeek = (
                            (weekInfo.weekType === 'regular' && weekNumber === weekInfo.week && parseInt(season) === weekInfo.season) ||
                            (weekInfo.weekType === 'preseason' && weekNumber === weekInfo.week && parseInt(season) === weekInfo.season)
                        )
                        
                        if (isCurrentWeek) {
                            return false // Exclude current week
                        }
                    }
                    
                    return true
                })

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

            // Calculate overall percentages
            statsMap.forEach(stat => {
                if (stat.totalGames > 0) {
                    stat.overallPercentage = Math.round((stat.totalCorrect / stat.totalGames) * 100)
                }
            })

            // Convert to array and sort by total correct picks
            const statsArray = Array.from(statsMap.values())
                .filter(stat => stat.weeksPlayed > 0) // Only include users who have played
                .sort((a, b) => b.totalCorrect - a.totalCorrect)

            setUserStats(statsArray)
        } catch (err) {
            console.error('Error fetching stats:', err)
            setError(err instanceof Error ? err.message : 'Failed to load stats')
        } finally {
            setLoading(false)
        }
    }, [weekInfo])

    useEffect(() => {
        if (weekInfo) {
            fetchStats()
        }
    }, [weekInfo, fetchStats])

    // Subscribe to weekRecaps collection changes to auto-refresh when a week finishes
    useEffect(() => {
        if (!db || !weekInfo) return

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
    }, [weekInfo, fetchStats])

    if (loading || !weekInfo) {
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
        <div className="min-h-screen bg-neutral-100 font-chakra lg:p-16 p-4">
            <div className="">

                <h1 className="lg:text-9xl text-7xl font-bold uppercase mb-12">Stats</h1>

                <section className="mb-12">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12">

                        {/* Most Correct Picks */}
                        {mostCorrectUsers.length > 0 && (
                            <div className="">
                                <div className="text-2xl font-bold uppercase mb-2 shadow-[0_1px_0_0_#000000] p-2">
                                    <span role="img">🏆</span> Most Correct Picks
                                    {mostCorrectUsers.length > 1 && ` (Tie - ${mostCorrectUsers.length} users)`}
                                </div>
                                {mostCorrectUsers.map((user, index) => (
                                    <div key={user.userId} className={index > 0 ? 'mt-3' : ''}>
                                        <div className="font-jim text-4xl mb-1">{user.userName}</div>
                                        <div className="text-lg">
                                            {user.totalCorrect} correct out of {user.totalGames} games ({user.overallPercentage}%)
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
                                        <div className="font-jim text-4xl mb-1">
                                            {user.userName}
                                        </div>
                                        <div className="text-lg">
                                            {user.weeksWon} week{user.weeksWon !== 1 ? 's' : ''} with top score
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </section>

                {/* Overall Leaderboard */}
                <section className="mb-12">
                    <h2 className="text-2xl font-bold uppercase mb-4 shadow-[0_1px_0_0_#000000] p-2">
                        <span role="img">📋</span> Overall Leaderboard
                    </h2>
                    <div className="">
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="">
                                    <tr className="border-b border-black font-bold uppercase text-sm">
                                        <th className="text-left py-2 px-2">Rank</th>
                                        <th className="text-left py-2 px-2">Name</th>
                                        <th className="text-left py-2 px-2">Correct</th>
                                        <th className="text-left py-2 px-2">Percentage</th>
                                        <th className="text-left py-2 px-2">Weeks Won</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {userStatsWithRanks.map((stat) => (
                                        <tr key={stat.userId} className="border-b border-black">
                                            <td className="py-2 px-2 font-bold">#{stat.rank}</td>
                                            <td className="py-2 px-2 font-jim text-4xl">{stat.userName}</td>
                                            <td className="py-2 px-2 text-left">{stat.totalCorrect}</td>
                                            <td className="py-2 px-2 text-left">{stat.overallPercentage}%</td>
                                            <td className="py-2 px-2 text-left">
                                                {stat.weeksWon > 0 && (
                                                    <span className="inline-flex items-center gap-0.5">
                                                        {'🔥'.repeat(stat.weeksWon)}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </section>

            </div>
        </div>
    )
}
