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
    console.log('🏈 Starting Wednesday Phil picks generation...')

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

    // Fetch games for the current week
    const games = await espnApi.getGamesForDateRange(currentWeek.startDate, currentWeek.endDate)
    console.log(`🎮 Found ${games.length} games for current week`)

    if (games.length === 0) {
      console.log('⚠️ No games found for current week, skipping Phil picks generation')
      return NextResponse.json({
        success: true,
        message: 'No games found for current week',
        weekKey: null,
        gamesCount: 0
      })
    }

    // Generate week key
    const weekKey = `${currentWeek.season}_${currentWeek.weekType === 'preseason' ? `preseason-${currentWeek.week}` : `week-${currentWeek.week}`}`
    console.log(`🔑 Week key: ${weekKey}`)

    // Generate and store Phil's picks
    await generateAndStorePhilPicks(games, weekKey)

    console.log('✅ Successfully generated Phil picks for current week')

    return NextResponse.json({
      success: true,
      message: 'Phil picks generated successfully',
      weekKey,
      gamesCount: games.length,
      week: currentWeek.week,
      weekType: currentWeek.weekType,
      season: currentWeek.season
    })

  } catch (error) {
    console.error('❌ Error generating Phil picks:', error)
    return NextResponse.json(
      { 
        error: 'Failed to generate Phil picks',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
