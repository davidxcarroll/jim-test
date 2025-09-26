import { NextRequest, NextResponse } from 'next/server'
import { generateAndStorePhilPicks } from '@/utils/phil-user'
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
    console.log('🏈 Starting Wednesday Phil picks generation (Two-Pass System)...')

    // Get current NFL week from ESPN API
    const currentWeek = await getCurrentNFLWeekFromAPI()
    if (!currentWeek) {
      console.error('❌ Could not get current NFL week from ESPN API')
      return NextResponse.json(
        { error: 'Could not get current NFL week from ESPN API' },
        { status: 500 }
      )
    }

    console.log(`📅 Current week: ${currentWeek.week} (${currentWeek.weekType})`)
    console.log(`📅 Week range: ${currentWeek.startDate.toISOString()} to ${currentWeek.endDate.toISOString()}`)

    // Calculate previous week for Pass 2
    const previousWeek = {
      week: currentWeek.week - 1,
      season: currentWeek.season,
      weekType: currentWeek.weekType,
      startDate: new Date(currentWeek.startDate.getTime() - (7 * 24 * 60 * 60 * 1000)),
      endDate: new Date(currentWeek.endDate.getTime() - (7 * 24 * 60 * 60 * 1000))
    }

    console.log(`📅 Previous week: ${previousWeek.week} (${previousWeek.weekType})`)
    console.log(`📅 Previous week range: ${previousWeek.startDate.toISOString()} to ${previousWeek.endDate.toISOString()}`)

    const results = {
      pass1: { success: false, weekKey: null as string | null, gamesCount: 0 },
      pass2: { success: false, weekKey: null as string | null, gamesCount: 0 }
    }

    // PASS 1: Generate picks for current week (new picks)
    console.log('🔄 PASS 1: Generating picks for current week...')
    try {
      const currentGames = await espnApi.getGamesForDateRange(currentWeek.startDate, currentWeek.endDate)
      console.log(`🎮 Found ${currentGames.length} games for current week`)

      if (currentGames.length > 0) {
        const currentWeekKey = `${currentWeek.season}_${currentWeek.weekType === 'preseason' ? `preseason-${currentWeek.week}` : `week-${currentWeek.week}`}`
        console.log(`🔑 Current week key: ${currentWeekKey}`)

        await generateAndStorePhilPicks(currentGames, currentWeekKey)
        results.pass1 = { success: true, weekKey: currentWeekKey, gamesCount: currentGames.length }
        console.log('✅ PASS 1: Successfully generated Phil picks for current week')
      } else {
        console.log('⚠️ PASS 1: No games found for current week, skipping')
      }
    } catch (error) {
      console.error('❌ PASS 1: Error generating picks for current week:', error)
    }

    // PASS 2: Regenerate picks for previous week (update existing picks)
    console.log('🔄 PASS 2: Regenerating picks for previous week...')
    try {
      const previousGames = await espnApi.getGamesForDateRange(previousWeek.startDate, previousWeek.endDate)
      console.log(`🎮 Found ${previousGames.length} games for previous week`)

      if (previousGames.length > 0) {
        const previousWeekKey = `${previousWeek.season}_${previousWeek.weekType === 'preseason' ? `preseason-${previousWeek.week}` : `week-${previousWeek.week}`}`
        console.log(`🔑 Previous week key: ${previousWeekKey}`)

        await generateAndStorePhilPicks(previousGames, previousWeekKey)
        results.pass2 = { success: true, weekKey: previousWeekKey, gamesCount: previousGames.length }
        console.log('✅ PASS 2: Successfully regenerated Phil picks for previous week')
      } else {
        console.log('⚠️ PASS 2: No games found for previous week, skipping')
      }
    } catch (error) {
      console.error('❌ PASS 2: Error regenerating picks for previous week:', error)
    }

    // Determine overall success
    const overallSuccess = results.pass1.success || results.pass2.success
    const message = overallSuccess 
      ? `Phil picks generation completed. Pass 1: ${results.pass1.success ? 'Success' : 'Failed'}, Pass 2: ${results.pass2.success ? 'Success' : 'Failed'}`
      : 'Both passes failed'

    console.log(`🏈 Two-Pass System Complete: ${message}`)

    return NextResponse.json({
      success: overallSuccess,
      message,
      pass1: results.pass1,
      pass2: results.pass2,
      currentWeek: {
        week: currentWeek.week,
        weekType: currentWeek.weekType,
        season: currentWeek.season
      }
    })

  } catch (error) {
    console.error('❌ Error in two-pass Phil picks generation:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate Phil picks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
