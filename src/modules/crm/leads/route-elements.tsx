/**
 * Route element components for the CRM leads pipeline — `React.lazy` +
 * `Suspense` (mirrors `src/app/router.tsx`). Kept separate from `routes.tsx`
 * so that file exports only the route-object array.
 */
import { lazy, Suspense, type ReactNode } from 'react'

const LeadsListPage = lazy(() =>
  import('./pages/LeadsListPage').then((m) => ({ default: m.LeadsListPage })),
)
const LeadDetailPage = lazy(() =>
  import('./pages/LeadDetailPage').then((m) => ({ default: m.LeadDetailPage })),
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

export function LeadsListRoute() {
  return (
    <Lazy>
      <LeadsListPage />
    </Lazy>
  )
}

export function LeadDetailRoute() {
  return (
    <Lazy>
      <LeadDetailPage />
    </Lazy>
  )
}
