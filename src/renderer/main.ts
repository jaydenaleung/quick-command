import './style.css'
import type { SubmitResult } from '../shared/types'

const input = document.getElementById('input') as HTMLInputElement
const output = document.getElementById('output') as HTMLPreElement

let buffer = ''

function appendOutput(text: string): void {
  buffer += text
  if (buffer.length > 12000) {
    buffer = buffer.slice(-8000)
  }
  output.textContent = buffer
  output.scrollTop = output.scrollHeight
}

window.quickCommand.onOutput(appendOutput)
window.quickCommand.onExit(() => {
  appendOutput('\n[shell exited]\n')
})

input.addEventListener('keydown', async (e) => {
  if (e.key !== 'Enter') return
  e.preventDefault()
  const line = input.value
  input.value = ''

  const result: SubmitResult = await window.quickCommand.submit(line)
  if (result.type === 'exec' && !result.ok && result.error) {
    appendOutput(`\n[exec error] ${result.error}\n`)
  }
})

window.quickCommand.listCommands().then((cmds) => {
  const triggers = cmds.map((c) => c.trigger).join(', ')
  input.placeholder = `shell command or trigger: ${triggers}`
})
