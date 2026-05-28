import type { AppSettings, ShellOption } from '../core/types'
import { THEMES, resolveTheme } from '../core/theme'

type SettingsPanelProps = {
  settings: AppSettings
  shells: ShellOption[]
  commandCount: number
  onPatch: (patch: Partial<AppSettings>) => void
}

export function SettingsPanel({ settings, shells, commandCount, onPatch }: SettingsPanelProps): JSX.Element {
  const themeLabel =
    settings.theme === 'system'
      ? `System (${resolveTheme('system')})`
      : THEMES.find((t) => t.id === settings.theme)?.label ?? settings.theme

  return (
    <div className="flyout-panel" style={{ width: 'min(100vw - 2rem, 300px)' }}>
      <h3>Settings</h3>

      <div className="field-row">
        <label>Shell</label>
        <select value={settings.shellPath} onChange={(e) => onPatch({ shellPath: e.target.value })}>
          {shells.map((shell) => (
            <option key={shell.path} value={shell.path}>
              {shell.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field-row">
        <label>Global shortcut</label>
        <input
          value={settings.hotkey}
          onChange={(e) => onPatch({ hotkey: e.target.value })}
          placeholder="CommandOrControl+Shift+Space"
          spellCheck={false}
        />
        <p className="flyout-muted" style={{ margin: 0, fontSize: 12 }}>
          Tauri format, e.g. CommandOrControl+Shift+Space
        </p>
      </div>

      <p className="flyout-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        Theme: <span style={{ color: 'var(--fg)' }}>{themeLabel}</span> — change via Lighting in the menu.
      </p>

      <p className="flyout-muted" style={{ fontSize: 12, marginBottom: 12 }}>
        {commandCount === 0
          ? 'No custom shortcuts saved.'
          : `${commandCount} custom shortcut${commandCount === 1 ? '' : 's'} saved.`}
      </p>

      <p className="flyout-muted" style={{ fontSize: 12, margin: 0 }}>
        Quick Command v0.1 — desktop edition
      </p>
    </div>
  )
}
