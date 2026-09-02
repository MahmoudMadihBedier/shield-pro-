import { NavLink, Outlet } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { RequireRole } from '@/presentation/components/RequireRole'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'

import { NAV_ITEMS, type NavItem } from './nav'

function NavItemLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        `block rounded-lg px-3 py-2 text-sm transition ${
          isActive
            ? 'bg-black/5 font-medium text-zinc-900 dark:bg-white/10 dark:text-zinc-100'
            : 'text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10'
        }`
      }
    >
      {item.label}
      <span className="text-zinc-400"> / {item.labelEn}</span>
    </NavLink>
  )
}

function SidebarNav() {
  return (
    <nav aria-label="التنقل الرئيسي" className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) =>
        item.roles ? (
          <RequireRole key={item.to} anyOf={item.roles}>
            <NavItemLink item={item} />
          </RequireRole>
        ) : (
          <NavItemLink key={item.to} item={item} />
        ),
      )}
    </nav>
  )
}

export function AppLayout() {
  const { principal, logout } = useAuth()

  return (
    <div className="mx-auto flex min-h-full max-w-6xl gap-6 px-5 py-10">
      <aside className="hidden w-52 shrink-0 border-e border-black/10 pe-4 sm:block dark:border-white/10">
        <SidebarNav />
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="mb-8 flex items-center justify-between gap-4">
          <h1 className="text-xl font-bold tracking-tight">
            {APP_NAME_AR} <span className="text-zinc-400">/ {APP_NAME}</span>
          </h1>
          {principal ? (
            <div className="flex items-center gap-3 text-xs text-zinc-500">
              <span className="font-mono">{principal.roles.join(', ') || 'no role'}</span>
              <button
                type="button"
                onClick={() => void logout()}
                className="rounded-full border border-black/10 px-2 py-0.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
              >
                Sign out
              </button>
            </div>
          ) : null}
        </header>

        <main className="flex-1">
          <Outlet />
        </main>

        <footer className="mt-10 border-t border-black/10 pt-4 text-xs text-zinc-500 dark:border-white/10">
          ERP + CRM · Factory → Warehouse → Sub-Warehouse → Sales → Accounting
        </footer>
      </div>
    </div>
  )
}
