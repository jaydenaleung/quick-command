export type CustomCommand = {
  trigger: string
  command: string
  /** exec = run once and hide bar; pty = send line to shell */
  mode: 'exec' | 'pty'
}

export type SubmitResult =
  | { type: 'empty' }
  | { type: 'pty' }
  | { type: 'exec'; ok: boolean; error?: string }
