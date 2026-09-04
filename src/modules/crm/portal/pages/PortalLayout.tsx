/**
 * Minimal, visually-distinct shell for the CRM client portal — no staff nav,
 * no role chips, nothing that leaks the internal ERP UI to a customer.
 */
import { NavLink, Outlet } from 'react-router-dom'

import { APP_NAME_AR } from '@/shared/constants'

import { usePortalAuth } from '../auth/portal-context'

const NAV_ITEMS = [
  { to: '/portal', label: 'الرئيسية', end: true },
  { to: '/portal/invoices', label: 'الفواتير', end: false },
  { to: '/portal/statement', label: 'كشف الحساب', end: false },
  { to: '/portal/change-pin', label: 'تغيير الرقم السري', end: false },
] as const

export function PortalLayout() {
  const { customer, logout } = usePortalAuth()

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-black/10 bg-white dark:border-white/10 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-sm font-bold">بوابة العملاء</p>
            <p className="text-xs text-zinc-400">{APP_NAME_AR}</p>
          </div>
          <div className="flex items-center gap-3 text-xs text-zinc-500">
            {customer ? <span>{customer.name}</span> : null}
            <button
              type="button"
              onClick={() => void logout()}
              className="rounded-full border border-black/10 px-2.5 py-1 hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
            >
              تسجيل الخروج
            </button>
          </div>
        </div>
        <nav
          aria-label="التنقل في بوابة العملاء"
          className="mx-auto flex max-w-4xl gap-1 overflow-x-auto px-5 pb-3"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                    : 'text-zinc-600 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-5 py-8">
        <Outlet />
      </main>
    </div>
  )
}
