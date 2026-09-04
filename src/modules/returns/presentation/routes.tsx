/**
 * Route manifest for the `returns` module — relative child route objects meant
 * to be spread into the app router's authenticated layout route. Every page is
 * `React.lazy` so each screen is its own chunk (`claude.md` B.7).
 *
 * This module only *declares* the routes; wiring them into `src/app/router.tsx`
 * is the app shell's job.
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const ReturnsHubPage = lazy(() => import('./pages').then((m) => ({ default: m.ReturnsHubPage })))
const ReturnRequestListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.ReturnRequestListPage })),
)
const ReturnRequestFormPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.ReturnRequestFormPage })),
)
const ReturnRequestDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.ReturnRequestDetailPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const returnsRoutes: RouteObject[] = [
  { path: 'returns', element: <Lazy><ReturnsHubPage /></Lazy> },
  { path: 'returns/requests', element: <Lazy><ReturnRequestListPage /></Lazy> },
  { path: 'returns/requests/new', element: <Lazy><ReturnRequestFormPage /></Lazy> },
  { path: 'returns/requests/:id', element: <Lazy><ReturnRequestDetailPage /></Lazy> },
]
