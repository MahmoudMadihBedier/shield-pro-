import { Outlet } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
// Leaf import, not the `@/shared/notifications` barrel — AppLayout is not
// lazy-loaded, so anything pulled in here lands in the main bundle.
import { NotificationBell } from '@/shared/notifications/NotificationBell'

import { BrandMark } from './BrandMark'
import { Breadcrumbs } from './Breadcrumbs'
import { GlobalSearch } from './GlobalSearch'
import { TopNav } from './TopNav'
import { UserMenu } from './UserMenu'

export function AppLayout() {
  const { principal } = useAuth()

  return (
    <div className="flex min-h-full flex-col">
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--surface)]/85 backdrop-blur-md">
        <div className="mx-auto max-w-[1440px] px-4 sm:px-6">
          {/* Row 1: brand + utilities */}
          <div className="flex h-14 items-center gap-3">
            <BrandMark />
            <div className="flex-1" />
            {principal ? (
              <div className="flex shrink-0 items-center gap-2">
                <GlobalSearch />
                <NotificationBell />
                <UserMenu />
                <div className="lg:hidden">
                  <TopNav mobileOnly />
                </div>
              </div>
            ) : null}
          </div>

          {/* Row 2: module nav — its own full-width row so dropdowns overflow
              freely and the bar can wrap on narrow desktops. */}
          {principal ? (
            <div className="hidden border-t border-[var(--border)] py-1.5 lg:block">
              <TopNav />
            </div>
          ) : null}
        </div>
      </header>

      {principal ? (
        <div className="border-b border-[var(--border)] bg-[var(--surface-2)]">
          <div className="mx-auto max-w-[1440px] px-4 py-2 sm:px-6">
            <Breadcrumbs />
          </div>
        </div>
      ) : null}

      <div className="mx-auto w-full max-w-[1440px] flex-1 px-4 py-6 sm:px-6">
        <main>
          <Outlet />
        </main>

        <footer className="mt-12 border-t border-[var(--border)] pt-4 text-xs text-[var(--text-subtle)]">
          ERP + CRM · Factory → Warehouse → Sub-Warehouse → Sales → Accounting
        </footer>
      </div>
    </div>
  )
}
