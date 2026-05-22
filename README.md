# Quick Command

Minimal Electron command bar: run a shell, type commands, use custom triggers from `commands.json`.

## Must-haves (MVP)

1. **Terminal** — PowerShell/cmd on Windows, `$SHELL` on macOS via `node-pty`
2. **Command bar** — text input + scrollable output
3. **Custom commands** — `commands.json` in app user data (see `commands.example.json`)

## Dev

```bash
npm install
npm run dev
```

- Toggle window: **Ctrl+Shift+Space**
- Enter runs input: matching **trigger** uses custom command; otherwise line goes to the shell
- Edit commands: `%APPDATA%/quick-command/commands.json` (Windows) or equivalent userData path

## Build

```bash
npm run build
npm start
```
