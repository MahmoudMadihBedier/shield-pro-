import type { ReactNode } from 'react'

import { APP_NAME, APP_NAME_AR } from '@/shared/constants'

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col px-5 py-10">
      <header className="mb-8 flex items-baseline justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">
          {APP_NAME_AR} <span className="text-zinc-400">/ {APP_NAME}</span>
        </h1>
        <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-zinc-500 dark:border-white/15">
          scaffold
        </span>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mt-10 border-t border-black/10 pt-4 text-xs text-zinc-500 dark:border-white/10">
        ERP + CRM · Factory → Warehouse → Sub-Warehouse → Sales → Accounting
      </footer>
    </div>
  )
}
