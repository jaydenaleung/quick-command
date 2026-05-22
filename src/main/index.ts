import { exec } from 'child_process'
import { app, BrowserWindow, globalShortcut, ipcMain } from 'electron'
import path from 'path'
import { findCommand, loadCommands } from './commands'
import { killPty, startPty, writeToPty } from './pty'

let mainWindow: BrowserWindow | null = null

const HOTKEY = 'Control+Shift+Space'

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 640,
    height: 120,
    show: false,
    alwaysOnTop: true,
    frame: true,
    resizable: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  win.on('closed', () => {
    mainWindow = null
  })

  return win
}

function toggleWindow(): void {
  if (!mainWindow) return
  if (mainWindow.isVisible()) {
    mainWindow.hide()
  } else {
    mainWindow.show()
    mainWindow.focus()
  }
}

function runExec(command: string): Promise<void> {
  return new Promise((resolve, reject) => {
    exec(command, { cwd: app.getPath('home') }, (err) => {
      if (err) reject(err)
      else resolve()
    })
  })
}

app.whenReady().then(() => {
  mainWindow = createWindow()

  globalShortcut.register(HOTKEY, () => {
    toggleWindow()
  })

  ipcMain.handle('commands:list', () => loadCommands())

  ipcMain.handle('command:submit', async (_event, line: string) => {
    const trimmed = line.trim()
    if (!trimmed) return { type: 'empty' as const }

    const commands = loadCommands()
    const custom = findCommand(trimmed, commands)

    if (custom?.mode === 'exec') {
      try {
        await runExec(custom.command)
        mainWindow?.hide()
        return { type: 'exec' as const, ok: true }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        mainWindow?.webContents.send('pty:data', `\r\n[exec error] ${message}\r\n`)
        return { type: 'exec' as const, ok: false, error: message }
      }
    }

    const shellLine = custom?.mode === 'pty' ? custom.command : trimmed
    try {
      writeToPty(shellLine)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      mainWindow?.webContents.send('pty:data', `\r\n[shell error] ${message}\r\n`)
    }
    return { type: 'pty' as const }
  })

  try {
    startPty(mainWindow)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Failed to start shell:', message)
    mainWindow.webContents.once('did-finish-load', () => {
      mainWindow?.webContents.send('pty:data', `[shell error] ${message}\n`)
    })
  }

  app.on('activate', () => {
    if (!mainWindow) mainWindow = createWindow()
    mainWindow.show()
  })
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
  killPty()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
