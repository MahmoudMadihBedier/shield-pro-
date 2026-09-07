/**
 * Primary navigation as a top bar. Module groups with sub-routes open a
 * dropdown; single-route groups are plain links. `mobileOnly` renders just the
 * hamburger + slide-down panel (used inside the compact header on < lg).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

import { RequireRole } from '@/presentation/components/RequireRole'

import { NAV_GROUPS, type NavGroup, type NavItem } from './nav'

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

function isGroupActive(pathname: string, to: string): boolean {
  if (to === '/') return pathname === '/'
  return pathname === to || pathname.startsWith(`${to}/`)
}

const ACTIVE_TRIGGER =
  'bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
const IDLE_TRIGGER =
  'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]'

/** A row inside a dropdown / the mobile panel. */
function MenuLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'block rounded-lg px-3 py-2 text-sm transition-colors',
          isActive
            ? 'bg-brand-50 font-medium text-brand-700 dark:bg-brand-950/50 dark:text-brand-300'
            : 'text-[var(--text-muted)] hover:bg-[var(--surface-hover)] hover:text-[var(--text)]',
        )
      }
    >
      {item.label}
      <span className="text-[var(--text-subtle)]"> / {item.labelEn}</span>
    </NavLink>
  )
}

function gated(item: NavItem, node: ReactNode): ReactNode {
  return item.roles ? (
    <RequireRole key={item.to} anyOf={item.roles}>
      {node}
    </RequireRole>
  ) : (
    node
  )
}

/** One top-bar entry: a plain link (no children) or a dropdown trigger. */
function GroupTrigger({ group }: { group: NavGroup }) {
  const { pathname } = useLocation()
  const active = isGroupActive(pathname, group.to)
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

  const triggerClass = cx(
    'flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-sm transition-colors',
    active ? ACTIVE_TRIGGER : IDLE_TRIGGER,
  )

  if (group.items.length === 0) {
    return (
      <NavLink to={group.to} end={group.end} className={() => triggerClass}>
        {group.label}
      </NavLink>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        className={triggerClass}
      >
        {group.label}
        <svg
          viewBox="0 0 12 12"
          className={cx(
            'size-3 text-[var(--text-subtle)] transition-transform',
            open && 'rotate-180',
          )}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute start-0 z-40 mt-1.5 min-w-56 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 shadow-lg"
        >
          <MenuLink
            item={{ to: group.to, label: group.label, labelEn: group.labelEn, end: group.end }}
            onNavigate={() => setOpen(false)}
          />
          <div className="my-1 h-px bg-[var(--border)]" />
          {group.items.map((item) =>
            gated(item, <MenuLink item={item} onNavigate={() => setOpen(false)} />),
          )}
        </div>
      ) : null}
    </div>
  )
}

function MobileGroup({ group, onNavigate }: { group: NavGroup; onNavigate: () => void }) {
  return (
    <div className="py-1">
      <MenuLink
        item={{ to: group.to, label: group.label, labelEn: group.labelEn, end: group.end }}
        onNavigate={onNavigate}
      />
      {group.items.length > 0 ? (
        <div className="ms-3 border-s border-[var(--border)] ps-2">
          {group.items.map((item) => gated(item, <MenuLink item={item} onNavigate={onNavigate} />))}
        </div>
      ) : null}
    </div>
  )
}

export interface TopNavProps {
  /** Render only the hamburger + slide-down panel (compact header, < lg). */
  mobileOnly?: boolean
}

export function TopNav({ mobileOnly = false }: TopNavProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  if (mobileOnly) {
    return (
      <>
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          aria-expanded={mobileOpen}
          aria-label="القائمة الرئيسية"
          className="grid size-9 place-items-center rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text-muted)] transition-colors hover:text-[var(--text)]"
        >
          <svg
            viewBox="0 0 20 20"
            className="size-5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M3 5h14M3 10h14M3 15h14" strokeLinecap="round" />
          </svg>
        </button>

        {mobileOpen ? (
          <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto border-y border-[var(--border)] bg-[var(--surface)] p-3 shadow-lg">
            {NAV_GROUPS.map((group) =>
              gated(group, <MobileGroup key={group.to} group={group} onNavigate={closeMobile} />),
            )}
          </div>
        ) : null}
      </>
    )
  }

  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="flex flex-nowrap items-center gap-0.5 overflow-x-auto"
    >
      {NAV_GROUPS.map((group) => gated(group, <GroupTrigger key={group.to} group={group} />))}
    </nav>
  )
}
