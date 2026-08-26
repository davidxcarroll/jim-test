import { NextRequest, NextResponse } from 'next/server'
import { emailService } from '@/lib/emails'
import { collection, query, where, getDocs, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { addDays } from 'date-fns'
import {
  dateHelpers,
  formatPacificLongDate,
  getFirstRegularSeasonWeek,
  getFirstWednesdayOnOrAfterPacific,
  getPickableWeek,
  getRoundDisplayName,
  getWeekKey,
} from '@/utils/date-helpers'
import { espnApi } from '@/lib/espn-api'
import { assertCronAuthorized } from '@/lib/api-auth'
import { resolveRecapSeasonContext } from '@/utils/recap-season'

export async function GET(request: NextRequest) {
  return POST(request)
}

export async function POST(request: NextRequest) {
  const authError = assertCronAuthorized(request)
  if (authError) return authError

  const results: {
    weeklyReminders?: {
      success: boolean
      sentTo?: number
      failed?: number
      skippedNoEmail?: number
      template?: string
      weekLabel?: string
      error?: string
    }
    weekRecaps?: { success: boolean; processed?: number; succeeded?: number; failed?: number; error?: string }
  } = {}

  const today = new Date()
  const dayOfWeek = today.getDay() // 0 = Sunday, 1 = Monday, etc.

  try {
    if (!db) {
      return NextResponse.json(
        { error: 'Firebase not initialized' },
        { status: 500 }
      )
    }

    // TASK 1: Weekly emails on Wednesday Pacific (preseason ready vs make-your-picks)
    let sentWeeklyReminders = false
    try {
      console.log('📧 Checking weekly reminders task...')
      const seasonCtx = await resolveRecapSeasonContext()
      const currentWeek = seasonCtx?.currentWeek
      const isWednesdayPacific = dateHelpers.isNewWeekDay(today)

      if (!seasonCtx || seasonCtx.offSeason || !currentWeek) {
        console.log('📧 Skipping weekly reminders — off-season or no current week')
        results.weeklyReminders = { success: true, sentTo: 0 }
      } else if (!isWednesdayPacific) {
        console.log('📧 Skipping weekly reminders — not Wednesday in Pacific')
        results.weeklyReminders = { success: true, sentTo: 0 }
      } else {
        const allWeeks = await espnApi.getAllAvailableWeeks(currentWeek.season)
        const pickableWeek = getPickableWeek(today, currentWeek, allWeeks)
        const weekLabel = getRoundDisplayName(
          pickableWeek.label,
          pickableWeek.weekType,
          pickableWeek.week
        )
        const template = pickableWeek.weekType === 'preseason' ? 'preseason-ready' : 'weekly-reminder'
        console.log(
          `📧 Wednesday send: template=${template} pickable=${weekLabel} (${pickableWeek.weekType} ${pickableWeek.week})`
        )

        const usersRef = collection(db, 'users')
        const q = query(usersRef, where('emailNotifications', '==', true))
        const querySnapshot = await getDocs(q)

        const recipients: Array<{ email: string; displayName?: string }> = []
        const skippedNoEmail: string[] = []
        for (const userDoc of querySnapshot.docs) {
          const userData = userDoc.data()
          if (typeof userData.email !== 'string' || !userData.email) {
            skippedNoEmail.push(userDoc.id)
            console.warn('Skipping user without email:', userDoc.id)
            continue
          }
          recipients.push({
            email: userData.email,
            displayName:
              typeof userData.displayName === 'string' ? userData.displayName : undefined,
          })
        }

        console.log(
          `📧 Opted-in=${querySnapshot.size} recipients=${recipients.length} skipped-no-email=${skippedNoEmail.length}`,
          skippedNoEmail.length ? skippedNoEmail : ''
        )

        sentWeeklyReminders = true
        let sent = 0
        let failed = 0
        if (template === 'preseason-ready') {
          const firstRegular = getFirstRegularSeasonWeek(allWeeks)
          const kickoff = firstRegular
            ? getFirstWednesdayOnOrAfterPacific(firstRegular.startDate)
            : undefined
          const reminderStart = kickoff ? addDays(kickoff, -7) : undefined
          const dates = {
            kickoffDate: kickoff ? formatPacificLongDate(kickoff) : 'Wednesday, September 9',
            reminderDate: reminderStart
              ? formatPacificLongDate(reminderStart)
              : 'Wednesday, September 2',
          }
          ;({ sent, failed } = await emailService.sendPreseasonReadyBatch(recipients, dates))
        } else {
          ;({ sent, failed } = await emailService.sendWeeklyRemindersBatch(recipients, weekLabel))
        }

        results.weeklyReminders = {
          success: true,
          sentTo: sent,
          failed,
          skippedNoEmail: skippedNoEmail.length,
          template,
          weekLabel,
        }
        console.log(
          `✅ Weekly emails sent to ${sent} users (${template}, ${weekLabel}), ${failed} failed, ${skippedNoEmail.length} skipped-no-email`
        )
      }
    } catch (error) {
      console.error('❌ Error sending weekly reminder emails:', error)
      results.weeklyReminders = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }
    }

    // TASK 2: Calculate Week Recaps (runs daily; continues in off-season for last season)
    try {
      console.log('📊 Running week recap calculation task...')
      const seasonCtx = await resolveRecapSeasonContext()
      if (!seasonCtx) {
        throw new Error('Could not resolve NFL season for week recaps')
      }

      const season = seasonCtx.season
      console.log(
        `📅 Recap season: ${season}${seasonCtx.offSeason ? ' (off-season finalize)' : ''}`
      )

      const allWeeks = await espnApi.getAllAvailableWeeks(season)
      console.log(`📅 Found ${allWeeks.length} weeks for season ${season}`)

      const weekRecapsSnapshot = await getDocs(collection(db, 'weekRecaps'))
      const existingRecaps = new Map(
        weekRecapsSnapshot.docs.map((docSnap) => [docSnap.id, docSnap.data()])
      )
      console.log(`💾 Found ${existingRecaps.size} existing week recaps`)

      const usersSnapshot = await getDocs(collection(db, 'users'))
      const users = usersSnapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      } as any)).filter((user: any) => user.displayName)
      console.log(`👥 Found ${users.length} users`)

      const recapResults: Array<{ weekId: string; success: boolean; message: string; userCount?: number; recalculated?: boolean }> = []

      for (const week of allWeeks) {
        if (week.endDate > today) {
          continue
        }

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
        weeklyReminders: sentWeeklyReminders,
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
