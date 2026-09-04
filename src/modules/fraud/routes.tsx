/**
 * Route manifest for the `fraud` module — a relative child route object meant
 * to be spread into the app router's authenticated layout route. The page is
 * `React.lazy` so it is its own chunk (`claude.md` B.7).
 *
 * This module only *declares* the route; wiring it into `src/app/router.tsx`
 * is the app shell's job.
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const FraudFlagsPage = lazy(() =>
  import('./presentation/FraudFlagsPage').then((m) => ({ default: m.FraudFlagsPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const fraudRoutes: RouteObject[] = [
  {
    path: 'fraud',
    element: (
      <Lazy>
        <FraudFlagsPage />
      </Lazy>
    ),
  },
]
