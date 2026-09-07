/**
 * Top-bar account menu: avatar → dropdown with the current role(s), a
 * light/dark/system theme switch, and sign out. Closes on outside-click / Esc.
 * Presentation only — `logout` is the existing auth action.
 */
import { useEffect, useRef, useState } from 'react'

import { useAuth } from '@/application/auth/context'
import { useTheme, type ThemeChoice } from '@/shared/theme/useTheme'

function initials(seed: string): string {
  const parts = seed
    .replace(/[^a-z0-9؀-ۿ ]/gi, '')
    .trim()
    .split(/\s+/)
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
  return seed.slice(0, 2).toUpperCase() || '؟'
}

const THEME_OPTS: Array<{ value: ThemeChoice; label: string; icon: string }> = [
  { value: 'light', label: 'فاتح', icon: '☀' },
  { value: 'dark', label: 'داكن', icon: '☾' },
  { value: 'system', label: 'النظام', icon: '🖥' },
]

export function UserMenu() {
  const { principal, logout } = useAuth()
  const { choice, setChoice } = useTheme()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!principal) return null
  const roleText = principal.roles.join('، ') || 'بدون دور'

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="grid size-9 place-items-center rounded-full bg-brand-600 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
        title={roleText}
      >
        {initials(principal.userId)}
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-40 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1.5 shadow-lg"
        >
          <div className="px-2.5 py-2">
            <p className="text-xs text-[var(--text-subtle)]">الدور الحالي</p>
            <p className="truncate text-sm font-medium text-[var(--text)]">{roleText}</p>
            {principal.branchId ? (
              <p className="mt-0.5 font-mono text-[11px] text-[var(--text-subtle)]">
                فرع: {principal.branchId}
              </p>
            ) : null}
          </div>

          <div className="my-1 h-px bg-[var(--border)]" />

          <p className="px-2.5 pt-1 pb-1.5 text-xs text-[var(--text-subtle)]">المظهر</p>
          <div className="flex gap-1 px-1.5 pb-1">
            {THEME_OPTS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setChoice(opt.value)}
                className={`flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[11px] transition-colors ${
                  choice === opt.value
                    ? 'bg-brand-600 text-white'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)]'
                }`}
              >
                <span className="text-sm leading-none">{opt.icon}</span>
                {opt.label}
              </button>
            ))}
          </div>

          <div className="my-1 h-px bg-[var(--border)]" />

          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              void logout()
            }}
            className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-start text-sm text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <svg
              viewBox="0 0 20 20"
              className="size-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path
                d="M13 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-2M9 10h9m0 0-3-3m3 3-3 3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            تسجيل الخروج
          </button>
        </div>
      ) : null}
    </div>
  )
}
