import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { fitLogPanelHeight, LOG_PANEL_MIN, maxDragHeight } from '../core/layout'
import type { LogEntry } from '../core/types'

type TerminalLogProps = {
  entries: LogEntry[]
  height: number
  pending?: boolean
  onHeightChange: (height: number) => void
  onResizeEnd?: (height: number) => void
}

function formatLine(entry: LogEntry): string {
  if (entry.type === 'input') {
    const cmd = entry.text.replace(/^[›>]\s*/, '')
    return `> ${cmd}`
  }
  return entry.text
}

function groupEntries(entries: LogEntry[]): LogEntry[][] {
  const groups: LogEntry[][] = []
  let current: LogEntry[] = []
  for (const entry of entries) {
    if (entry.type === 'input') {
      if (current.length > 0) groups.push(current)
      current = [entry]
    } else {
      current.push(entry)
    }
  }
  if (current.length > 0) groups.push(current)
  return groups.reverse()
}

export function TerminalLog({
  entries,
  height,
  pending = false,
  onHeightChange,
  onResizeEnd
}: TerminalLogProps): JSX.Element | null {
  const dragStart = useRef<{ y: number; h: number } | null>(null)
  const heightRef = useRef(height)
  const scrollRef = useRef<HTMLDivElement>(null)

  heightRef.current = height

  // After every entries update, size the panel to its content (capped at LOG_PANEL_DEFAULT).
  // Only fires when not mid-drag.
  useLayoutEffect(() => {
    if (!scrollRef.current || dragStart.current) return
    const fit = fitLogPanelHeight(scrollRef.current.scrollHeight)
    if (Math.abs(fit - heightRef.current) >= 1) {
      onHeightChange(fit)
    }
  }, [entries, pending, onHeightChange])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'auto' })
  }, [entries])

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      dragStart.current = { y: e.clientY, h: heightRef.current }
    },
    []
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragStart.current) return
      const delta = dragStart.current.y - e.clientY
      const next = Math.max(LOG_PANEL_MIN, Math.min(maxDragHeight(), dragStart.current.h + delta))
      heightRef.current = next
      onHeightChange(next)
    },
    [onHeightChange]
  )

  const onPointerUp = useCallback(() => {
    if (!dragStart.current) return
    dragStart.current = null
    onResizeEnd?.(heightRef.current)
  }, [onResizeEnd])

  if (entries.length === 0) return null

  const groups = groupEntries(entries)

  return (
    <div
      className="terminal-log-panel hud-panel"
      style={{ height, minHeight: LOG_PANEL_MIN }}
    >
      <div ref={scrollRef} className="terminal-scroll">
        {groups.map((group, groupIndex) => {
          const awaitingResponse =
            pending && groupIndex === 0 && group.length === 1 && group[0].type === 'input'

          return (
            <div key={group[0].id} className="log-group">
              {group.map((entry) => (
                <pre key={entry.id} className={`terminal-line terminal-line-${entry.type}`}>
                  {formatLine(entry)}
                </pre>
              ))}
              {awaitingResponse && (
                <pre className="terminal-line terminal-line-pending" aria-live="polite" aria-busy="true">
                  <span className="pending-dots">
                    <span>.</span>
                    <span>.</span>
                    <span>.</span>
                  </span>
                </pre>
              )}
            </div>
          )
        })}
      </div>
      <div
        className="log-resize-handle"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        title="Drag to resize"
        aria-hidden
      >
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <circle cx="8.5" cy="8.5" r="1" fill="currentColor" style={{ color: 'var(--scrollbar-thumb)' }} />
          <circle cx="5" cy="8.5" r="1" fill="currentColor" style={{ color: 'var(--scrollbar-thumb)' }} />
          <circle cx="8.5" cy="5" r="1" fill="currentColor" style={{ color: 'var(--scrollbar-thumb)' }} />
        </svg>
      </div>
    </div>
  )
}
