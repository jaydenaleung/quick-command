import { app } from 'electron'
import fs from 'fs'
import path from 'path'
import type { CustomCommand } from '../shared/types'

const DEFAULT_COMMANDS: CustomCommand[] = [
  {
    trigger: 'home',
    command: process.platform === 'win32' ? 'cd $HOME' : 'cd ~',
    mode: 'pty'
  },
  {
    trigger: 'dir',
    command: process.platform === 'win32' ? 'dir' : 'ls',
    mode: 'pty'
  },
  ...(process.platform === 'win32'
    ? [{ trigger: 'notepad', command: 'notepad', mode: 'exec' as const }]
    : [])
]

function commandsPath(): string {
  return path.join(app.getPath('userData'), 'commands.json')
}

export function loadCommands(): CustomCommand[] {
  const file = commandsPath()
  if (!fs.existsSync(file)) {
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(DEFAULT_COMMANDS, null, 2), 'utf-8')
    return [...DEFAULT_COMMANDS]
  }
  try {
    const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as CustomCommand[]
    return Array.isArray(raw) ? raw : [...DEFAULT_COMMANDS]
  } catch {
    return [...DEFAULT_COMMANDS]
  }
}

export function findCommand(input: string, commands: CustomCommand[]): CustomCommand | undefined {
  const key = input.trim().toLowerCase()
  return commands.find((c) => c.trigger.toLowerCase() === key)
}
