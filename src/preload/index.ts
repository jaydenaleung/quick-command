import { contextBridge, ipcRenderer } from 'electron'
import type { CustomCommand, SubmitResult } from '../shared/types'

contextBridge.exposeInMainWorld('quickCommand', {
  submit: (line: string): Promise<SubmitResult> => ipcRenderer.invoke('command:submit', line),
  listCommands: (): Promise<CustomCommand[]> => ipcRenderer.invoke('commands:list'),
  onOutput: (callback: (data: string) => void): (() => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: string): void => callback(data)
    ipcRenderer.on('pty:data', handler)
    return () => ipcRenderer.removeListener('pty:data', handler)
  },
  onExit: (callback: () => void): (() => void) => {
    const handler = (): void => callback()
    ipcRenderer.on('pty:exit', handler)
    return () => ipcRenderer.removeListener('pty:exit', handler)
  }
})
