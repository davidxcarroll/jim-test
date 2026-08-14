'use client'

import { BuyMeCoffeeButton } from '@/components/buy-me-coffee-button'

/** Shared page footer: tagline + Buy Me a Coffee. */
export function ClipboardFooter() {
  return (
    <div className="sticky left-0 self-start w-[98dvw] flex-1 flex flex-col justify-end lg:px-8 px-6 lg:pb-8 pb-6">
      <div className="w-full mt-8 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase">
        Long Live The Clipboard
      </div>
      <div className="relative w-fit flex xl:flex-row flex-col items-center justify-center gap-x-4 gap-y-3 mx-auto mt-8 py-4 px-8">
        <p className="relative z-10 font-bold xl:text-base text-sm text-balance xl:text-left text-center leading-none">
          Hey! David here. <a
            href="https://www.youtube.com/watch?v=UfPloyCQeS0&t=289s"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >This app is a labor of love</a>. There are some costs to run it.
        </p>
        <div className="relative z-10">
          <BuyMeCoffeeButton />
        </div>
        <div className="absolute inset-0 z-0 bg-olive-400"/>
      </div>
    </div>
  )
}
