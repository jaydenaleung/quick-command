import { execSync } from 'node:child_process'
import { platform } from 'node:os'

const PORT = 1420

function run(cmd) {
  try {
    execSync(cmd, { stdio: 'ignore' })
  } catch {
    // process may not exist
  }
}

if (platform() === 'win32') {
  run('taskkill /F /IM quick-command.exe')
  try {
    const out = execSync(`netstat -ano | findstr :${PORT}`, { encoding: 'utf8' })
    const pids = new Set()
    for (const line of out.split('\n')) {
      const parts = line.trim().split(/\s+/)
      const pid = parts[parts.length - 1]
      if (pid && /^\d+$/.test(pid) && pid !== '0') pids.add(pid)
    }
    for (const pid of pids) {
      run(`taskkill /F /PID ${pid}`)
    }
  } catch {
    // nothing listening on port
  }
} else {
  run('pkill -f quick-command')
  try {
    const out = execSync(`lsof -ti :${PORT}`, { encoding: 'utf8' })
    for (const pid of out.trim().split('\n').filter(Boolean)) {
      run(`kill -9 ${pid}`)
    }
  } catch {
    // nothing listening on port
  }
}
