/**
 * Light / dark / system theme control. The pre-paint script in `index.html`
 * sets the initial `data-theme`; this hook keeps it in sync with the user's
 * choice (persisted in `localStorage`) and with the OS setting while on
 * "system". Presentation only — no app state, no backend.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'
export type EffectiveTheme = 'light' | 'dark'

const STORAGE_KEY = 'shieldpro.theme'

function readChoice(): ThemeChoice {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'light' || v === 'dark' || v === 'system' ? v : 'system'
  } catch {
    return 'system'
  }
}

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolve(choice: ThemeChoice): EffectiveTheme {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return choice
}

function apply(choice: ThemeChoice): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.theme = resolve(choice)
}

// --- tiny external store so every consumer re-renders on a change -----------
const listeners = new Set<() => void>()
function emit() {
  for (const l of listeners) l()
}
function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => listeners.delete(cb)
}

export interface UseThemeResult {
  /** The user's stored preference. */
  choice: ThemeChoice
  /** What is actually applied right now. */
  effective: EffectiveTheme
  setChoice: (next: ThemeChoice) => void
  /** Cycle light → dark → system. */
  cycle: () => void
}

export function useTheme(): UseThemeResult {
  const choice = useSyncExternalStore(subscribe, readChoice, () => 'system' as ThemeChoice)

  const setChoice = useCallback((next: ThemeChoice) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* ignore — private mode / disabled storage */
    }
    apply(next)
    emit()
  }, [])

  const cycle = useCallback(() => {
    const order: ThemeChoice[] = ['light', 'dark', 'system']
    setChoice(order[(order.indexOf(readChoice()) + 1) % order.length]!)
  }, [setChoice])

  // While on "system", follow OS changes live.
  useEffect(() => {
    if (choice !== 'system') return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      apply('system')
      emit()
    }
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [choice])

  return { choice, effective: resolve(choice), setChoice, cycle }
}
