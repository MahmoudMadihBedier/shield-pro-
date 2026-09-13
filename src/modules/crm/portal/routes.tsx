/**
 * Route manifest for the CRM client portal — TOP-LEVEL, absolute-path routes.
 * Unlike every staff module's route manifest (relative children spread into
 * `AppLayout`'s route), these are NOT children of the staff layout route: the
 * portal is a sibling branch with its own layout, its own auth gate, and no
 * staff nav. The app shell attaches `portalRoutes` directly into the router's
 * top-level route array (see `index.ts` for the exact wiring note).
 */
// oxlint-disable react/only-export-components -- route-manifest module, not a component file
import { lazy, Suspense, type ReactNode } from 'react'
import type { RouteObject } from 'react-router-dom'

import { RequirePortalAuth } from './components/RequirePortalAuth'

// The one login page for both staff and portal (see its own doc comment).
// `router.tsx` lazy-loads the same module specifier for `/login` — the
// bundler resolves both `lazy()` wrappers to one shared chunk, so this is
// NOT a second copy; a static import here would instead pull the whole page
// (RHF, zod, the portal form) eagerly into the main bundle, since this route
// manifest is imported statically at the top of `router.tsx`.
const LoginPage = lazy(() =>
  import('@/presentation/pages/LoginPage').then((m) => ({ default: m.LoginPage })),
)
const PortalLayout = lazy(() =>
  import('./pages/PortalLayout').then((m) => ({ default: m.PortalLayout })),
)
const PortalHomePage = lazy(() =>
  import('./pages/PortalHomePage').then((m) => ({ default: m.PortalHomePage })),
)
const PortalInvoicesPage = lazy(() =>
  import('./pages/PortalInvoicesPage').then((m) => ({ default: m.PortalInvoicesPage })),
)
const PortalInvoiceDetailPage = lazy(() =>
  import('./pages/PortalInvoiceDetailPage').then((m) => ({ default: m.PortalInvoiceDetailPage })),
)
const PortalStatementPage = lazy(() =>
  import('./pages/PortalStatementPage').then((m) => ({ default: m.PortalStatementPage })),
)
const PortalChangePinPage = lazy(() =>
  import('./pages/PortalChangePinPage').then((m) => ({ default: m.PortalChangePinPage })),
)

function Lazy({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-zinc-500">جارٍ التحميل…</div>}>
      {children}
    </Suspense>
  )
}

export const portalRoutes: RouteObject[] = [
  {
    path: '/portal/login',
    element: (
      <Lazy>
        <LoginPage initialMode="portal" />
      </Lazy>
    ),
  },
  {
    path: '/portal',
    element: (
      <RequirePortalAuth>
        <Lazy>
          <PortalLayout />
        </Lazy>
      </RequirePortalAuth>
    ),
    children: [
      {
        index: true,
        element: (
          <Lazy>
            <PortalHomePage />
          </Lazy>
        ),
      },
      {
        path: 'invoices',
        element: (
          <Lazy>
            <PortalInvoicesPage />
          </Lazy>
        ),
      },
      {
        path: 'invoices/:id',
        element: (
          <Lazy>
            <PortalInvoiceDetailPage />
          </Lazy>
        ),
      },
      {
        path: 'statement',
        element: (
          <Lazy>
            <PortalStatementPage />
          </Lazy>
        ),
      },
      {
        path: 'change-pin',
        element: (
          <Lazy>
            <PortalChangePinPage />
          </Lazy>
        ),
      },
    ],
  },
]
