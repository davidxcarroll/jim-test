'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Navigation() {
  const pathname = usePathname()

  return (
    <div className="flex flex-row items-center justify-center py-4">
      <div className="w-full font-bold text-center uppercase">
        <Link 
          href="/pick" 
          className={`hover:text-gray-600 transition-colors ${
            pathname === '/pick' ? 'text-blue-600' : ''
          }`}
        >
          Picks
        </Link>
      </div>
      <div className="w-full text-4xl font-bold text-center uppercase">
        <Link href="/dashboard" className="hover:text-gray-600 transition-colors">
          Jim's Clipboard
        </Link>
      </div>
      <div className="w-full font-bold text-center uppercase">
        <Link 
          href="/settings" 
          className={`hover:text-gray-600 transition-colors ${
            pathname === '/settings' ? 'text-blue-600' : ''
          }`}
        >
          Settings
        </Link>
      </div>
    </div>
  )
} 