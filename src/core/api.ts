import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import type {
  AppSettings,
  AppStatePayload,
  CommandActionResult,
  CommandMode,
  SubmitResult
} from './types'

type SettingsPatch = Partial<AppSettings>

export const api = {
  getState: () => invoke<AppStatePayload>('get_state'),
  setSettings: (patch: SettingsPatch) => invoke<AppSettings>('set_settings', { patch }),
  addCommand: (trigger: string, command: string, mode: CommandMode) =>
    invoke<CommandActionResult>('add_command', { trigger, command, mode }),
  removeCommand: (trigger: string) => invoke<CommandActionResult>('remove_command', { trigger }),
  submitLine: (line: string) => invoke<SubmitResult>('submit_line', { line }),
  hideWindow: () => invoke<void>('hide_window'),
  resizeWindow: (height: number) => invoke<void>('resize_window', { height }),
  onWindowShown: (handler: () => void) => listen('window-shown', () => handler()),
  onHotkeyError: (handler: (message: string) => void) =>
    listen<string>('hotkey-error', (event) => handler(event.payload))
}
