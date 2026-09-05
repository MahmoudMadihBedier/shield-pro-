/**
 * Route manifest for the notification centre — a relative child route object
 * meant to be spread into the app router's authenticated layout route
 * (Implementation Plan §4 / Phase 2 Story 2.6). `React.lazy` so the page is
 * its own chunk (`claude.md` B.7). Mirrors `src/modules/fraud/routes.tsx`.
 *
 * This only *declares* the route; wiring it into `src/app/router.tsx` is the
 * app shell's job.
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const NotificationsPage = lazy(() =>
  import('./NotificationsPage').then((m) => ({ default: m.NotificationsPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const notificationsRoutes: RouteObject[] = [
  {
    path: 'notifications',
    element: (
      <Lazy>
        <NotificationsPage />
      </Lazy>
    ),
  },
]
