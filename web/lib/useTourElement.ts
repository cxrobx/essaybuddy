'use client'

import { useState, useEffect, useCallback, useRef } from 'react'

export type TourElementStatus = 'searching' | 'found' | 'not-found'

export interface TourElementResult {
  rect: DOMRect | null
  status: TourElementStatus
}

/** Timeout (ms) before giving up on finding the element */
const SEARCH_TIMEOUT = 5000

/**
 * Tracks a DOM element's bounding rect, updating on resize/scroll.
 * Uses MutationObserver to detect elements that appear after navigation.
 * Returns `{ rect, status }` where status indicates search progress.
 */
export function useTourElement(selector: string | null): TourElementResult {
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [status, setStatus] = useState<TourElementStatus>('searching')
  const elementRef = useRef<Element | null>(null)

  const measure = useCallback(() => {
    if (!elementRef.current) return
    setRect(elementRef.current.getBoundingClientRect())
  }, [])

  useEffect(() => {
    if (!selector) {
      setRect(null)
      setStatus('found') // null target = centered card, always "found"
      elementRef.current = null
      return
    }

    // Reset state for new selector
    setRect(null)
    setStatus('searching')
    elementRef.current = null

    let rafId: number | undefined
    let scrollTimer: ReturnType<typeof setTimeout> | undefined
    let ro: ResizeObserver | undefined
    let observer: MutationObserver | undefined
    let searchTimer: ReturnType<typeof setTimeout> | undefined

    const setupTracking = (el: Element) => {
      elementRef.current = el
      setStatus('found')

      rafId = requestAnimationFrame(() => {
        setRect(el.getBoundingClientRect())
      })

      el.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
      scrollTimer = setTimeout(() => {
        setRect(el.getBoundingClientRect())
      }, 250)

      ro = new ResizeObserver(() => {
        setRect(el.getBoundingClientRect())
      })
      ro.observe(el)

      window.addEventListener('resize', measure)
      window.addEventListener('scroll', measure, true)
    }

    const el = document.querySelector(selector)
    if (el) {
      setupTracking(el)
    } else {
      observer = new MutationObserver(() => {
        const found = document.querySelector(selector)
        if (found) {
          observer?.disconnect()
          setupTracking(found)
        }
      })

      observer.observe(document.body, { childList: true, subtree: true })

      searchTimer = setTimeout(() => {
        observer?.disconnect()
        if (!elementRef.current) {
          setStatus('not-found')
        }
      }, SEARCH_TIMEOUT)
    }

    return () => {
      observer?.disconnect()
      if (searchTimer) clearTimeout(searchTimer)
      if (rafId !== undefined) cancelAnimationFrame(rafId)
      if (scrollTimer) clearTimeout(scrollTimer)
      if (ro) ro.disconnect()
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [selector, measure])

  return { rect, status }
}
