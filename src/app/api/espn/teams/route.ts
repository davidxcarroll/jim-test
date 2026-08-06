import { NextResponse } from 'next/server'
import { espnApi } from '@/lib/espn-api'

export async function GET() {
  try {
    const teams = await espnApi.getTeams()

    return NextResponse.json({
      success: true,
      data: teams,
      count: teams.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error fetching ESPN teams via proxy:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
