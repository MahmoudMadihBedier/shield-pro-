import { Outlet } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { APP_NAME, APP_NAME_AR } from '@/shared/constants'
// Leaf import, not the `@/shared/notifications` barrel — AppLayout is not
// lazy-loaded, so anything pulled in here lands in the main bundle.
import { NotificationBell } from '@/shared/notifications/NotificationBell'

import { TopNav } from './TopNav'

export function AppLayout() {
  const { principal, logout } = useAuth()

  return (
    <div className="flex min-h-full flex-col">
      <header className="relative border-b border-black/10 dark:border-white/10">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex items-center justify-between gap-4 py-3">
            <h1 className="shrink-0 text-lg font-bold tracking-tight">
              {APP_NAME_AR} <span className="text-zinc-400">/ {APP_NAME}</span>
            </h1>

            {principal ? (
              <div className="flex items-center gap-3 text-xs text-zinc-500">
                <NotificationBell />
                <span className="hidden font-mono sm:inline">
                  {principal.roles.join(', ') || 'no role'}
                </span>
                <button
                  type="button"
                  onClick={() => void logout()}
                  className="rounded-full border border-black/10 px-2 py-0.5 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Sign out
                </button>
              </div>
            ) : null}
          </div>

          {principal ? (
            <div className="flex items-center gap-2 pb-2">
              <TopNav />
            </div>
          ) : null}
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl flex-1 px-5 py-8">
        <main>
          <Outlet />
        </main>

        <footer className="mt-10 border-t border-black/10 pt-4 text-xs text-zinc-500 dark:border-white/10">
          ERP + CRM · Factory → Warehouse → Sub-Warehouse → Sales → Accounting
        </footer>
      </div>
    </div>
  )
}
