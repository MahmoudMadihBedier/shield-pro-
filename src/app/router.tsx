import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { Role } from '@/core/rbac'
import { RequireAuth } from '@/presentation/components/RequireAuth'
import { RequireRole } from '@/presentation/components/RequireRole'
import { AppLayout } from '@/presentation/layout/AppLayout'

const LoginPage = lazy(() =>
  import('@/presentation/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const HomePage = lazy(() =>
  import('@/presentation/pages/HomePage').then((m) => ({ default: m.HomePage })),
)
const TraceabilityPage = lazy(() =>
  import('@/modules/traceability').then((m) => ({ default: m.TraceabilityPage })),
)
const AuditLogPage = lazy(() =>
  import('@/modules/traceability').then((m) => ({ default: m.AuditLogPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-zinc-500">
          Loading…
        </div>
      }
    >
      {children}
    </Suspense>
  )
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Lazy>
        <LoginPage />
      </Lazy>
    ),
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <HomePage />
          </Lazy>
        ),
      },
      {
        path: 'traceability',
        element: (
          <Lazy>
            <TraceabilityPage />
          </Lazy>
        ),
      },
      {
        path: 'audit-log',
        element: (
          <RequireRole
            anyOf={[Role.SystemAdmin, Role.ChiefAccountant]}
            fallback={
              <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
                لا تملك صلاحية عرض سجل التدقيق.
              </div>
            }
          >
            <Lazy>
              <AuditLogPage />
            </Lazy>
          </RequireRole>
        ),
      },
    ],
  },
])
