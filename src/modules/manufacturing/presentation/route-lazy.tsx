/**
 * Lazily-loaded page components + the local Suspense boundary used by
 * `routes.tsx`. Kept in its own file so `routes.tsx` exports only the plain
 * `manufacturingRoutes` array (oxlint `react/only-export-components`).
 */
import { lazy, Suspense, type ReactNode } from 'react'

export const ManufacturingHubPage = lazy(() =>
  import('./pages/ManufacturingHubPage').then((m) => ({ default: m.ManufacturingHubPage })),
)
export const ProductionRequestListPage = lazy(() =>
  import('./pages/ProductionRequestListPage').then((m) => ({
    default: m.ProductionRequestListPage,
  })),
)
export const ProductionRequestFormPage = lazy(() =>
  import('./pages/ProductionRequestFormPage').then((m) => ({
    default: m.ProductionRequestFormPage,
  })),
)
export const ProductionRequestDetailPage = lazy(() =>
  import('./pages/ProductionRequestDetailPage').then((m) => ({
    default: m.ProductionRequestDetailPage,
  })),
)
export const ProductionBatchListPage = lazy(() =>
  import('./pages/ProductionBatchListPage').then((m) => ({ default: m.ProductionBatchListPage })),
)
export const ProductionBatchFormPage = lazy(() =>
  import('./pages/ProductionBatchFormPage').then((m) => ({ default: m.ProductionBatchFormPage })),
)
export const ProductionBatchDetailPage = lazy(() =>
  import('./pages/ProductionBatchDetailPage').then((m) => ({
    default: m.ProductionBatchDetailPage,
  })),
)

export function Boundary({ children }: { children: ReactNode }) {
  return <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>{children}</Suspense>
}
