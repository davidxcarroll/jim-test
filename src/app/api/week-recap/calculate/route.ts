import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { espnApi } from '@/lib/espn-api'
import { getSeasonAndWeek, dateHelpers } from '@/utils/date-helpers'

export async function POST(request: NextRequest) {
  try {
    const { weekOffset = 0 } = await request.json()
    
    // Use ESPN API to get current week info
    const today = new Date()
    const { season, week } = await getSeasonAndWeek(today)
    const { start, end } = dateHelpers.getWednesdayWeekRange(today)
    const weekId = `${season}_${week}`

    console.log(`🔄 Calculating recap for week ${weekId} (${start.toISOString()} to ${end.toISOString()})`)

    // Check if recap already exists
    const existingRecapDoc = await getDoc(doc(db, 'weekRecaps', weekId))
    if (existingRecapDoc.exists()) {
      console.log(`💾 Week recap data already exists for ${weekId}`)
      return NextResponse.json({ 
        success: true, 
        message: 'Week recap data already exists',
        weekId 
      })
    }

    // Fetch all users
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any)).filter((user: any) => user.displayName)

    // Fetch games for this week
    const weekGames = await espnApi.getGamesForDateRange(start, end)
    console.log(`🎮 Found ${weekGames.length} games for week ${weekId}`)

    // Calculate stats for each user
    const userStats = []
    for (const user of users) {
      try {
        const userPicksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekId))
        const userPicks = userPicksDoc.exists() ? userPicksDoc.data() : {}
        let correct = 0
        // For each played game, check if user picked and if correct
        for (const game of weekGames) {
          if (game.status === 'final' || game.status === 'post') {
            const pick = userPicks[game.id]?.pickedTeam
            const homeScore = Number(game.homeScore) || 0
            const awayScore = Number(game.awayScore) || 0
            const homeWon = homeScore > awayScore
            const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon)
            if (pick && pickCorrect) correct++
            // If no pick, counts as incorrect (do nothing)
          }
        }
        const total = weekGames.filter(g => g.status === 'final' || g.status === 'post').length
        if (total > 0) {
          const percentage = Math.round((correct / total) * 100)
          userStats.push({
            userId: user.id,
            correct,
            total,
            percentage
          })
        }
      } catch (error) {
        console.error(`❌ Error calculating stats for user ${user.id}:`, error)
      }
    }

    // Find top score
    const maxCorrect = Math.max(...userStats.map(s => s.correct))
    const winnerIds = userStats.filter(s => s.correct === maxCorrect && maxCorrect > 0).map(s => s.userId)

    // Add isTopScore flag to each user's stats
    const userStatsWithTopScore = userStats.map(stat => ({
      ...stat,
      isTopScore: winnerIds.includes(stat.userId)
    }))

    // Save to Firestore
    const weekRecapData = {
      weekId,
      season,
      week,
      calculatedAt: serverTimestamp(),
      userStats: userStatsWithTopScore
    }

    await setDoc(doc(db, 'weekRecaps', weekId), weekRecapData)
    console.log(`💾 Saved week recap data for ${weekId}: ${userStatsWithTopScore.length} users`)

    return NextResponse.json({ 
      success: true, 
      message: 'Week recap data calculated and saved',
      weekId,
      userCount: userStatsWithTopScore.length,
      topScore: maxCorrect
    })

  } catch (error) {
    console.error('❌ Error calculating week recap:', error)
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to calculate week recap' 
    }, { status: 500 })
  }
} 