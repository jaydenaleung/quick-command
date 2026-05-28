# Quick Command

Spotlight-style desktop command bar for Windows and macOS. This version is powered by Rust + Tauri and opens as a popup overlay from a global shortcut.

## Features

- **Global hotkey popup** — default `CommandOrControl+Shift+Space`, editable from the menu
- **Desktop overlay** — always-on-top spotlight-style bar near the bottom of the active screen
- **Shell execution** — runs with your selected shell (`PowerShell`, `cmd`, `bash`, etc.)
- **Custom commands** — managed in the menu panel (trigger + mode + command)
- **Menu-first settings** — theme, shell, shortcut, and custom command management all in the menu
- **Stable layout** — command log is shown above the bar while the bar stays fixed

## Dev

```bash
npm install
npm run dev
```

## Build desktop app

```bash
npm run build
```
