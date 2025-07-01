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
  title: '🏈 The Picks Test',
  viewport: 'width=device-width, initial-scale=1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Chakra+Petch:wght@400;700&display=swap" rel="stylesheet" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Sharp:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
      </head>
      <body className={`${inter.className} ${chakraPetch.variable}`}>
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
} 