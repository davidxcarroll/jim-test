'use client'

import { useEffect, useRef } from 'react'

export function ClipboardBoard() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const syncWidth = () => {
      el.style.width = `${document.documentElement.clientWidth}px`
    }

    syncWidth()
    window.addEventListener('resize', syncWidth)
    return () => window.removeEventListener('resize', syncWidth)
  }, [])

  return <div ref={ref} className="clipboard-board" aria-hidden />
}
