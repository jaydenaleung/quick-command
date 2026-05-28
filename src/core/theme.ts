import type { AppSettings } from './types'

export type ThemeId = 'dark' | 'light' | 'dim' | 'system'

export const THEMES: { id: Exclude<ThemeId, 'system'>; label: string; description: string }[] = [
  { id: 'dark', label: 'Dark', description: 'Default black background' },
  { id: 'light', label: 'Light', description: 'Bright spotlight-style' },
  { id: 'dim', label: 'Dim', description: 'Soft gray, low contrast' }
]

export function applyTheme(theme: AppSettings['theme']): void {
  document.documentElement.dataset.theme = theme
}

export function resolveTheme(theme: AppSettings['theme']): Exclude<ThemeId, 'system'> {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  if (theme === 'dim') return 'dim'
  if (theme === 'light') return 'light'
  return 'dark'
}
