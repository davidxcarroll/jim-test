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
    // #region agent log
    fetch('http://127.0.0.1:7685/ingest/8b75b7ca-3404-4cc9-850e-b28c6853e057',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46315a'},body:JSON.stringify({sessionId:'46315a',runId:'post-fix',hypothesisId:'A',location:'api/espn/teams/route.ts:GET',message:'Proxy route returning teams payload',data:{count:payload.count,timestamp:payload.timestamp,isServer:typeof window==='undefined'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
    // #region agent log
    fetch('http://127.0.0.1:7685/ingest/8b75b7ca-3404-4cc9-850e-b28c6853e057',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'46315a'},body:JSON.stringify({sessionId:'46315a',runId:'post-fix',hypothesisId:'B',location:'api/espn/teams/route.ts:catch',message:'Proxy route threw',data:{error:error instanceof Error?error.message:String(error)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
