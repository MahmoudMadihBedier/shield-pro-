/**
 * Command-palette style navigation search. Filters the static nav manifest
 * (role-gated to the current principal) and navigates on select. Opens with
 * the button, `/`, or Ctrl/⌘+K; arrows move, Enter selects, Esc closes.
 *
 * Pure presentation — it only reads the nav manifest and calls `navigate`.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'

import { NAV_ITEMS, type NavItem } from './nav'

function useVisibleItems(): NavItem[] {
  const { principal } = useAuth()
  return useMemo(() => {
    const roles = principal?.roles ?? []
    const seen = new Set<string>()
    return NAV_ITEMS.filter((item) => {
      if (seen.has(item.to)) return false
      seen.add(item.to)
      if (!item.roles) return true
      return item.roles.some((r) => roles.includes(r))
    })
  }, [principal])
}

function score(item: NavItem, q: string): number {
  const hay = `${item.label} ${item.labelEn} ${item.to}`.toLowerCase()
  const needle = q.toLowerCase().trim()
  if (needle === '') return 1
  if (hay.includes(needle)) return 2
  // loose subsequence match
  let i = 0
  for (const ch of hay) if (ch === needle[i]) i++
  return i === needle.length ? 1 : 0
}

export function GlobalSearch() {
  const navigate = useNavigate()
  const items = useVisibleItems()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    return items
      .map((item) => ({ item, s: score(item, query) }))
      .filter((r) => r.s > 0)
      .sort((a, b) => b.s - a.s)
      .slice(0, 12)
      .map((r) => r.item)
  }, [items, query])

  // Keep the highlight in range without an effect.
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0))

  const openPalette = useCallback(() => {
    setQuery('')
    setActive(0)
    setOpen(true)
  }, [])

  // Open shortcuts + a global Escape while open (so it closes even if the
  // input never received focus).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (open && e.key === 'Escape') {
        setOpen(false)
        return
      }
      const tag = (e.target as HTMLElement)?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT'
      if ((e.key === 'k' && (e.metaKey || e.ctrlKey)) || (e.key === '/' && !typing)) {
        e.preventDefault()
        openPalette()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, openPalette])

  // Focus the field once it has actually mounted.
  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  const choose = (item: NavItem | undefined) => {
    if (!item) return
    setOpen(false)
    navigate(item.to)
  }

  return (
    <>
      <button
        type="button"
        onClick={openPalette}
        className="inline-flex h-9 items-center gap-2 rounded-lg border border-[var(--border-strong)] bg-[var(--surface-2)] px-2.5 text-xs text-[var(--text-muted)] transition-colors hover:border-brand-400/60 hover:text-[var(--text)]"
        aria-label="بحث سريع"
      >
        <svg
          viewBox="0 0 20 20"
          className="size-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <circle cx="9" cy="9" r="6" />
          <path d="m14 14 4 4" strokeLinecap="round" />
        </svg>
        <span className="hidden md:inline">بحث… </span>
        <kbd className="hidden rounded border border-[var(--border)] bg-[var(--surface)] px-1 font-sans text-[10px] md:inline">
          /
        </kbd>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[12vh] backdrop-blur-sm"
          onClick={() => setOpen(false)}
          role="presentation"
        >
          <div
            className="w-full max-w-lg overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="بحث في التنقل"
          >
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3">
              <svg
                viewBox="0 0 20 20"
                className="size-4 text-[var(--text-subtle)]"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="9" cy="9" r="6" />
                <path d="m14 14 4 4" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value)
                  setActive(0)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setOpen(false)
                  else if (e.key === 'ArrowDown') {
                    e.preventDefault()
                    setActive(Math.min(activeIndex + 1, results.length - 1))
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault()
                    setActive(Math.max(activeIndex - 1, 0))
                  } else if (e.key === 'Enter') {
                    e.preventDefault()
                    choose(results[activeIndex])
                  }
                }}
                placeholder="اذهب إلى… (الصفحات، الوحدات)"
                className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-[var(--text-subtle)]"
              />
            </div>
            <ul className="max-h-80 overflow-y-auto p-1.5">
              {results.length === 0 ? (
                <li className="px-3 py-6 text-center text-sm text-[var(--text-muted)]">لا نتائج</li>
              ) : (
                results.map((item, i) => (
                  <li key={item.to}>
                    <button
                      type="button"
                      onMouseMove={() => setActive(i)}
                      onClick={() => choose(item)}
                      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-start text-sm transition-colors ${
                        i === activeIndex
                          ? 'bg-brand-600 text-white'
                          : 'text-[var(--text)] hover:bg-[var(--surface-hover)]'
                      }`}
                    >
                      <span className="truncate">
                        {item.label}
                        <span
                          className={
                            i === activeIndex ? 'text-white/70' : 'text-[var(--text-subtle)]'
                          }
                        >
                          {' '}
                          / {item.labelEn}
                        </span>
                      </span>
                      <span
                        dir="ltr"
                        className={`shrink-0 font-mono text-[11px] ${
                          i === activeIndex ? 'text-white/70' : 'text-[var(--text-subtle)]'
                        }`}
                      >
                        {item.to}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  )
}
