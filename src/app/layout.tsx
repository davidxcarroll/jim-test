import type { Metadata } from 'next'
import { Inter, Chakra_Petch } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const inter = Inter({ subsets: ['latin'] })
const chakraPetch = Chakra_Petch({ 
  weight: ['400', '700'],
  subsets: ['latin'],
  variable: '--font-chakra-petch'
})

export const metadata: Metadata = {
  title: 'Jim\'s Clipboard',
  description: 'Sports picks and clipboard management app',
  viewport: 'width=device-width, initial-scale=1',
  icons: {
    icon: '/images/favicon.ico',
    apple: [
      { url: '/images/icon-180x180.png', sizes: '180x180', type: 'image/png' },
      { url: '/images/icon-152x152.png', sizes: '152x152', type: 'image/png' },
    ],
  },
  manifest: '/manifest.json',
  themeColor: '#000000',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Jim\'s Clipboard',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Jim's Clipboard" />
        <meta name="theme-color" content="#000000" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap" />
      </head>
      <body className={`${inter.className} ${chakraPetch.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
} 