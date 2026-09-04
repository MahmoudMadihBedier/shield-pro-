/**
 * Route manifest for the `sales` module — relative child route objects meant to
 * be spread into the app router's authenticated layout route. Every page is
 * `React.lazy` so each screen is its own chunk (`claude.md` B.7).
 *
 * This module only *declares* the routes; wiring them into `src/app/router.tsx`
 * is the app shell's job.
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const SalesHubPage = lazy(() => import('./pages').then((m) => ({ default: m.SalesHubPage })))
const SalesInvoiceListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.SalesInvoiceListPage })),
)
const SalesInvoiceFormPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.SalesInvoiceFormPage })),
)
const SalesInvoiceDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.SalesInvoiceDetailPage })),
)
const RepStockIssueListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.RepStockIssueListPage })),
)
const RepStockIssueFormPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.RepStockIssueFormPage })),
)
const RepStockIssueDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.RepStockIssueDetailPage })),
)
const RepCloseoutListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.RepCloseoutListPage })),
)
const RepCloseoutPage = lazy(() => import('./pages').then((m) => ({ default: m.RepCloseoutPage })))

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const salesRoutes: RouteObject[] = [
  {
    path: 'sales',
    element: (
      <Lazy>
        <SalesHubPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/invoices',
    element: (
      <Lazy>
        <SalesInvoiceListPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/invoices/new',
    element: (
      <Lazy>
        <SalesInvoiceFormPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/invoices/:id',
    element: (
      <Lazy>
        <SalesInvoiceDetailPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/rep-issues',
    element: (
      <Lazy>
        <RepStockIssueListPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/rep-issues/new',
    element: (
      <Lazy>
        <RepStockIssueFormPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/rep-issues/:id',
    element: (
      <Lazy>
        <RepStockIssueDetailPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/closeouts',
    element: (
      <Lazy>
        <RepCloseoutListPage />
      </Lazy>
    ),
  },
  {
    path: 'sales/closeouts/:id',
    element: (
      <Lazy>
        <RepCloseoutPage />
      </Lazy>
    ),
  },
]
