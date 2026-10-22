'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useUserData } from '@/hooks/use-nfl-data'

export function Navigation({ onToggleMatchups }: { onToggleMatchups?: () => void }) {
  const pathname = usePathname()
  const { userData, loading, refresh } = useUserData()

  // Expose refresh function globally so other components can trigger updates
  if (typeof window !== 'undefined') {
    (window as any).refreshUserData = refresh
  }

  return (
    <div className="sticky left-0 self-start shrink-0 z-[60] w-[98dvw] flex flex-row items-center justify-center max-md:gap-20 leading-none xl:text-xl text-base text-white">

      <Link
        href="/dashboard"
        className="group w-full h-full flex items-center justify-center py-4 max-md:mb-2 font-bold text-center uppercase"
      >
        <span className={`px-2 py-1 bg-black whitespace-nowrap ${pathname === '/dashboard' ? 'underline' : ''}`}>The Picks</span>
      </Link>

      <div
        className="
        relative z-100 shrink-0 -mb-8 pointer-events-none
        max-md:absolute max-md:top-1/2 max-md:left-1/2 max-md:-translate-x-1/2 max-md:-translate-y-1/2
        2xl:-mt-28 xl:-mt-14 md:-mt-10 mt-0
        2xl:w-[800px] xl:w-[700px] lg:w-[600px] md:w-[500px] sm:w-[400px] w-[300px]
      ">
        {onToggleMatchups && (
          <button
            type="button"
            aria-label="Toggle all matchups"
            onClick={onToggleMatchups}
            className="absolute z-10 lg:bottom-[20%] md:bottom-[15%] bottom-[15%] left-1/2 -translate-x-1/2 lg:w-12 md:w-10 sm:w-8 w-6 lg:h-12 md:h-10 sm:h-8 h-6 flex items-center justify-center leading-none text-white bg-black lg:text-5xl md:text-4xl sm:text-3xl text-2xl whitespace-nowrap emoji rounded-full pointer-events-auto border-0 p-0"
          >
            🏈
          </button>
        )}
        <img
          src="/images/clip-305.png"
          alt=""
          className="block w-full h-auto pointer-events-none"
        />
      </div>

      <Link
        href="/settings"
        className="group w-full h-full flex items-center justify-center py-4 max-md:mb-2 font-bold text-center uppercase"
      >
        <span className={`px-2 py-1 bg-black ${pathname === '/settings' ? 'underline' : ''}`}>
          Settings
        </span>
      </Link>

    </div>
  )
} 