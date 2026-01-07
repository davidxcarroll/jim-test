import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { collection, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { espnApi } from '@/lib/espn-api'
import { getCurrentNFLWeekFromAPI } from '@/utils/date-helpers'

export async function POST(request: NextRequest) {
  // Verify the request is from a legitimate cron service
  const authHeader = request.headers.get('authorization')
  
  // Verify the request is from Vercel cron
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    console.log('📊 Starting automatic week recap calculation (checking for missing/incorrect weeks)...')

    // Get current NFL week to know what weeks are in the past
    const currentWeek = await getCurrentNFLWeekFromAPI()
    if (!currentWeek) {
      console.error('❌ Could not get current NFL week from ESPN API')
      return NextResponse.json(
        { error: 'Could not get current NFL week from ESPN API' },
        { status: 500 }
      )
    }

    console.log(`📅 Current week: ${currentWeek.week} (${currentWeek.weekType}), Season: ${currentWeek.season}`)

    // Get all available weeks for the current season
    const allWeeks = await espnApi.getAllAvailableWeeks(currentWeek.season)
    console.log(`📅 Found ${allWeeks.length} weeks for season ${currentWeek.season}`)

    // Get all existing week recaps
    const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'))
    const existingRecaps = new Map(
      weekRecapsSnapshot.docs.map(doc => [doc.id, doc.data()])
    )
    console.log(`💾 Found ${existingRecaps.size} existing week recaps`)

    // Get all users
    const usersSnapshot = await getDocs(collection(db, 'users'))
    const users = usersSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as any)).filter((user: any) => user.displayName)
    console.log(`👥 Found ${users.length} users`)

    const results: Array<{ weekId: string; success: boolean; message: string; userCount?: number; recalculated?: boolean }> = []
    const today = new Date()

    // Process each week that's in the past
    for (const week of allWeeks) {
      // Skip current week and future weeks
      if (week.endDate > today) {
        continue
      }

      const weekKey = week.weekType === 'preseason' 
        ? `preseason-${week.week}` 
        : week.weekType === 'postseason' && week.label
          ? week.label.toLowerCase().replace(/\s+/g, '-')
          : `week-${week.week}`
      
      const weekId = `${week.season}_${weekKey}`
      const existingRecap = existingRecaps.get(weekId)

      // Skip if recap already exists, unless it might be incorrect
      if (existingRecap) {
        // Check if recap might be incorrect (calculated before week ended)
        const recapCalculatedAt = existingRecap.calculatedAt?.toDate?.() || new Date(existingRecap.calculatedAt || 0)
        const weekEnded = week.endDate < today
        
        // If week ended after recap was calculated, it might be incorrect - recalculate it
        if (weekEnded && recapCalculatedAt < week.endDate) {
          console.log(`⚠️  ${weekId} - recap calculated before week ended, will recalculate`)
        } else {
          console.log(`⏭️  Skipping ${weekId} - recap already exists and appears correct`)
          continue
        }
      }

      console.log(`🔄 Calculating recap for ${weekId}...`)

      try {
        // Fetch games for this week
        const weekGames = await espnApi.getGamesForDateRange(week.startDate, week.endDate)
        console.log(`🎮 Found ${weekGames.length} games for ${weekId}`)

        // Only calculate if there are finished games
        const finishedGames = weekGames.filter(g => g.status === 'final' || g.status === 'post')
        if (finishedGames.length === 0) {
          console.log(`⏭️  Skipping ${weekId} - no finished games yet`)
          results.push({ weekId, success: false, message: 'No finished games' })
          continue
        }

        // Calculate stats for each user
        // ⚠️ CRITICAL: We ONLY READ user picks here - NEVER modify them
        // User picks are sacred and must never be changed by automated processes
        const userStats = []
        for (const user of users) {
          try {
            // READ ONLY - getDoc is read-only, never use setDoc/updateDoc/deleteDoc on picks
            const userPicksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekId))
            const userPicks = userPicksDoc.exists() ? userPicksDoc.data() : {}
            let correct = 0

            // For each finished game, check if user picked and if correct
            for (const game of finishedGames) {
              const pick = userPicks[game.id]?.pickedTeam
              const homeScore = Number(game.homeScore) || 0
              const awayScore = Number(game.awayScore) || 0
              const homeWon = homeScore > awayScore
              const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon)
              if (pick && pickCorrect) correct++
            }

            const total = finishedGames.length
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
            console.error(`❌ Error calculating stats for user ${user.id} in week ${weekId}:`, error)
          }
        }

        // Find top score
        const maxCorrect = Math.max(...userStats.map(s => s.correct), 0)
        const winnerIds = userStats.filter(s => s.correct === maxCorrect && maxCorrect > 0).map(s => s.userId)

        // Add isTopScore flag to each user's stats
        const userStatsWithTopScore = userStats.map(stat => ({
          ...stat,
          isTopScore: winnerIds.includes(stat.userId)
        }))

        // Save to Firestore - ONLY writing to weekRecaps collection, NEVER touching user picks
        const weekRecapData = {
          weekId,
          season: String(week.season),
          week: weekKey,
          calculatedAt: serverTimestamp(),
          userStats: userStatsWithTopScore
        }

        await setDoc(doc(db, 'weekRecaps', weekId), weekRecapData)
        const wasRecalculated = !!existingRecap
        console.log(`✅ ${wasRecalculated ? 'Recalculated' : 'Saved'} week recap for ${weekId}: ${userStatsWithTopScore.length} users`)

        results.push({
          weekId,
          success: true,
          message: wasRecalculated ? 'Recalculated and updated' : 'Calculated and saved',
          userCount: userStatsWithTopScore.length,
          recalculated: wasRecalculated
        })
      } catch (error) {
        console.error(`❌ Error calculating recap for ${weekId}:`, error)
        results.push({
          weekId,
          success: false,
          message: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    const successCount = results.filter(r => r.success).length
    const failCount = results.filter(r => !r.success).length

    console.log(`📊 Week recap calculation complete: ${successCount} succeeded, ${failCount} failed`)

    return NextResponse.json({
      success: true,
      message: `Processed ${results.length} weeks: ${successCount} succeeded, ${failCount} failed`,
      results,
      summary: {
        total: results.length,
        succeeded: successCount,
        failed: failCount
      }
    })

  } catch (error) {
    console.error('❌ Error in automatic week recap calculation:', error)
    return NextResponse.json(
      { 
        error: 'Failed to calculate week recaps',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

