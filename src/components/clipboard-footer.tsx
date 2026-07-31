'use client'

import { BuyMeCoffeeButton } from '@/components/buy-me-coffee-button'

/** Shared page footer: tagline + Buy Me a Coffee. */
export function ClipboardFooter() {
  return (
    <div className="flex flex-col lg:px-8 px-6">
      <div className="w-full flex xl:flex-row flex-col items-center justify-center xl:gap-4 gap-1 mx-auto mt-8 py-4 px-8 bg-yellow-400 shadow-md">
        <p className="text-[clamp(1rem,2.5vw+0.5rem,1.5rem)] font-bold text-balance xl:text-left text-center">
          Hey! David here. This is a passion project but there are some costs to run it. Fuel the cause!
        </p>
        <BuyMeCoffeeButton />
      </div>
      <div className="w-full mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>
    </div>
  )
}
