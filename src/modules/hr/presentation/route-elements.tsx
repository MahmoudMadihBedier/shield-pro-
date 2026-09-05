/**
 * Route element components for the `hr` module — each page is `React.lazy` +
 * `Suspense` (mirrors `src/app/router.tsx` / `src/modules/purchasing`). Kept
 * separate from `routes.tsx` so that file exports only the route-object array,
 * and imports leaf page files (not the barrel) so each screen is its own chunk.
 */
import { lazy, Suspense, type ReactNode } from 'react'

const HrHubPage = lazy(() => import('./pages/HrHubPage').then((m) => ({ default: m.HrHubPage })))
const AttendanceListPage = lazy(() =>
  import('./pages/AttendanceListPage').then((m) => ({ default: m.AttendanceListPage })),
)
const AttendanceSheetPage = lazy(() =>
  import('./pages/AttendanceSheetPage').then((m) => ({ default: m.AttendanceSheetPage })),
)
const IncentiveRulesListPage = lazy(() =>
  import('./pages/IncentiveRulesListPage').then((m) => ({ default: m.IncentiveRulesListPage })),
)
const PayrollRunListPage = lazy(() =>
  import('./pages/PayrollRunListPage').then((m) => ({ default: m.PayrollRunListPage })),
)
const PayrollRunFormPage = lazy(() =>
  import('./pages/PayrollRunFormPage').then((m) => ({ default: m.PayrollRunFormPage })),
)
const PayrollRunDetailPage = lazy(() =>
  import('./pages/PayrollRunDetailPage').then((m) => ({ default: m.PayrollRunDetailPage })),
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

export function HrHubRoute() {
  return (
    <Lazy>
      <HrHubPage />
    </Lazy>
  )
}

export function AttendanceListRoute() {
  return (
    <Lazy>
      <AttendanceListPage />
    </Lazy>
  )
}

export function AttendanceSheetRoute() {
  return (
    <Lazy>
      <AttendanceSheetPage />
    </Lazy>
  )
}

export function IncentiveRulesListRoute() {
  return (
    <Lazy>
      <IncentiveRulesListPage />
    </Lazy>
  )
}

export function PayrollRunListRoute() {
  return (
    <Lazy>
      <PayrollRunListPage />
    </Lazy>
  )
}

export function PayrollRunFormRoute() {
  return (
    <Lazy>
      <PayrollRunFormPage />
    </Lazy>
  )
}

export function PayrollRunDetailRoute() {
  return (
    <Lazy>
      <PayrollRunDetailPage />
    </Lazy>
  )
}
