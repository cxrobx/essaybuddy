'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, usePathname } from 'next/navigation'
import { tourSteps, type TourStep } from './tour-steps'
import { SpotlightOverlay } from './SpotlightOverlay'
import { TourTooltip } from './TourTooltip'
import { useTourElement } from '@/lib/useTourElement'
import { useTour } from '@/lib/useTour'

interface SpotlightTourProps {
  onDismiss: () => void
  onFinish: () => void
  onPermanentDismiss: () => void
}

export interface SectionGroup {
  section: string
  startIndex: number
  count: number
}

/** Wait for an element to appear in the DOM, then click it. */
function waitForElementAndClick(selector: string, timeout = 3000, signal?: AbortSignal): Promise<boolean> {
  return new Promise((resolve) => {
    if (signal?.aborted) {
      resolve(false)
      return
    }

    const el = document.querySelector(selector) as HTMLElement | null
    if (el) {
      el.click()
      resolve(true)
      return
    }

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector) as HTMLElement | null
      if (found) {
        observer.disconnect()
        found.click()
        resolve(true)
      }
    })

    observer.observe(document.body, { childList: true, subtree: true })

    const timer = setTimeout(() => {
      observer.disconnect()
      resolve(false)
    }, timeout)

    signal?.addEventListener('abort', () => {
      observer.disconnect()
      clearTimeout(timer)
      resolve(false)
    })
  })
}

