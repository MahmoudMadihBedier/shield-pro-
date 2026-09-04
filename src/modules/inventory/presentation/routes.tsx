/**
 * Route manifest for the `inventory` module — relative child route objects meant
 * to be spread into the app router's authenticated layout route. Every page is
 * `React.lazy` so each screen is its own chunk (`claude.md` B.7).
 *
 * This module only *declares* the routes; wiring them into `src/app/router.tsx`
 * is the app shell's job.
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const InventoryHubPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.InventoryHubPage })),
)
const StockOnHandPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.StockOnHandPage })),
)
const WarehouseTransferListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.WarehouseTransferListPage })),
)
const WarehouseTransferFormPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.WarehouseTransferFormPage })),
)
const WarehouseTransferDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.WarehouseTransferDetailPage })),
)
const StockCountSessionListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.StockCountSessionListPage })),
)
const StockCountSessionPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.StockCountSessionPage })),
)
const WriteOffListPage = lazy(() => import('./pages').then((m) => ({ default: m.WriteOffListPage })))
const WriteOffFormPage = lazy(() => import('./pages').then((m) => ({ default: m.WriteOffFormPage })))
const WriteOffDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.WriteOffDetailPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}
    >
      {children}
    </Suspense>
  )
}

export const inventoryRoutes: RouteObject[] = [
  { path: 'inventory', element: <Lazy><InventoryHubPage /></Lazy> },
  { path: 'inventory/stock', element: <Lazy><StockOnHandPage /></Lazy> },
  { path: 'inventory/transfers', element: <Lazy><WarehouseTransferListPage /></Lazy> },
  { path: 'inventory/transfers/new', element: <Lazy><WarehouseTransferFormPage /></Lazy> },
  { path: 'inventory/transfers/:id', element: <Lazy><WarehouseTransferDetailPage /></Lazy> },
  { path: 'inventory/counts', element: <Lazy><StockCountSessionListPage /></Lazy> },
  { path: 'inventory/counts/:id', element: <Lazy><StockCountSessionPage /></Lazy> },
  { path: 'inventory/write-offs', element: <Lazy><WriteOffListPage /></Lazy> },
  { path: 'inventory/write-offs/new', element: <Lazy><WriteOffFormPage /></Lazy> },
  { path: 'inventory/write-offs/:id', element: <Lazy><WriteOffDetailPage /></Lazy> },
]
