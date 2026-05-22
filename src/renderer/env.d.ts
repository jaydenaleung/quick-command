import type { CustomCommand } from '../shared/types'
import type { SubmitResult } from '../shared/types'

declare global {
  interface Window {
    quickCommand: {
      submit: (line: string) => Promise<SubmitResult>
      listCommands: () => Promise<CustomCommand[]>
      onOutput: (callback: (data: string) => void) => () => void
      onExit: (callback: () => void) => () => void
    }
  }
}

export {}
