export type CommandMode = 'exec' | 'pty'

export type CustomCommand = {
  trigger: string
  command: string
  mode: CommandMode
}

export type AppSettings = {
  theme: 'system' | 'light' | 'dark' | 'dim'
  hotkey: string
  shellPath: string
}

export type ShellOption = {
  label: string
  path: string
}

export type AppStatePayload = {
  settings: AppSettings
  commands: CustomCommand[]
  shells: ShellOption[]
}

export type CommandActionResult = {
  ok: boolean
  message: string
  commands: CustomCommand[]
}

export type SubmitResult =
  | { type: 'empty' }
  | { type: 'meta'; ok: boolean; message: string }
  | { type: 'exec'; ok: boolean; output?: string; error?: string }
  | { type: 'pty'; ok: boolean; output?: string; error?: string }

export type LogEntry = {
  id: string
  type: 'input' | 'output' | 'error'
  text: string
}
