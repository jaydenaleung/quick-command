import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { createPortal } from 'react-dom'
import {
  Terminal,
  Sun,
  Moon,
  Contrast,
  Settings,
  Trash2,
  Keyboard,
  Info,
  List,
  ChevronRight
} from 'lucide-react'
import { THEMES, applyTheme, type ThemeId } from '../core/theme'
import type { AppSettings, CommandMode, CustomCommand, ShellOption } from '../core/types'
import { MenuFlyout } from './MenuFlyout'
import { CustomCommandsPanel } from './CustomCommandsPanel'
import { SettingsPanel } from './SettingsPanel'

type PanelId = 'shortcuts' | 'customCommands' | 'settings'

type TerminalMenuProps = {
  settings: AppSettings
  shells: ShellOption[]
  commands: CustomCommand[]
  onSettingsPatch: (patch: Partial<AppSettings>) => Promise<void>
  onAddCommand: (trigger: string, command: string, mode: CommandMode) => Promise<void>
  onRemoveCommand: (trigger: string) => Promise<void>
  onClearLogs: () => void
}

const HOVER_CLOSE_MS = 180

export function TerminalMenu(props: TerminalMenuProps): JSX.Element {
  const [open, setOpen] = useState(false)
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null)
  const [panelAnchor, setPanelAnchor] = useState<HTMLElement | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cancelClose = useCallback(() => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    cancelClose()
    closeTimer.current = setTimeout(() => {
      setOpen(false)
      setActivePanel(null)
      setPanelAnchor(null)
    }, HOVER_CLOSE_MS)
  }, [cancelClose])

  const openMenu = useCallback(() => {
    cancelClose()
    setOpen(true)
  }, [cancelClose])

  const showPanel = useCallback(
    (panel: PanelId, anchor: HTMLElement) => {
      cancelClose()
      setOpen(true)
      setActivePanel(panel)
      setPanelAnchor(anchor)
    },
    [cancelClose]
  )

  const updateCoords = useCallback(() => {
    if (!rootRef.current || !menuRef.current) return
    const pad = 8
    const trigger = rootRef.current.getBoundingClientRect()
    const menu = menuRef.current.getBoundingClientRect()

    let top = trigger.top - menu.height - pad
    let left = trigger.left

    if (top < pad) {
      top = trigger.bottom + pad
    }

    left = Math.min(Math.max(left, pad), Math.max(pad, window.innerWidth - menu.width - pad))

    setCoords({ top, left })
  }, [])

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null)
      return
    }
    const trigger = rootRef.current?.getBoundingClientRect()
    if (trigger && menuRef.current) {
      const menuH = menuRef.current.offsetHeight || 280
      setCoords({ top: trigger.top - menuH - 8, left: trigger.left })
    }
    requestAnimationFrame(() => updateCoords())
    window.addEventListener('resize', updateCoords)
    return () => window.removeEventListener('resize', updateCoords)
  }, [open, updateCoords])

  useEffect(() => () => cancelClose(), [cancelClose])

  useEffect(() => {
    if (!open && !activePanel) return
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false)
        setActivePanel(null)
        setPanelAnchor(null)
      }
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [open, activePanel])

  const pickTheme = (id: ThemeId) => {
    void props.onSettingsPatch({ theme: id })
    applyTheme(id)
    setOpen(false)
    setActivePanel(null)
    setPanelAnchor(null)
  }

  const themeIcon = (id: ThemeId) => {
    if (id === 'light') return Sun
    if (id === 'dim') return Contrast
    return Moon
  }

  const panelItems: { id: PanelId; label: string; icon: typeof Settings }[] = [
    { id: 'shortcuts', label: 'Keyboard shortcuts', icon: Keyboard },
    { id: 'customCommands', label: 'Custom commands', icon: List },
    { id: 'settings', label: 'Settings', icon: Settings }
  ]

  const flyoutHover = {
    onMouseEnter: cancelClose,
    onMouseLeave: scheduleClose
  }

  const mainMenu = createPortal(
    open ? (
      <div
        ref={menuRef}
        role="menu"
        className="menu-portal hud-menu"
        style={{
          top: coords?.top ?? -9999,
          left: coords?.left ?? -9999,
          visibility: coords ? 'visible' : 'hidden'
        }}
        onMouseEnter={cancelClose}
        onMouseLeave={scheduleClose}
      >
        <p className="menu-section-label">Lighting</p>
        {THEMES.map((t) => {
          const Icon = themeIcon(t.id)
          return (
            <button key={t.id} type="button" role="menuitem" className="menu-item" onClick={() => pickTheme(t.id)}>
              <Icon size={16} strokeWidth={1.5} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              <span>
                {t.label}
                <span className="menu-item-desc">{t.description}</span>
              </span>
            </button>
          )
        })}

        <div className="menu-divider" />

        {panelItems.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            role="menuitem"
            className={`menu-item ${activePanel === id ? 'is-active' : ''}`}
            onMouseEnter={(e) => showPanel(id, e.currentTarget)}
            onFocus={(e) => showPanel(id, e.currentTarget)}
            onClick={(e) => showPanel(id, e.currentTarget)}
          >
            <Icon size={16} strokeWidth={1.5} style={{ color: 'var(--muted)', flexShrink: 0 }} />
            <span style={{ flex: 1 }}>{label}</span>
            <ChevronRight size={14} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
          </button>
        ))}

        <button
          type="button"
          role="menuitem"
          className="menu-item"
          onClick={() => {
            props.onClearLogs()
            setOpen(false)
            setActivePanel(null)
            setPanelAnchor(null)
          }}
        >
          <Trash2 size={16} strokeWidth={1.5} style={{ color: 'var(--muted)' }} />
          Clear terminal
        </button>

        <div className="menu-divider" />

        <div className="menu-item" style={{ cursor: 'default', fontSize: 11, color: 'var(--muted)' }}>
          <Info size={14} strokeWidth={1.5} />
          Quick Command v0.1
        </div>
      </div>
    ) : null,
    document.body
  )

  return (
    <>
      <div
        ref={rootRef}
        style={{ position: 'relative', flexShrink: 0 }}
        onMouseEnter={openMenu}
        onMouseLeave={scheduleClose}
      >
        <button
          type="button"
          className="menu-trigger"
          aria-label="Terminal menu"
          aria-expanded={open}
          aria-haspopup="menu"
          onClick={() => setOpen((v) => !v)}
        >
          <Terminal size={18} strokeWidth={1.75} />
        </button>
      </div>

      {mainMenu}

      <MenuFlyout
        open={open && activePanel === 'shortcuts'}
        anchorEl={activePanel === 'shortcuts' ? panelAnchor : null}
        zIndex={160}
        {...flyoutHover}
      >
        <div className="flyout-panel" style={{ width: 'min(100vw - 2rem, 280px)' }}>
          <h3>Keyboard shortcuts</h3>
          <ul className="flyout-list flyout-muted">
            <li>
              <kbd>{props.settings.hotkey.replace('CommandOrControl', 'Ctrl')}</kbd> — Toggle command bar
            </li>
            <li>
              <kbd>Esc</kbd> — Hide command bar
            </li>
            <li>
              <kbd>↑</kbd> <kbd>↓</kbd> — Command history
            </li>
            <li>
              <kbd>Enter</kbd> — Run command
            </li>
          </ul>
        </div>
      </MenuFlyout>

      <MenuFlyout
        open={open && activePanel === 'settings'}
        anchorEl={activePanel === 'settings' ? panelAnchor : null}
        zIndex={160}
        {...flyoutHover}
      >
        <SettingsPanel
          settings={props.settings}
          shells={props.shells}
          commandCount={props.commands.length}
          onPatch={(patch) => void props.onSettingsPatch(patch)}
        />
      </MenuFlyout>

      <MenuFlyout
        open={open && activePanel === 'customCommands'}
        anchorEl={activePanel === 'customCommands' ? panelAnchor : null}
        zIndex={160}
        {...flyoutHover}
      >
        <CustomCommandsPanel
          commands={props.commands}
          onAdd={(t, c, m) => void props.onAddCommand(t, c, m)}
          onRemove={(t) => void props.onRemoveCommand(t)}
        />
      </MenuFlyout>
    </>
  )
}
