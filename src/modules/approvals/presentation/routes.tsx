/**
 * Route manifest for the `approvals` module — relative child route objects to
 * be spread into the app router's authenticated layout route. Every page is
 * `React.lazy` so each screen is its own chunk (`claude.md` B.7).
 *
 * This module only *declares* the routes; wiring them into `src/app/router.tsx`
 * is the app shell's job (mirrors `src/modules/accounting/presentation/routes.tsx`).
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const ExceptionsDashboardPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.ExceptionsDashboardPage })),
)
const ApprovalRulesListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.ApprovalRulesListPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const approvalsRoutes: RouteObject[] = [
  {
    path: 'approvals',
    element: (
      <Lazy>
        <ExceptionsDashboardPage />
      </Lazy>
    ),
  },
  {
    path: 'approvals/rules',
    element: (
      <Lazy>
        <ApprovalRulesListPage />
      </Lazy>
    ),
  },
  {
    path: 'approvals/exceptions',
    element: (
      <Lazy>
        <ExceptionsDashboardPage />
      </Lazy>
    ),
  },
]
