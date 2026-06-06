export const LOG_PANEL_MIN = 56
export const LOG_PANEL_DEFAULT = 220
export const BAR_HEIGHT = 56
export const STACK_GAP = 10
export const SHELL_PADDING_Y = 13
/** Extra logical px so shadows are not clipped at the window edge */
export const RESIZE_SLACK = 8

/**
 * Content-based height: grows with output up to LOG_PANEL_DEFAULT.
 * Never uses window.innerHeight — the window starts small so that would clamp to zero.
 */
export function fitLogPanelHeight(contentScrollHeight: number): number {
  return Math.max(LOG_PANEL_MIN, Math.min(LOG_PANEL_DEFAULT, Math.ceil(contentScrollHeight)))
}

/**
 * Cap for drag-resize. Uses window.innerHeight which is valid once the window
 * has been expanded to fit the log panel.
 */
export function maxDragHeight(): number {
  const chrome = BAR_HEIGHT + STACK_GAP + SHELL_PADDING_Y * 2 + RESIZE_SLACK
  return Math.max(LOG_PANEL_DEFAULT, window.innerHeight - chrome)
}

export function requiredWindowHeight(logPanelHeight: number, hasLogs: boolean): number {
  if (!hasLogs) {
    return SHELL_PADDING_Y * 2 + BAR_HEIGHT
  }
  return SHELL_PADDING_Y * 2 + logPanelHeight + STACK_GAP + BAR_HEIGHT + RESIZE_SLACK
}

let lastResizeSent = 0
let resizeRaf: number | null = null
let pendingTarget = 0
let pendingResize: ((height: number) => Promise<void>) | null = null

/** Coalesce native window resizes to one IPC call per animation frame. */
export function scheduleWindowResize(
  target: number,
  resize: (height: number) => Promise<void>
): void {
  pendingTarget = target
  pendingResize = resize
  if (resizeRaf !== null) return
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null
    const height = pendingTarget
    const run = pendingResize
    pendingResize = null
    if (!run || Math.abs(height - lastResizeSent) < 1) return
    lastResizeSent = height
    void run(height)
  })
}

/** Apply resize immediately (e.g. on content change or drag end).
 *  Returns the IPC promise so callers can await it when needed. */
export function flushWindowResize(
  target: number,
  resize: (height: number) => Promise<void>
): Promise<void> {
  if (resizeRaf !== null) {
    cancelAnimationFrame(resizeRaf)
    resizeRaf = null
  }
  pendingResize = null
  if (Math.abs(target - lastResizeSent) < 1) return Promise.resolve()
  lastResizeSent = target
  return resize(target)
}

export function resetWindowResizeTracking(): void {
  lastResizeSent = 0
}

export function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let left = count
    const step = () => {
      left -= 1
      if (left <= 0) resolve()
      else requestAnimationFrame(step)
    }
    requestAnimationFrame(step)
  })
}
