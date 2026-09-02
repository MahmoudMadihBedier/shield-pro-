/**
 * Route element components for the `purchasing` module — each page is
 * `React.lazy` + `Suspense` (mirrors `src/app/router.tsx`). Kept separate from
 * `routes.tsx` so that file exports only the route-object array.
 */
import { lazy, Suspense, type ReactNode } from 'react'

const PurchasingHomePage = lazy(() =>
  import('./pages/PurchasingHomePage').then((m) => ({ default: m.PurchasingHomePage })),
)
const PurchaseOrderListPage = lazy(() =>
  import('./pages/PurchaseOrderListPage').then((m) => ({ default: m.PurchaseOrderListPage })),
)
const PurchaseOrderDetailPage = lazy(() =>
  import('./pages/PurchaseOrderDetailPage').then((m) => ({ default: m.PurchaseOrderDetailPage })),
)
const StockReceiptListPage = lazy(() =>
  import('./pages/StockReceiptListPage').then((m) => ({ default: m.StockReceiptListPage })),
)
const StockReceiptDetailPage = lazy(() =>
  import('./pages/StockReceiptDetailPage').then((m) => ({ default: m.StockReceiptDetailPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[40vh] items-center justify-center text-sm text-zinc-500">
          جارٍ التحميل…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export function PurchasingHomeRoute() {
  return (
    <Lazy>
      <PurchasingHomePage />
    </Lazy>
  )
}

export function PurchaseOrderListRoute() {
  return (
    <Lazy>
      <PurchaseOrderListPage />
    </Lazy>
  )
}

export function PurchaseOrderDetailRoute() {
  return (
    <Lazy>
      <PurchaseOrderDetailPage />
    </Lazy>
  )
}

export function StockReceiptListRoute() {
  return (
    <Lazy>
      <StockReceiptListPage />
    </Lazy>
  )
}

export function StockReceiptDetailRoute() {
  return (
    <Lazy>
      <StockReceiptDetailPage />
    </Lazy>
  )
}
