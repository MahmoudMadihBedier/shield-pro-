import { lazy, Suspense, type ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'

import { Role } from '@/core/rbac'
// Import the leaf route manifests, not the module barrels — the barrels
// statically pull every page + repo into the main chunk and defeat the split.
import { accountingRoutes } from '@/modules/accounting/presentation/routes'
import { approvalsRoutes } from '@/modules/approvals/presentation/routes'
import { portalRoutes } from '@/modules/crm/portal/routes'
import { fraudRoutes } from '@/modules/fraud/routes'
import { returnsRoutes } from '@/modules/returns/presentation/routes'
import { salesRoutes } from '@/modules/sales/presentation/routes'
import { inventoryRoutes } from '@/modules/inventory/presentation/routes'
import { manufacturingRoutes } from '@/modules/manufacturing/presentation/routes'
import { purchasingRoutes } from '@/modules/purchasing/routes'
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

const AdminHomePage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.AdminHomePage })),
)
const BranchesListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.BranchesListPage })),
)
const WarehousesListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.WarehousesListPage })),
)
const UsersListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.UsersListPage })),
)
const ProductsListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.ProductsListPage })),
)
const ProductDetailPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.ProductDetailPage })),
)
const RawMaterialsListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.RawMaterialsListPage })),
)
const SuppliersListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.SuppliersListPage })),
)
const CustomersListPage = lazy(() =>
  import('@/modules/admin').then((m) => ({ default: m.CustomersListPage })),
)

const NO_ADMIN_ACCESS = (
  <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300">
    هذه الصفحة مخصّصة لمسؤول النظام فقط.
  </div>
)

function AdminRoute({ children }: { children: ReactNode }) {
  return (
    <RequireRole anyOf={[Role.SystemAdmin]} fallback={NO_ADMIN_ACCESS}>
      <Lazy>{children}</Lazy>
    </RequireRole>
  )
}

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
      { path: 'admin', element: <AdminRoute><AdminHomePage /></AdminRoute> },
      { path: 'admin/branches', element: <AdminRoute><BranchesListPage /></AdminRoute> },
      { path: 'admin/warehouses', element: <AdminRoute><WarehousesListPage /></AdminRoute> },
      { path: 'admin/users', element: <AdminRoute><UsersListPage /></AdminRoute> },
      { path: 'admin/products', element: <AdminRoute><ProductsListPage /></AdminRoute> },
      { path: 'admin/products/:id', element: <AdminRoute><ProductDetailPage /></AdminRoute> },
      { path: 'admin/raw-materials', element: <AdminRoute><RawMaterialsListPage /></AdminRoute> },
      { path: 'admin/suppliers', element: <AdminRoute><SuppliersListPage /></AdminRoute> },
      { path: 'admin/customers', element: <AdminRoute><CustomersListPage /></AdminRoute> },

      // Business modules — each ships its own lazy+Suspense route objects; role
      // gating for these lives in-page (SubmitCancelBar etc.) and server-side.
      ...purchasingRoutes,
      ...manufacturingRoutes,
      ...inventoryRoutes,
      ...accountingRoutes,
      ...salesRoutes,
      ...returnsRoutes,
      ...fraudRoutes,
      ...approvalsRoutes,
    ],
  },
  // CRM client portal — a sibling branch with its own layout/auth gate, NOT
  // nested under the staff AppLayout route above.
  ...portalRoutes,
])
