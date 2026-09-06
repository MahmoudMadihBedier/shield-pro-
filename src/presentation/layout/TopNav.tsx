/**
 * Primary navigation as a top bar (replaces the left sidebar). Module groups
 * with sub-routes open a dropdown; single-route groups are plain links. Below
 * `lg` the whole thing collapses to a hamburger panel.
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

/** A row inside a dropdown / the mobile panel. `onNavigate` fires on click so
 *  the containing menu can close itself from the event that caused the change. */
function MenuLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cx(
          'block rounded-lg px-3 py-2 text-sm transition',
          isActive
            ? 'bg-black/5 font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-100'
            : 'text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10',
        )
      }
    >
      {item.label}
      <span className="text-zinc-400"> / {item.labelEn}</span>
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
    'flex items-center gap-1 rounded-lg px-2.5 py-2 text-sm transition',
    active
      ? 'bg-black/5 font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-100'
      : 'text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10',
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
          className={cx('size-3 text-zinc-400 transition-transform', open && 'rotate-180')}
          aria-hidden="true"
        >
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.5" />
        </svg>
      </button>

      {open ? (
        <div
          role="menu"
          className="absolute start-0 z-40 mt-1 min-w-56 rounded-xl border border-black/10 bg-white p-1 shadow-lg dark:border-white/10 dark:bg-zinc-900"
        >
          <MenuLink
            item={{ to: group.to, label: group.label, labelEn: group.labelEn, end: group.end }}
            onNavigate={() => setOpen(false)}
          />
          <div className="my-1 h-px bg-black/5 dark:bg-white/10" />
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
        <div className="ms-3 border-s border-black/10 ps-2 dark:border-white/10">
          {group.items.map((item) => gated(item, <MenuLink item={item} onNavigate={onNavigate} />))}
        </div>
      ) : null}
    </div>
  )
}

export function TopNav() {
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeMobile = () => setMobileOpen(false)

  return (
    <>
      <nav aria-label="التنقل الرئيسي" className="hidden flex-wrap items-center gap-0.5 lg:flex">
        {NAV_GROUPS.map((group) => gated(group, <GroupTrigger key={group.to} group={group} />))}
      </nav>

      <button
        type="button"
        onClick={() => setMobileOpen((v) => !v)}
        aria-expanded={mobileOpen}
        aria-label="القائمة الرئيسية"
        className="rounded-lg border border-black/10 px-2.5 py-1.5 text-sm lg:hidden dark:border-white/15"
      >
        ☰ القائمة
      </button>

      {mobileOpen ? (
        <div className="absolute inset-x-0 top-full z-40 mt-2 max-h-[70vh] overflow-y-auto border-y border-black/10 bg-white p-3 shadow-lg lg:hidden dark:border-white/10 dark:bg-zinc-900">
          {NAV_GROUPS.map((group) =>
            gated(group, <MobileGroup key={group.to} group={group} onNavigate={closeMobile} />),
          )}
        </div>
      ) : null}
    </>
  )
}
