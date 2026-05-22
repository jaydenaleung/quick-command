import os from 'os'
import type { BrowserWindow } from 'electron'
import * as pty from 'node-pty'

let ptyProcess: pty.IPty | null = null

function defaultShell(): string {
  if (process.platform === 'win32') {
    return process.env.COMSPEC || 'powershell.exe'
  }
  return process.env.SHELL || '/bin/bash'
}

export function startPty(window: BrowserWindow): void {
  if (ptyProcess) return

  ptyProcess = pty.spawn(defaultShell(), [], {
    name: 'xterm-color',
    cols: 80,
    rows: 12,
    cwd: os.homedir(),
    env: process.env as Record<string, string>,
    // winpty avoids ConPTY "AttachConsole failed" crashes on some Windows setups
    useConpty: process.platform !== 'win32'
  })

  ptyProcess.onData((data) => {
    if (!window.isDestroyed()) {
      window.webContents.send('pty:data', data)
    }
  })

  ptyProcess.onExit(() => {
    ptyProcess = null
    if (!window.isDestroyed()) {
      window.webContents.send('pty:exit')
    }
  })
}

export function writeToPty(line: string): void {
  if (!ptyProcess) {
    throw new Error('Shell is not running')
  }
  const suffix = process.platform === 'win32' ? '\r\n' : '\n'
  ptyProcess.write(line.endsWith('\r') || line.endsWith('\n') ? line : `${line}${suffix}`)
}

export function killPty(): void {
  ptyProcess?.kill()
  ptyProcess = null
}
