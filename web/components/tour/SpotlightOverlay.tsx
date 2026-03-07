'use client'

interface SpotlightOverlayProps {
  rect: DOMRect | null
  padding?: number
  onClick?: () => void
}

const BORDER_RADIUS = 12
const TRANSITION = 'left 0.5s ease-in-out, top 0.5s ease-in-out, width 0.5s ease-in-out, height 0.5s ease-in-out'

export function SpotlightOverlay({ rect, padding = 8, onClick }: SpotlightOverlayProps) {
  const cx = rect ? rect.left - padding : 0
  const cy = rect ? rect.top - padding : 0
  const cw = rect ? rect.width + padding * 2 : 0
  const ch = rect ? rect.height + padding * 2 : 0

  // Center steps — soft radial gradient overlay
  if (!rect) {
    return (
      <div
        className="fixed inset-0 z-[70] pointer-events-auto"
        onClick={onClick}
        style={{
          cursor: 'pointer',
          background: 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.15), rgba(0,0,0,0.35))',
        }}
      />
    )
  }

  // Element steps — box-shadow cutout with gentle border glow
  return (
    <>
      {/* Click catcher */}
      <div
        className="fixed inset-0 z-[70]"
        onClick={onClick}
        style={{ cursor: 'default' }}
      />

      {/* Cutout: transparent hole, box-shadow is the dark overlay */}
      <div
        style={{
          position: 'fixed',
          left: cx,
          top: cy,
          width: cw,
          height: ch,
          borderRadius: BORDER_RADIUS,
          boxShadow: '0 0 0 9999px rgba(0,0,0,0.30)',
          pointerEvents: 'none',
          zIndex: 70,
          transition: TRANSITION,
        }}
      />

      {/* Gentle accent border */}
      <div
        style={{
          position: 'fixed',
          left: cx,
          top: cy,
          width: cw,
          height: ch,
          borderRadius: BORDER_RADIUS,
          border: '1px solid rgb(var(--macos-accent) / 0.40)',
          pointerEvents: 'none',
          zIndex: 70,
          transition: TRANSITION,
        }}
      />
    </>
  )
}
