'use client'

import { useRef, useState, useEffect } from 'react'
import type { TourStep } from './tour-steps'
import type { SectionGroup } from './SpotlightTour'

interface TourTooltipProps {
  step: TourStep
  rect: DOMRect | null
  currentIndex: number
  totalSteps: number
  sectionGroups: SectionGroup[]
  onNext: () => void
  onBack: () => void
  onSkip: () => void
  onFinish: () => void
  onDismiss: () => void
  onPermanentDismiss: () => void
}

const MARGIN = 12
const GAP = 14
const TOOLTIP_MAX_W = 340

type Placement = 'top' | 'bottom' | 'left' | 'right' | 'center'

export function TourTooltip({
  step,
  rect,
  currentIndex,
  totalSteps,
  sectionGroups,
  onNext,
  onBack,
  onSkip,
  onFinish,
  onDismiss,
  onPermanentDismiss,
}: TourTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [tooltipSize, setTooltipSize] = useState({ w: 0, h: 0 })
  const [isMobile, setIsMobile] = useState(false)
  const [contentKey, setContentKey] = useState(step.id)

  // Measure tooltip size
  useEffect(() => {
    if (!tooltipRef.current) return
    const ro = new ResizeObserver(([entry]) => {
      setTooltipSize({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    ro.observe(tooltipRef.current)
    return () => ro.disconnect()
  }, [])

  // Track mobile breakpoint
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Trigger crossfade on step change
  useEffect(() => {
    setContentKey(step.id)
  }, [step.id])

  const isLast = currentIndex === totalSteps - 1

  // Calculate position
  const pos = getPosition(step.placement, rect, tooltipSize, step.padding ?? 8, isMobile)

  // Section info
  const currentGroup = sectionGroups.find(
    (g) => currentIndex >= g.startIndex && currentIndex < g.startIndex + g.count,
  )
  const sectionLabel = currentGroup?.section || step.section || ''
  const sectionStepIndex = currentGroup ? currentIndex - currentGroup.startIndex + 1 : currentIndex + 1
  const sectionStepCount = currentGroup?.count || totalSteps

  return (
    <div
      ref={tooltipRef}
      className="fixed z-[71] pointer-events-auto"
      style={{
        left: pos.left,
        top: pos.top,
        width: pos.placement === 'center' || isMobile ? `min(${TOOLTIP_MAX_W}px, calc(100vw - ${MARGIN * 2}px))` : undefined,
        maxWidth: TOOLTIP_MAX_W,
      }}
    >
      {/* Arrow */}
      {rect && !isMobile && pos.placement !== 'center' && (
        <Arrow placement={pos.placement} rect={rect} tooltipLeft={pos.left} tooltipTop={pos.top} />
      )}

      <div className="relative bg-macos-surface/95 backdrop-blur-lg border border-macos-border rounded-xl shadow-lg overflow-hidden tour-fade-in"
        style={{ borderTop: '1px solid rgb(var(--macos-accent) / 0.30)' }}
      >
        {/* X close button */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 z-10 p-0.5 text-macos-text-secondary hover:text-macos-text transition-colors text-xs"
          aria-label="Close tour"
        >
          &times;
        </button>

        {/* Content with crossfade */}
        <div key={contentKey} className="px-5 pt-5 pb-4 tour-crossfade">
          <h3 className="text-sm font-semibold text-macos-text mb-1.5">{step.title}</h3>
          <p className="text-xs text-macos-text-secondary leading-relaxed">{step.description}</p>
        </div>

        {/* Footer */}
        <div className="px-5 pb-4 flex items-center justify-between gap-3">
          {/* Section progress */}
          <div className="flex flex-col gap-1.5 min-w-0">
            <span className="text-[9px] font-medium text-macos-text-secondary/60 uppercase tracking-wider whitespace-nowrap">
              {sectionLabel} &mdash; {currentIndex + 1} of {totalSteps}
            </span>
            {/* Section-grouped dots */}
            <div className="flex items-center gap-0.5">
              {sectionGroups.map((group, gi) => (
                <div key={group.section} className="flex items-center gap-0.5">
                  {gi > 0 && <div className="w-1.5" />}
                  {Array.from({ length: group.count }).map((_, si) => {
                    const stepIndex = group.startIndex + si
                    return (
                      <div
                        key={stepIndex}
                        className={`rounded-full transition-all duration-300 ${
                          stepIndex === currentIndex
                            ? 'w-3 h-[3px] bg-macos-accent/60'
                            : stepIndex < currentIndex
                              ? 'w-1.5 h-[3px] bg-macos-accent/30'
                              : 'w-1.5 h-[3px] bg-macos-border/60'
                        }`}
                      />
                    )
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            {currentIndex > 0 && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-[11px] font-medium text-macos-text-secondary bg-macos-elevated rounded-lg hover:bg-macos-border/50 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={isLast ? onFinish : onNext}
              className="px-4 py-1.5 text-[11px] font-semibold text-white bg-macos-accent rounded-lg hover:bg-macos-accent-hover transition-colors"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>

        {/* Don't show again */}
        {!isLast && (
          <div className="px-5 pb-3 text-center">
            <button
              onClick={onPermanentDismiss}
              className="text-[10px] text-macos-text-secondary/50 hover:text-macos-text-secondary transition-colors"
            >
              Don&apos;t show again
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/* --- Positioning Logic --- */

function getPosition(
  preferred: Placement,
  rect: DOMRect | null,
  tooltip: { w: number; h: number },
  padding: number,
  isMobile: boolean,
): { left: number; top: number; placement: Placement } {
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1024
  const vh = typeof window !== 'undefined' ? window.innerHeight : 768

  if (!rect || preferred === 'center') {
    return {
      left: Math.max(MARGIN, (vw - Math.min(TOOLTIP_MAX_W, vw - MARGIN * 2)) / 2),
      top: Math.max(MARGIN, (vh - tooltip.h) / 2),
      placement: 'center',
    }
  }

  if (isMobile) {
    const top = rect.bottom + padding + GAP
    return {
      left: MARGIN,
      top: Math.min(top, vh - tooltip.h - MARGIN),
      placement: 'bottom',
    }
  }

  const placements: Placement[] = [preferred, ...(['bottom', 'top', 'right', 'left'] as Placement[]).filter(p => p !== preferred)]

  for (const p of placements) {
    const pos = calcPlacement(p, rect, tooltip, padding)
    if (fitsViewport(pos, tooltip, vw, vh)) {
      return { ...clamp(pos, tooltip, vw, vh), placement: p }
    }
  }

  const fallback = calcPlacement(preferred, rect, tooltip, padding)
  return { ...clamp(fallback, tooltip, vw, vh), placement: preferred }
}

function calcPlacement(
  placement: Placement,
  rect: DOMRect,
  tooltip: { w: number; h: number },
  padding: number,
): { left: number; top: number } {
  switch (placement) {
    case 'bottom':
      return {
        left: rect.left + rect.width / 2 - tooltip.w / 2,
        top: rect.bottom + padding + GAP,
      }
    case 'top':
      return {
        left: rect.left + rect.width / 2 - tooltip.w / 2,
        top: rect.top - padding - GAP - tooltip.h,
      }
    case 'right':
      return {
        left: rect.right + padding + GAP,
        top: rect.top + rect.height / 2 - tooltip.h / 2,
      }
    case 'left':
      return {
        left: rect.left - padding - GAP - tooltip.w,
        top: rect.top + rect.height / 2 - tooltip.h / 2,
      }
    default:
      return { left: 0, top: 0 }
  }
}

function fitsViewport(
  pos: { left: number; top: number },
  tooltip: { w: number; h: number },
  vw: number,
  vh: number,
): boolean {
  return (
    pos.left >= MARGIN &&
    pos.top >= MARGIN &&
    pos.left + tooltip.w <= vw - MARGIN &&
    pos.top + tooltip.h <= vh - MARGIN
  )
}

function clamp(
  pos: { left: number; top: number },
  tooltip: { w: number; h: number },
  vw: number,
  vh: number,
): { left: number; top: number } {
  return {
    left: Math.max(MARGIN, Math.min(pos.left, vw - tooltip.w - MARGIN)),
    top: Math.max(MARGIN, Math.min(pos.top, vh - tooltip.h - MARGIN)),
  }
}

/* --- Arrow --- */

function Arrow({
  placement,
  rect,
  tooltipLeft,
  tooltipTop,
}: {
  placement: Placement
  rect: DOMRect
  tooltipLeft: number
  tooltipTop: number
}) {
  const size = 7
  let style: React.CSSProperties = {}

  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2

  switch (placement) {
    case 'bottom':
      style = {
        position: 'absolute',
        top: -size,
        left: Math.max(12, Math.min(centerX - tooltipLeft - size / 2, TOOLTIP_MAX_W - 24)),
        width: 0,
        height: 0,
        borderLeft: `${size}px solid transparent`,
        borderRight: `${size}px solid transparent`,
        borderBottom: `${size}px solid rgb(var(--macos-border))`,
      }
      break
    case 'top':
      style = {
        position: 'absolute',
        bottom: -size,
        left: Math.max(12, Math.min(centerX - tooltipLeft - size / 2, TOOLTIP_MAX_W - 24)),
        width: 0,
        height: 0,
        borderLeft: `${size}px solid transparent`,
        borderRight: `${size}px solid transparent`,
        borderTop: `${size}px solid rgb(var(--macos-border))`,
      }
      break
    case 'left':
      style = {
        position: 'absolute',
        right: -size,
        top: Math.max(12, Math.min(centerY - tooltipTop - size / 2, 200)),
        width: 0,
        height: 0,
        borderTop: `${size}px solid transparent`,
        borderBottom: `${size}px solid transparent`,
        borderLeft: `${size}px solid rgb(var(--macos-border))`,
      }
      break
    case 'right':
      style = {
        position: 'absolute',
        left: -size,
        top: Math.max(12, Math.min(centerY - tooltipTop - size / 2, 200)),
        width: 0,
        height: 0,
        borderTop: `${size}px solid transparent`,
        borderBottom: `${size}px solid transparent`,
        borderRight: `${size}px solid rgb(var(--macos-border))`,
      }
      break
  }

  return <div style={style} />
}
