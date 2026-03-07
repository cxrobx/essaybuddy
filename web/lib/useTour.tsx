'use client'

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from 'react'
import { listEssays } from '@/lib/api'

const DISMISS_KEY = 'zora-tour-dismissed'
const ESSAY_KEY = 'zora-tour-essay-id'

interface TourContextValue {
  showTour: boolean
  startTour: () => void
  dismissTour: () => void
  permanentlyDismiss: () => void
  tourEssayId: string | null
}

const TourContext = createContext<TourContextValue | undefined>(undefined)

export function TourProvider({ children }: { children: ReactNode }) {
  const [showTour, setShowTour] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [tourEssayId, setTourEssayId] = useState<string | null>(null)

  // Auto-show on first visit (no auth gating)
  useEffect(() => {
    const dismissed = localStorage.getItem(DISMISS_KEY)
    if (!dismissed) {
      setShowTour(true)
    }
    // Recover essay ID from sessionStorage (survives page transitions)
    const storedEssay = sessionStorage.getItem(ESSAY_KEY)
    if (storedEssay) setTourEssayId(storedEssay)
    setInitialized(true)
  }, [])

  // Fetch most recent essay for tour navigation
  useEffect(() => {
    if (tourEssayId) return // already have one
    listEssays()
      .then((essays) => {
        if (essays.length > 0) {
          setTourEssayId(essays[0].id)
          sessionStorage.setItem(ESSAY_KEY, essays[0].id)
        }
      })
      .catch(() => {}) // no essays or API down — editor steps will be skipped
  }, [tourEssayId])

  const startTour = useCallback(() => {
    setShowTour(true)
  }, [])

  const dismissTour = useCallback(() => {
    setShowTour(false)
  }, [])

  const permanentlyDismiss = useCallback(() => {
    setShowTour(false)
    localStorage.setItem(DISMISS_KEY, 'true')
  }, [])

  const value = useMemo<TourContextValue>(() => ({
    showTour: initialized ? showTour : false,
    startTour,
    dismissTour,
    permanentlyDismiss,
    tourEssayId: initialized ? tourEssayId : null,
  }), [initialized, showTour, startTour, dismissTour, permanentlyDismiss, tourEssayId])

  return (
    <TourContext.Provider value={value}>
      {children}
    </TourContext.Provider>
  )
}

export function useTour() {
  const context = useContext(TourContext)
  if (!context) {
    throw new Error('useTour must be used within a TourProvider')
  }
  return context
}
