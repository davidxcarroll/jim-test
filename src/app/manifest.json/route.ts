import { NextRequest, NextResponse } from 'next/server'

const icons = [
  {
    src: '/images/icon-192x192.png',
    sizes: '192x192',
    type: 'image/png',
    purpose: 'any maskable',
  },
  {
    src: '/images/icon-512x512.png',
    sizes: '512x512',
    type: 'image/png',
    purpose: 'any maskable',
  },
  {
    src: '/images/icon-180x180.png',
    sizes: '180x180',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: '/images/icon-152x152.png',
    sizes: '152x152',
    type: 'image/png',
    purpose: 'any',
  },
  {
    src: '/images/icon-144x144.png',
    sizes: '144x144',
    type: 'image/png',
    purpose: 'any',
  },
]

function isMobileRequest(request: NextRequest): boolean {
  const secChUaMobile = request.headers.get('sec-ch-ua-mobile')
  if (secChUaMobile === '?1') return true
  if (secChUaMobile === '?0') return false

  const userAgent = request.headers.get('user-agent') || ''
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent)
}

export const dynamic = 'force-dynamic'

export function GET(request: NextRequest) {
  const display = isMobileRequest(request) ? 'standalone' : 'browser'

  return NextResponse.json(
    {
      name: "Jim's Clipboard",
      short_name: "Jim's Clipboard",
      description: 'Sports picks and clipboard management app',
      start_url: '/',
      display,
      background_color: '#ffffff',
      theme_color: '#000000',
      orientation: 'portrait-primary',
      icons,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=0, must-revalidate',
        Vary: 'User-Agent, Sec-CH-UA-Mobile',
        'Accept-CH': 'Sec-CH-UA-Mobile',
      },
    }
  )
}
