import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { api } from '../core/api'
import {
  LOG_PANEL_MIN,
  flushWindowResize,
  requiredWindowHeight,
  waitFrames,
} from '../core/layout'
import { applyTheme } from '../core/theme'
import type { AppSettings, LogEntry, SubmitResult } from '../core/types'
import { TerminalLog } from './TerminalLog'
import { TerminalMenu } from './TerminalMenu'

function createLog(type: LogEntry['type'], text: string): LogEntry {
  return { id: `${Date.now()}-${Math.random()}`, type, text }
}

export function CommandBar(): JSX.Element {
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [settings, setSettings] = useState<AppSettings>({
    theme: 'dark',
    hotkey: 'CommandOrControl+Shift+Space',
    shellPath: ''
  })
  const [shells, setShells] = useState<{ label: string; path: string }[]>([])
  const [commands, setCommands] = useState<{ trigger: string; command: string; mode: 'exec' | 'pty' }[]>([])
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [logPanelHeight, setLogPanelHeight] = useState(LOG_PANEL_MIN)

  const inputRef = useRef<HTMLInputElement>(null)
  const hasLogsRef = useRef(false)
  const logPanelHeightRef = useRef(LOG_PANEL_MIN)

  const hasLogs = logs.length > 0
  hasLogsRef.current = hasLogs
  logPanelHeightRef.current = logPanelHeight

  // Single source-of-truth for native window resize. Returns a promise so
  // submit() can await it before running the command.
  const resizeWindow = useCallback((logH: number, hasLogPanel: boolean): Promise<void> => {
    const target = requiredWindowHeight(logH, hasLogPanel)
    return flushWindowResize(target, (h) => api.resizeWindow(h))
  }, [])

  const syncWindowSize = useCallback(() => {
    resizeWindow(
      hasLogsRef.current ? logPanelHeightRef.current : 0,
      hasLogsRef.current
    )
  }, [resizeWindow])

  // Resize the native window whenever the log panel appears or disappears.
  // This covers the case where content fits within LOG_PANEL_MIN (handleLogHeightChange
  // won't fire if measured height equals current height, so we must resize here).
  useLayoutEffect(() => {
    resizeWindow(hasLogs ? logPanelHeightRef.current : 0, hasLogs)
  }, [hasLogs, resizeWindow])

  // Log panel content changed — TerminalLog measured a new fit height.
  const handleLogHeightChange = useCallback(
    (height: number) => {
      logPanelHeightRef.current = height
      setLogPanelHeight(height)
      resizeWindow(height, true)
    },
    [resizeWindow]
  )

  // Drag ended — snap to final measured height.
  const handleLogResizeEnd = useCallback((height: number) => {
    resizeWindow(height, true)
  }, [resizeWindow])

  useEffect(() => {
    void api.getState().then((state) => {
      setSettings(state.settings)
      setCommands(state.commands)
      setShells(state.shells)
      applyTheme(state.settings.theme)
      setLoaded(true)
      syncWindowSize()
    })
    const unlistenShown = api.onWindowShown(() => {
      inputRef.current?.focus()
      syncWindowSize()
    })
    const unlistenHotkey = api.onHotkeyError((message) => {
      setLogs((prev) => [...prev, createLog('error', message)])
    })
    return () => {
      void unlistenShown.then((f) => f())
      void unlistenHotkey.then((f) => f())
    }
  }, [syncWindowSize])

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (settings.theme === 'system') applyTheme('system')
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [settings.theme])

  const submit = async (): Promise<void> => {
    const line = input.trim()
    if (!line || busy) return

    setBusy(true)
    setHistory((h) => (h[h.length - 1] === line ? h : [...h, line]))
    setHistoryIndex(-1)
    setInput('')

    if (logs.length === 0) {
      // Synchronously mount the log panel, then await the native window resize
      // before running the command. This ensures the window is fully expanded
      // even for fast or GUI commands that return before a frame fires.
      flushSync(() => {
        setLogs([createLog('input', line)])
      })
      await resizeWindow(LOG_PANEL_MIN, true)
    } else {
      setLogs((prev) => [...prev, createLog('input', line)])
    }

    try {
      const result = await api.submitLine(line)
      setLogs((prev) => appendSubmitLogs(prev, result))
      if (result.type === 'meta' && result.ok) {
        const state = await api.getState()
        setCommands(state.commands)
      }
    } finally {
      await waitFrames(1)
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const placeholder = useMemo(() => {
    if (!loaded) return 'Loading…'
    return 'Search or type a command…'
  }, [loaded])

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Escape') {
      e.preventDefault()
      void api.hideWindow()
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      void submit()
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (history.length === 0) return
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setInput(history[next])
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex < 0) return
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(-1)
        setInput('')
      } else {
        setHistoryIndex(next)
        setInput(history[next])
      }
    }
  }

  return (
    <div className="shell">
      <div className="bar-stack">
        {hasLogs && (
          <TerminalLog
            entries={logs}
            height={logPanelHeight}
            pending={busy}
            onHeightChange={handleLogHeightChange}
            onResizeEnd={handleLogResizeEnd}
          />
        )}

        <div className="bar-wrap">
          <div className="command-bar hud-panel">
            <TerminalMenu
              settings={settings}
              shells={shells}
              commands={commands}
              onSettingsPatch={async (patch) => {
                const next = await api.setSettings(patch)
                setSettings(next)
                applyTheme(next.theme)
              }}
              onAddCommand={async (trigger, command, mode) => {
                const result = await api.addCommand(trigger, command, mode)
                setCommands(result.commands)
                setLogs((prev) => [...prev, createLog(result.ok ? 'output' : 'error', result.message)])
              }}
              onRemoveCommand={async (trigger) => {
                const result = await api.removeCommand(trigger)
                setCommands(result.commands)
                setLogs((prev) => [...prev, createLog(result.ok ? 'output' : 'error', result.message)])
              }}
              onClearLogs={() => {
                setLogs([])
                logPanelHeightRef.current = LOG_PANEL_MIN
                hasLogsRef.current = false
                setLogPanelHeight(LOG_PANEL_MIN)
                resizeWindow(0, false)
              }}
            />
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              disabled={!loaded || busy}
              placeholder={placeholder}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

function appendSubmitLogs(existing: LogEntry[], result: SubmitResult): LogEntry[] {
  if (result.type === 'empty') return existing
  if (result.type === 'meta') {
    return [...existing, createLog(result.ok ? 'output' : 'error', result.message)]
  }
  if (result.output) {
    return [...existing, createLog('output', result.output)]
  }
  if (result.error) {
    return [...existing, createLog('error', result.error)]
  }
  return existing
}
