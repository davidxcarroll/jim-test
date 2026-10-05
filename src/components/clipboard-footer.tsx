'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { BuyMeCoffeeButton } from '@/components/buy-me-coffee-button'

function CoffeeRow() {
  return (
    <div className="flex w-full flex-col items-center justify-center gap-x-4 gap-y-3 bg-black px-8 py-8 text-neutral-400 xl:flex-row">
      <p className="text-balance text-center text-sm font-bold leading-none xl:text-left xl:text-base">
        Hey! David here. <a
          href="https://www.youtube.com/watch?v=UfPloyCQeS0&t=289s"
          target="_blank"
          rel="noopener noreferrer"
          className="underline underline-offset-4 decoration-1"
        >This app is a labor of love</a>. Enjoy!
      </p>
      <BuyMeCoffeeButton />
    </div>
  )
}

/** Shared page footer: tagline on the clipboard, coffee row below it. */
export function ClipboardFooter() {
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    setSlot(document.getElementById('below-clipboard'))
  }, [])

  return (
    <>
      <div className="sticky left-0 self-start w-[98dvw] flex-1 flex flex-col justify-end lg:px-8 px-6 lg:pb-8 pb-6">
        <div className="w-full mt-12 mb-4 2xl:text-8xl xl:text-7xl lg:text-6xl md:text-5xl sm:text-4xl text-3xl leading-none text-center font-bold text-black uppercase">
          Long Live The Clipboard
        </div>
      </div>
      {slot ? createPortal(<CoffeeRow />, slot) : null}
    </>
  )
}
