import type { ReactNode } from 'react'
import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type MenuFlyoutProps = {
  open: boolean
  anchorEl: HTMLElement | null
  placement?: 'right' | 'left' | 'below'
  zIndex?: number
  className?: string
  onMouseEnter?: () => void
  onMouseLeave?: () => void
  children: ReactNode
}

const VIEWPORT_PAD = 8

function clampToViewport(top: number, left: number, width: number, height: number) {
  const maxLeft = window.innerWidth - width - VIEWPORT_PAD
  const maxTop = window.innerHeight - height - VIEWPORT_PAD
  return {
    top: Math.min(Math.max(top, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, maxTop)),
    left: Math.min(Math.max(left, VIEWPORT_PAD), Math.max(VIEWPORT_PAD, maxLeft))
  }
}

export function MenuFlyout({
  open,
  anchorEl,
  placement = 'right',
  zIndex = 160,
  className = '',
  onMouseEnter,
  onMouseLeave,
  children
}: MenuFlyoutProps): JSX.Element | null {
  const flyoutRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)

  const updatePosition = useCallback(() => {
    if (!open || !anchorEl || !flyoutRef.current) {
      setCoords(null)
      return
    }

    const anchor = anchorEl.getBoundingClientRect()
    const flyout = flyoutRef.current.getBoundingClientRect()
    const gap = 4

    let top = anchor.top
    let left = anchor.right + gap
    let resolvedPlacement = placement

    if (placement === 'right') {
      if (left + flyout.width > window.innerWidth - VIEWPORT_PAD) {
        left = anchor.left - flyout.width - gap
        resolvedPlacement = 'left'
      }
    } else if (placement === 'left') {
      left = anchor.left - flyout.width - gap
    } else {
      top = anchor.bottom + gap
      left = anchor.left
    }

    if (resolvedPlacement === 'right' || resolvedPlacement === 'left') {
      if (top + flyout.height > window.innerHeight - VIEWPORT_PAD) {
        top = Math.max(VIEWPORT_PAD, window.innerHeight - flyout.height - VIEWPORT_PAD)
      }
    } else if (top + flyout.height > window.innerHeight - VIEWPORT_PAD) {
      const above = anchor.top - flyout.height - gap
      top = above >= VIEWPORT_PAD ? above : VIEWPORT_PAD
    }

    setCoords(clampToViewport(top, left, flyout.width, flyout.height))
  }, [open, anchorEl, placement])

  useLayoutEffect(() => {
    if (!open || !anchorEl) {
      setCoords(null)
      return
    }
    updatePosition()
    requestAnimationFrame(() => updatePosition())
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open, anchorEl, updatePosition])

  if (!open || !anchorEl) return null

  return createPortal(
    <div
      ref={flyoutRef}
      className={`menu-flyout hud-panel ${className}`}
      style={{
        top: coords?.top ?? -9999,
        left: coords?.left ?? -9999,
        zIndex,
        visibility: coords ? 'visible' : 'hidden'
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {children}
    </div>,
    document.body
  )
}
