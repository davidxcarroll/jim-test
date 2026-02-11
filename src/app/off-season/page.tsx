'use client'

import { useState, useEffect } from 'react'
import { collection, getDocs, query, orderBy } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getTeamByAbbreviation, getTeamLogo, getTeamBackgroundAndLogo } from '@/utils/team-utils'
import { Team } from '@/types/nfl'
import { PHIL_USER, isPhil } from '@/utils/phil-user'

const SEA_ABBREV = 'SEA'

export default function OffSeasonPage() {
  const [seahawksTeam, setSeahawksTeam] = useState<Team | null>(null)
  const [seahawksPickerNames, setSeahawksPickerNames] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const team = await getTeamByAbbreviation(SEA_ABBREV)
        if (cancelled) return
        setSeahawksTeam(team ?? null)

        const names: string[] = []
        if (isPhil(PHIL_USER.uid) && PHIL_USER.superBowlPick === SEA_ABBREV) {
          names.push(PHIL_USER.displayName)
        }
        if (db) {
          const usersSnap = await getDocs(query(collection(db, 'users'), orderBy('displayName')))
          if (cancelled) return
          usersSnap.forEach((doc) => {
            const data = doc.data()
            if (data.superBowlPick === SEA_ABBREV) {
              names.push(data.displayName || 'Unknown')
            }
          })
        }
        setSeahawksPickerNames(names)
      } catch (e) {
        if (!cancelled) setSeahawksPickerNames([])
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <div className="font-chakra pb-16 select-none">
      {/* Static navigation elements without links */}
      <div className="relative z-[60] w-[98dvw] flex flex-row items-center justify-center max-md:gap-8 leading-none xl:text-xl text-base text-white">
        <img
          src="/images/clip-305.png"
          className="
            relative z-100 -mb-8 pointer-events-none
            2xl:-mt-28 xl:-mt-14 md:-mt-10 mt-0
            2xl:w-[800px] xl:w-[700px] lg:w-[600px] md:w-[500px] sm:w-[400px] w-[300px]
          "
        />
      </div>

      <div className="flex flex-col lg:px-8 md:px-4 sm:px-2">
        <div className="flex flex-col pt-10 bg-neutral-100">
          <div className="flex flex-col gap-8 items-center justify-center flex-1 pt-8 pb-24">

            <div className="flex flex-col">
              <div className="w-full uppercase md:text-5xl text-3xl text-center font-bold text-balance">
                2025 🏆 Winner
              </div>
              <div className="w-full max-w-6xl font-jim text-center text-6xl md:text-7xl lg:text-8xl xl:text-9xl leading-none text-balance">
                Jimbo!
              </div>
            </div>

            <hr className="w-full my-4 border-t-2 border-black/10" />

            <div className="w-full flex flex-col items-center justify-center uppercase md:text-xl text-center font-bold text-balance">
              {seahawksTeam && (() => {
                const style = getTeamBackgroundAndLogo(seahawksTeam)
                const logoUrl = getTeamLogo(seahawksTeam, style.logoType)
                return logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Seattle Seahawks"
                    className="w-20 md:w-32 aspect-video object-cover"
                  />
                ) : null
              })()}
              <div className="">
                {loading ? (
                  <span className="text-neutral-500">Loading…</span>
                ) : seahawksPickerNames.length === 0 ? (
                  <span className="text-neutral-500">Nobody picked Seattle.</span>
                ) : (
                  <span>
                    {seahawksPickerNames.length <= 1
                      ? seahawksPickerNames[0]
                      : seahawksPickerNames.length === 2
                        ? `${seahawksPickerNames[0]} and ${seahawksPickerNames[1]}`
                        : `${seahawksPickerNames.slice(0, -1).join(', ')}, and ${seahawksPickerNames[seahawksPickerNames.length - 1]}`}
                  </span>
                )}
              </div>
              <div>Picked the Seahawks to win the Super Bowl!</div>
            </div>

            <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
              📊 <a href="/stats" className="underline">More stats</a> 📊
            </div>
            <div className="w-full uppercase md:text-xl text-center font-bold text-balance">
              Thanks for playing, see y'all next season 📋🏈✅
            </div>

          </div>
        </div>
      </div>

      <div className="w-[98dvw] mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>
    </div>
  )
}
