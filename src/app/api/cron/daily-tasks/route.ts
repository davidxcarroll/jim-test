import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getSeasonAndWeek, getCurrentNFLWeekFromAPI, getWeekKey } from '@/utils/date-helpers'
import { espnApi } from '@/lib/espn-api'

export async function POST(request: NextRequest) {
  // Verify the request is from a legitimate cron service
  const authHeader = request.headers.get('authorization')
  
  // Verify the request is from Vercel cron
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: {
    weeklyReminders?: { success: boolean; sentTo?: number; error?: string }
    weekRecaps?: { success: boolean; processed?: number; succeeded?: number; failed?: number; error?: string }
  } = {}

  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

  try {
    // Check if Firebase is initialized
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      )
    }

    // TASK 1: Weekly Reminders (only on Mondays)
    if (dayOfWeek === 1) {
      try {
        console.log('📧 Running weekly reminders task...')
        const { season, week } = await getSeasonAndWeek(today)
        const finalWeekNumber = parseInt(week.replace('week-', ''), 10)

        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('emailNotifications', '==', true))
        const querySnapshot = await getDocs(q)
        
        const emailPromises = querySnapshot.docs.map(doc => {
          const userData = doc.data()
          console.log('Sending email to user:', { email: userData.email, displayName: userData.displayName })
          return emailService.sendWeeklyReminder(
            userData.email,
            userData.displayName,
            finalWeekNumber
          )
        })

        await Promise.all(emailPromises)
        
        results.weeklyReminders = {
          success: true,
          sentTo: querySnapshot.size
        }
        console.log(`✅ Weekly reminders sent to ${querySnapshot.size} users`)
      } catch (error) {
        console.error('❌ Error sending weekly reminder emails:', error)
        results.weeklyReminders = {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      }
    }

    // TASK 2: Calculate Week Recaps (runs daily)
    try {
      console.log('📊 Running week recap calculation task...')
      const currentWeekResult = await getCurrentNFLWeekFromAPI()
      if (!currentWeekResult || 'offSeason' in currentWeekResult) {
        throw new Error('Could not get current NFL week from ESPN API')
      }
      const currentWeek = currentWeekResult
      console.log(`📅 Current week: ${currentWeek.week} (${currentWeek.weekType}), Season: ${currentWeek.season}`)

      const allWeeks = await espnApi.getAllAvailableWeeks(currentWeek.season)
      console.log(`📅 Found ${allWeeks.length} weeks for season ${currentWeek.season}`)

      const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'))
      const existingRecaps = new Map(
        weekRecapsSnapshot.docs.map(doc => [doc.id, doc.data()])
      )
      console.log(`💾 Found ${existingRecaps.size} existing week recaps`)

      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as any)).filter((user: any) => user.displayName)
      console.log(`👥 Found ${users.length} users`)

      const recapResults: Array<{ weekId: string; success: boolean; message: string; userCount?: number; recalculated?: boolean }> = []

      for (const week of allWeeks) {
        if (week.endDate > today) {
          continue
        }

        // Use getWeekKey to ensure consistent formatting with how picks are stored
        const weekKey = getWeekKey(week.weekType, week.week, week.label)
        
        const weekId = `${week.season}_${weekKey}`
        const existingRecap = existingRecaps.get(weekId)

        if (existingRecap) {
          const recapCalculatedAt = existingRecap.calculatedAt?.toDate?.() || new Date(existingRecap.calculatedAt || 0)
          const weekEnded = week.endDate < today
          
          if (weekEnded && recapCalculatedAt < week.endDate) {
            console.log(`⚠️  ${weekId} - recap calculated before week ended, will recalculate`)
          } else {
            console.log(`⏭️  Skipping ${weekId} - recap already exists and appears correct`)
            continue
          }
        }

        console.log(`🔄 Calculating recap for ${weekId}...`)

        try {
          const weekGames = await espnApi.getGamesForDateRange(week.startDate, week.endDate)
          console.log(`🎮 Found ${weekGames.length} games for ${weekId}`)

          const finishedGames = weekGames.filter(g => g.status === 'final' || g.status === 'post')
          if (finishedGames.length === 0) {
            console.log(`⏭️  Skipping ${weekId} - no finished games yet`)
            recapResults.push({ weekId, success: false, message: 'No finished games' })
            continue
          }

          const userStats = []
          for (const user of users) {
            try {
              const userPicksDoc = await getDoc(doc(db, 'users', user.id, 'picks', weekId))
              const userPicks = userPicksDoc.exists() ? userPicksDoc.data() : {}
              let correct = 0
              let gamesWithPicks = 0

              for (const game of finishedGames) {
                const gameKey = String(game.id)
                const pick = userPicks[gameKey]?.pickedTeam ?? userPicks[game.id as any]?.pickedTeam
                if (pick) gamesWithPicks++
                const homeScore = Number(game.homeScore) || 0
                const awayScore = Number(game.awayScore) || 0
                const homeWon = homeScore > awayScore
                const pickCorrect = (pick === 'home' && homeWon) || (pick === 'away' && !homeWon)
                if (pick && pickCorrect) correct++
              }

              const total = finishedGames.length
              if (total > 0 && gamesWithPicks > 0) {
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

          const maxCorrect = Math.max(...userStats.map(s => s.correct), 0)
          const winnerIds = userStats.filter(s => s.correct === maxCorrect && maxCorrect > 0).map(s => s.userId)

          const userStatsWithTopScore = userStats.map(stat => ({
            ...stat,
            isTopScore: winnerIds.includes(stat.userId)
          }))

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

          recapResults.push({
            weekId,
            success: true,
            message: wasRecalculated ? 'Recalculated and updated' : 'Calculated and saved',
            userCount: userStatsWithTopScore.length,
            recalculated: wasRecalculated
          })
        } catch (error) {
          console.error(`❌ Error calculating recap for ${weekId}:`, error)
          recapResults.push({
            weekId,
            success: false,
            message: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }

      const successCount = recapResults.filter(r => r.success).length
      const failCount = recapResults.filter(r => !r.success).length

      results.weekRecaps = {
        success: true,
        processed: recapResults.length,
        succeeded: successCount,
        failed: failCount
      }
      console.log(`✅ Week recap calculation complete: ${successCount} succeeded, ${failCount} failed`)
    } catch (error) {
      console.error('❌ Error calculating week recaps:', error)
      results.weekRecaps = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Daily tasks completed',
      dayOfWeek,
      tasksRun: {
        weeklyReminders: dayOfWeek === 1,
        weekRecaps: true
      },
      results,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    console.error('❌ Error in daily tasks cron:', error)
    return NextResponse.json(
      { 
        error: 'Failed to run daily tasks',
        details: error instanceof Error ? error.message : 'Unknown error',
        results
      },
      { status: 500 }
    )
  }
}

