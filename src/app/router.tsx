import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { RequireAuth } from '@/presentation/components/RequireAuth'
import { AppLayout } from '@/presentation/layout/AppLayout'

const LoginPage = lazy(() =>
  import('@/presentation/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const HomePage = lazy(() =>
  import('@/presentation/pages/HomePage').then((m) => ({ default: m.HomePage })),
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
    ],
  },
])
