'use client'

import { BuyMeCoffeeButton } from '@/components/buy-me-coffee-button'

/** Shared page footer: tagline + Buy Me a Coffee. */
export function ClipboardFooter() {
  return (
    <div className="flex-1 flex flex-col justify-end lg:px-8 px-6 lg:pb-8 pb-6">
      <div className="w-full mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase mix-blend-soft-light">
        Long Live The Clipboard
      </div>
      <div className="relative w-full flex xl:flex-row flex-col items-center justify-center gap-x-4 gap-y-3 mx-auto mt-8 py-4 px-8 bg-orange-500 mix-blend-darken">
        <p className="font-bold xl:text-base text-sm text-balance xl:text-left text-center leading-none">
          Hey! David here. This app is a labor of love. There are some costs to run it.
        </p>
        <BuyMeCoffeeButton />
      </div>
    </div>
  )
}
