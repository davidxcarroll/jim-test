'use client'

import { useEffect, useRef } from 'react'

export function ClipboardBoard() {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const syncWidth = () => {
      const width = `${document.documentElement.clientWidth}px`
      el.style.width = width
      const below = document.getElementById('below-clipboard')
      if (below) below.style.width = width
    }

    syncWidth()
    window.addEventListener('resize', syncWidth)
    const ro = new ResizeObserver(syncWidth)
    ro.observe(document.documentElement)
    const content = el.parentElement?.querySelector('.clipboard-content')
    if (content) ro.observe(content)
    return () => {
      window.removeEventListener('resize', syncWidth)
      ro.disconnect()
    }
  }, [])

  return <div ref={ref} className="clipboard-board" aria-hidden />
}
