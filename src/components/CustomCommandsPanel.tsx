import { useState } from 'react'
import { Trash2 } from 'lucide-react'
import type { CommandMode, CustomCommand } from '../core/types'

type CustomCommandsPanelProps = {
  commands: CustomCommand[]
  onAdd: (trigger: string, command: string, mode: CommandMode) => void
  onRemove: (trigger: string) => void
}

export function CustomCommandsPanel({
  commands,
  onAdd,
  onRemove
}: CustomCommandsPanelProps): JSX.Element {
  const [trigger, setTrigger] = useState('')
  const [command, setCommand] = useState('')
  const [mode, setMode] = useState<CommandMode>('pty')

  const submit = (): void => {
    if (!trigger.trim() || !command.trim()) return
    onAdd(trigger.trim(), command.trim(), mode)
    setTrigger('')
    setCommand('')
  }

  return (
    <div
      className="flyout-panel"
      style={{ width: 'min(100vw - 2rem, 320px)', maxHeight: 'min(70vh, 420px)', overflowY: 'auto' }}
    >
      <h3>Custom commands</h3>

      {commands.length === 0 ? (
        <p className="flyout-muted" style={{ marginBottom: 12 }}>
          No shortcuts yet. Add one below or use{' '}
          <span style={{ color: 'var(--fg)' }}>cmd add &lt;trigger&gt; &lt;exec|pty&gt; &lt;command&gt;</span>
        </p>
      ) : (
        <ul className="commands-flyout-list">
          {commands.map((item) => (
            <li key={item.trigger}>
              <div>
                <code>{item.trigger}</code>
                <span className="flyout-muted" style={{ marginLeft: 8, fontSize: 11 }}>
                  {item.mode}
                </span>
              </div>
              <button type="button" className="remove-btn" onClick={() => onRemove(item.trigger)}>
                <Trash2 size={14} strokeWidth={1.75} />
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="field-row" style={{ marginTop: 12 }}>
        <label>Trigger</label>
        <input value={trigger} onChange={(e) => setTrigger(e.target.value)} placeholder="np" spellCheck={false} />
      </div>
      <div className="field-row">
        <label>Mode</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as CommandMode)}>
          <option value="pty">Shell (pty)</option>
          <option value="exec">Run once (exec)</option>
        </select>
      </div>
      <div className="field-row">
        <label>Command</label>
        <input
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          placeholder="notepad"
          spellCheck={false}
        />
      </div>
      <button type="button" className="ghost-btn" onClick={submit}>
        Save shortcut
      </button>
    </div>
  )
}
