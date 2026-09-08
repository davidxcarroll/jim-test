'use client'

import { useCallback, useLayoutEffect, useRef } from 'react'

const DURATION_MS = 250

export function useReorderAnimation(itemIds: string[]) {
  const nodesRef = useRef(new Map<string, HTMLElement>())
  const prevTopsRef = useRef(new Map<string, number>())
  const idsKey = itemIds.join('\0')

  const setItemRef = useCallback((id: string) => (node: HTMLElement | null) => {
    if (node) {
      nodesRef.current.set(id, node)
    } else {
      nodesRef.current.delete(id)
    }
  }, [])

  useLayoutEffect(() => {
    const nodes = nodesRef.current
    const prevTops = prevTopsRef.current
    const nextTops = new Map<string, number>()

    nodes.forEach((node, id) => {
      node.style.transition = 'none'
      node.style.transform = ''
      node.style.zIndex = ''
      node.style.position = ''
      nextTops.set(id, node.getBoundingClientRect().top)
    })

    const prefersReducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (!prefersReducedMotion && prevTops.size > 0) {
      const movingNodes: HTMLElement[] = []

      nodes.forEach((node, id) => {
        const prevTop = prevTops.get(id)
        const nextTop = nextTops.get(id)
        if (prevTop == null || nextTop == null) return
        const delta = prevTop - nextTop
        if (Math.abs(delta) < 0.5) return
        node.style.transform = `translateY(${delta}px)`
        node.style.position = 'relative'
        node.style.zIndex = delta > 0 ? '2' : '1'
        movingNodes.push(node)
      })

      // Adjacent swaps move two rows. Skip animation when the whole list reshuffles (e.g. settings load).
      if (movingNodes.length > 0 && movingNodes.length <= 2) {
        nodes.forEach((node) => {
          void node.offsetHeight
        })

        const rafId = requestAnimationFrame(() => {
          movingNodes.forEach((node) => {
            node.style.transition = `transform ${DURATION_MS}ms ease`
            node.style.transform = ''
            const onEnd = (event: TransitionEvent) => {
              if (event.propertyName !== 'transform') return
              node.style.zIndex = ''
              node.style.position = ''
              node.removeEventListener('transitionend', onEnd)
            }
            node.addEventListener('transitionend', onEnd)
          })
        })

        prevTopsRef.current = nextTops
        return () => {
          cancelAnimationFrame(rafId)
        }
      }

      movingNodes.forEach((node) => {
        node.style.transform = ''
        node.style.zIndex = ''
        node.style.position = ''
      })
    }

    prevTopsRef.current = nextTops
  }, [idsKey])

  return setItemRef
}
