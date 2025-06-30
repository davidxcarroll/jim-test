'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

export function Navigation() {
  const pathname = usePathname()

  return (
    <div className="relative flex flex-row items-center justify-center max-md:gap-8 leading-none max-xl:text-base text-white">
      <Link
        href="/dashboard"
        className="group w-full h-full py-4 max-md:mb-2 font-bold text-center uppercase"
        >
        <span className={`px-2 bg-black whitespace-nowrap ${pathname === '/dashboard' ? 'underline' : ''}`}>The Picks</span>
      </Link>
      <img src="/images/clip-305.png" className="relative max-md:absolute max-md:top-1/2 max-md:left-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2 z-100 xl:-mt-14 md:-mt-10 -mb-8 xl:w-[600px] xl:h-[200px] md:w-[450px] md:h-[150px] w-[300px] h-[100px] pointer-events-none" />
      <Link
        href="/settings"
        className="group w-full h-full py-4 max-md:mb-2 font-bold text-center uppercase"
      >
        <span className={`px-2 bg-black ${pathname === '/settings' ? 'underline' : ''}`}>Settings</span>
      </Link>
    </div>
  )
} 