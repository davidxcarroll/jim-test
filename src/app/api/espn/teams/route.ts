import { NextResponse } from 'next/server'
import { espnApi } from '@/lib/espn-api'

// Must not be statically cached — an empty ESPN failure at build/first request
// was being served forever in prod (count:0 with a frozen timestamp).
export const dynamic = 'force-dynamic'
export const revalidate = 0

export async function GET() {
  try {
    const teams = await espnApi.getTeams()
    const payload = {
      success: true as const,
      data: teams,
      count: teams.length,
      timestamp: new Date().toISOString(),
    }

    if (teams.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No teams returned from ESPN',
          data: [],
          count: 0,
          timestamp: payload.timestamp,
        },
        {
          status: 503,
          headers: { 'Cache-Control': 'no-store, must-revalidate' },
        }
      )
    }

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'no-store, must-revalidate' },
    })
  } catch (error) {
    console.error('Error fetching ESPN teams via proxy:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch teams',
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: { 'Cache-Control': 'no-store, must-revalidate' },
      }
    )
  }
}
