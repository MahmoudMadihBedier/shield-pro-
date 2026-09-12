import { lazy, Suspense, type ReactNode } from 'react'

const CrmHomePage = lazy(() =>
  import('./pages/CrmHomePage').then((m) => ({ default: m.CrmHomePage })),
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

export function CrmHomeRoute() {
  return (
    <Lazy>
      <CrmHomePage />
    </Lazy>
  )
}
