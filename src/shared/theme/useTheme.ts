/**
 * Light / dark / system theme. Cross-cutting client-only UI state, so it lives
 * in a Zustand store (CLAUDE.md B.1). The pre-paint script in `index.html` sets
 * the initial `data-theme`; this store then owns it — persists the choice,
 * resolves "system" against the OS, and reconciles the `<html>` attribute on
 * load (in case the stored value was stale / invalid).
 *
 * Presentation only — no app data, no backend.
 */
import { create } from 'zustand'

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
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )
}

function resolve(choice: ThemeChoice): EffectiveTheme {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return choice
}

function applyToDom(effective: EffectiveTheme): void {
  if (typeof document !== 'undefined') document.documentElement.dataset.theme = effective
}

interface ThemeStore {
  choice: ThemeChoice
  effective: EffectiveTheme
  setChoice: (next: ThemeChoice) => void
  /** Cycle light → dark → system. */
  cycle: () => void
  /** Re-resolve from the current choice + OS and re-apply (OS-change listener). */
  syncFromSystem: () => void
}

const initialChoice = readChoice()
const initialEffective = resolve(initialChoice)
applyToDom(initialEffective) // reconcile the pre-paint attribute with the sanitised value

export const useThemeStore = create<ThemeStore>((set, get) => ({
  choice: initialChoice,
  effective: initialEffective,

  setChoice: (next) => {
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      /* private mode / storage disabled — in-memory only */
    }
    const effective = resolve(next)
    applyToDom(effective)
    set({ choice: next, effective })
  },

  cycle: () => {
    const order: ThemeChoice[] = ['light', 'dark', 'system']
    get().setChoice(order[(order.indexOf(get().choice) + 1) % order.length]!)
  },

  syncFromSystem: () => {
    const effective = resolve(get().choice)
    applyToDom(effective)
    set({ effective })
  },
}))

// Follow OS appearance changes (only shifts `effective` while choice === 'system').
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window
    .matchMedia('(prefers-color-scheme: dark)')
    .addEventListener('change', () => useThemeStore.getState().syncFromSystem())
}

export interface UseThemeResult {
  choice: ThemeChoice
  effective: EffectiveTheme
  setChoice: (next: ThemeChoice) => void
  cycle: () => void
}

/** Convenience selector hook over {@link useThemeStore}. */
export function useTheme(): UseThemeResult {
  const choice = useThemeStore((s) => s.choice)
  const effective = useThemeStore((s) => s.effective)
  const setChoice = useThemeStore((s) => s.setChoice)
  const cycle = useThemeStore((s) => s.cycle)
  return { choice, effective, setChoice, cycle }
}
