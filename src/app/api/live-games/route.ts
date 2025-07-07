import { NextResponse } from 'next/server'
import { espnApi } from '@/lib/espn-api'

export async function GET() {
  try {
    const liveGames = await espnApi.getLiveGames()
    
    return NextResponse.json({
      success: true,
      data: liveGames,
      count: liveGames.length,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching live games:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch live games',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 