export function SpotlightTour({ onDismiss, onFinish, onPermanentDismiss }: SpotlightTourProps) {
  const router = useRouter()
  const pathname = usePathname()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [mounted, setMounted] = useState(false)
  const [activeSteps, setActiveSteps] = useState<TourStep[]>([])
  const { tourEssayId } = useTour()
  const isMountedRef = useRef(true)

  useEffect(() => {
    isMountedRef.current = true
    return () => { isMountedRef.current = false }
  }, [])

  // Build active steps — filter out editor steps if no essays exist
  useEffect(() => {
    const steps = tourSteps.filter((step) => {
      // Editor steps require a tour essay
      if (step.route?.includes('{{tourEssayId}}') && !tourEssayId) return false
      // Keep route steps and non-optional steps
      if (step.route) return true
      if (step.optional && step.target) {
        return document.querySelector(step.target) !== null
      }
      return true
    })
    setActiveSteps(steps)
  }, [tourEssayId])

  const currentStep = activeSteps[currentIndex]

  // Section groups for progress display
  const sectionGroups = useMemo((): SectionGroup[] => {
    const groups: SectionGroup[] = []
    let current: SectionGroup | null = null

    activeSteps.forEach((step, i) => {
      const section = step.section || 'Tour'
      if (!current || current.section !== section) {
        current = { section, startIndex: i, count: 1 }
        groups.push(current)
      } else {
        current.count++
      }
    })

    return groups
  }, [activeSteps])

  // Resolve route template
  const resolveRoute = useCallback(
    (route: string): string => {
      return route.replace('{{tourEssayId}}', tourEssayId || '')
    },
    [tourEssayId],
  )

  // Track current step's target element
  const { rect: targetRect, status: elementStatus } = useTourElement(currentStep?.target ?? null)

  // Portal mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Auto-skip optional steps that can't find their target
  useEffect(() => {
    if (
      elementStatus === 'not-found' &&
      currentStep?.optional &&
      currentIndex < activeSteps.length - 1
    ) {
      setCurrentIndex((i) => i + 1)
    }
  }, [elementStatus, currentStep?.optional, currentIndex, activeSteps.length])

  // Route navigation — navigate if on wrong page for current step
  useEffect(() => {
    if (!currentStep?.route || !mounted || activeSteps.length === 0) return

    if (currentStep.route.includes('{{tourEssayId}}') && !tourEssayId) return

    const resolvedRoute = resolveRoute(currentStep.route)
    if (resolvedRoute.includes('{{')) return

    // Compare just the pathname portion (strip query params for comparison)
    const currentPath = pathname.replace(/\/$/, '')
    const routePath = resolvedRoute.split('?')[0].replace(/\/$/, '')

    if (currentPath !== routePath) {
      router.push(resolvedRoute)
    }
  }, [currentIndex, currentStep, mounted, activeSteps.length, resolveRoute, pathname, router, tourEssayId])

  // Handle clickBefore
  useEffect(() => {
    if (!currentStep?.clickBefore || !mounted || activeSteps.length === 0) return

    if (currentStep.route) {
      const resolvedRoute = resolveRoute(currentStep.route)
      const currentPath = pathname.replace(/\/$/, '')
      const routePath = resolvedRoute.split('?')[0].replace(/\/$/, '')
      if (currentPath !== routePath) return
    }

    const abortController = new AbortController()
    const timer = setTimeout(() => {
      if (!isMountedRef.current) return
      waitForElementAndClick(currentStep.clickBefore!, 3000, abortController.signal)
    }, currentStep.route ? 300 : 0)

    return () => {
      abortController.abort()
      clearTimeout(timer)
    }
  }, [currentIndex, currentStep, mounted, activeSteps.length, pathname, resolveRoute])

  // Navigate to step
  const goToIndex = useCallback(
    (nextIndex: number) => {
      if (nextIndex < 0 || nextIndex >= activeSteps.length) return

      const nextStep = activeSteps[nextIndex]

      // If step needs tourEssayId and we don't have it, skip to finish
      if (nextStep.route?.includes('{{tourEssayId}}') && !tourEssayId) {
        const finishIdx = activeSteps.findIndex((s) => s.id === 'finish')
        if (finishIdx !== -1) {
          setCurrentIndex(finishIdx)
        }
        return
      }

      // Navigate if needed
      if (nextStep.route) {
        const resolvedRoute = resolveRoute(nextStep.route)
        if (resolvedRoute && !resolvedRoute.includes('{{')) {
          const currentPath = pathname.replace(/\/$/, '')
          const routePath = resolvedRoute.split('?')[0].replace(/\/$/, '')
          if (currentPath !== routePath) {
            router.push(resolvedRoute)
          }
        }
      }

      setCurrentIndex(nextIndex)
    },
    [activeSteps, tourEssayId, resolveRoute, pathname, router],
  )

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowRight':
        case 'Enter':
          e.preventDefault()
          if (currentIndex < activeSteps.length - 1) {
            goToIndex(currentIndex + 1)
          } else {
            onFinish()
          }
          break
        case 'ArrowLeft':
          e.preventDefault()
          if (currentIndex > 0) {
            goToIndex(currentIndex - 1)
          }
          break
        case 'Escape':
          e.preventDefault()
          onDismiss()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, activeSteps.length, onDismiss, onFinish, goToIndex])

  const goNext = useCallback(() => {
    if (currentIndex < activeSteps.length - 1) {
      goToIndex(currentIndex + 1)
    }
  }, [currentIndex, activeSteps.length, goToIndex])

  const goBack = useCallback(() => {
    if (currentIndex > 0) {
      goToIndex(currentIndex - 1)
    }
  }, [currentIndex, goToIndex])

  // Overflow guard
  if (mounted && activeSteps.length > 0 && !currentStep) {
    queueMicrotask(onFinish)
    return null
  }

  if (!mounted || !currentStep || activeSteps.length === 0) return null

  return createPortal(
    <div className="tour-fade-in">
      <SpotlightOverlay
        rect={targetRect}
        padding={currentStep.padding}
        onClick={currentStep.target ? undefined : onDismiss}
      />
      <TourTooltip
        step={currentStep}
        rect={targetRect}
        currentIndex={currentIndex}
        totalSteps={activeSteps.length}
        sectionGroups={sectionGroups}
        onNext={goNext}
        onBack={goBack}
        onSkip={onDismiss}
        onFinish={onFinish}
        onDismiss={onDismiss}
        onPermanentDismiss={onPermanentDismiss}
      />
    </div>,
    document.body,
  )
}
