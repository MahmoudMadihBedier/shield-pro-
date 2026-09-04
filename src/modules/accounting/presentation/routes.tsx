/**
 * Route manifest for the `accounting` module — relative child route objects to
 * be spread into the app router's authenticated layout route. Every page is
 * `React.lazy` so each screen is its own chunk (`claude.md` B.7).
 *
 * This module only *declares* the routes; wiring them into `src/app/router.tsx`
 * is the app shell's job.
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

const AccountingHubPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.AccountingHubPage })),
)
const ReceiptListPage = lazy(() => import('./pages').then((m) => ({ default: m.ReceiptListPage })))
const ReceiptFormPage = lazy(() => import('./pages').then((m) => ({ default: m.ReceiptFormPage })))
const ReceiptDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.ReceiptDetailPage })),
)
const PaymentVoucherListPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.PaymentVoucherListPage })),
)
const PaymentVoucherFormPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.PaymentVoucherFormPage })),
)
const PaymentVoucherDetailPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.PaymentVoucherDetailPage })),
)
const CustomerAgingPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.CustomerAgingPage })),
)
const TrialBalancePage = lazy(() =>
  import('./pages').then((m) => ({ default: m.TrialBalancePage })),
)
const GeneralLedgerPage = lazy(() =>
  import('./pages').then((m) => ({ default: m.GeneralLedgerPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const accountingRoutes: RouteObject[] = [
  {
    path: 'accounting',
    element: (
      <Lazy>
        <AccountingHubPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/receipts',
    element: (
      <Lazy>
        <ReceiptListPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/receipts/new',
    element: (
      <Lazy>
        <ReceiptFormPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/receipts/:id',
    element: (
      <Lazy>
        <ReceiptDetailPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/vouchers',
    element: (
      <Lazy>
        <PaymentVoucherListPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/vouchers/new',
    element: (
      <Lazy>
        <PaymentVoucherFormPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/vouchers/:id',
    element: (
      <Lazy>
        <PaymentVoucherDetailPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/aging',
    element: (
      <Lazy>
        <CustomerAgingPage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/trial-balance',
    element: (
      <Lazy>
        <TrialBalancePage />
      </Lazy>
    ),
  },
  {
    path: 'accounting/ledger',
    element: (
      <Lazy>
        <GeneralLedgerPage />
      </Lazy>
    ),
  },
]
