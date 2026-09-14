/**
 * Customer detail view. Today this only hosts the CRM client-portal account
 * panel (create / reset PIN / revoke) — everything else about the customer
 * (name, discount, credit limit, …) is still edited from the customers list's
 * dialog. `PortalAccountPanel` itself lives in `@/modules/crm` (built there so
 * the CRM module owns its own UI); this page just mounts it.
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import { googleMapsUrl } from '@/core/geo'
import { hasRole, isSystemAdmin, Role } from '@/core/rbac'
import { isErr } from '@/core/result'
import { adminSetStatus, assignCustomerRep } from '@/infrastructure/appwrite/functions'
// Leaf imports (not the `@/modules/crm` barrel) so this page doesn't pull the
// whole CRM module — portal pages, admin hooks, everything — into its chunk.
import { CustomerActivityLog } from '@/modules/crm/admin/CustomerActivityLog'
import { CustomerFollowupList } from '@/modules/crm/admin/CustomerFollowupList'
import { PortalAccountPanel } from '@/modules/crm/admin/PortalAccountPanel'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { customersRepo } from '../../data/repos'
import { usersRepo } from '../../data/users-repo'
import type { Customer } from '../../domain/schemas'

const SALES_REP_ROLE = 'sales_rep'

/** Active sales reps in `branchId`, for the "assign to rep" picker. */
function useBranchRepOptions(branchId: string) {
  return useQuery<{ value: string; label: string }[], AppError>({
    queryKey: ['admin', 'options', 'branch-reps', branchId],
    enabled: branchId !== '',
    staleTime: 30_000,
    queryFn: async () => {
      const res = await usersRepo.list({
        page: 0,
        pageSize: 300,
        sort: { field: 'full_name', dir: 'asc' },
        filters: [{ field: 'branch_id', value: branchId }],
      })
      if (isErr(res)) throw res.error
      return res.value.rows
        .filter((row) => row.is_active && (row.roles ?? '').includes(SALES_REP_ROLE))
        .map((row) => ({ value: row.$id, label: row.full_name }))
    },
  })
}

/**
 * Fixes a real access bug: a sales rep could see every customer in their
 * branch, not just their own. `assigned_rep_user_id` (migration 0039) locks a
 * customer to one rep once set; System Admin / Branch Accountant / Chief
 * Accountant assign it here — the server enforces who may call the RPC, this
 * is only the affordance.
 */
function RepAssignmentCard({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const reps = useBranchRepOptions(customer.branch_id)
  const [choice, setChoice] = useState<string>(customer.assigned_rep_user_id ?? '')
  const mutation = useMutation<unknown, AppError, string>({
    mutationFn: async (repUserId) => {
      const res = await assignCustomerRep(customer.$id, repUserId || null)
      if (isErr(res)) throw res.error
      return res.value
    },
    onSuccess: onDone,
  })
  const currentLabel = reps.data?.find((r) => r.value === customer.assigned_rep_user_id)?.label

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm font-semibold">المندوب المسؤول / Assigned rep</span>
        <span className="text-xs text-zinc-500">
          {customer.assigned_rep_user_id
            ? (currentLabel ?? customer.assigned_rep_user_id)
            : 'غير محدد — يظهر لكل مندوبي الفرع'}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm"
          value={choice}
          disabled={reps.isLoading}
          onChange={(e) => setChoice(e.target.value)}
        >
          <option value="">— بدون مندوب —</option>
          {(reps.data ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Button
          size="sm"
          disabled={mutation.isPending || choice === (customer.assigned_rep_user_id ?? '')}
          onClick={() => mutation.mutate(choice)}
        >
          {mutation.isPending ? 'جارٍ الحفظ…' : 'حفظ'}
        </Button>
      </div>
      {mutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {mutation.error.message}
        </p>
      ) : null}
    </Card>
  )
}

/**
 * A pending customer can't be invoiced (`useCustomerOptions` in `sales` filters
 * to `approved`). This flips `approval_state` via `admin_set_status` — audited,
 * admin-only (the whole `/admin/*` tree is gated).
 */
function ApprovalCard({ customer, onDone }: { customer: Customer; onDone: () => void }) {
  const mutation = useMutation<unknown, AppError, void>({
    mutationFn: async () => {
      const res = await adminSetStatus(
        'customers',
        customer.$id,
        { approval_state: 'approved' },
        'اعتماد العميل يدويًا من صفحة العميل',
      )
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: onDone,
  })
  const approved = customer.approval_state === 'approved'

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm">
        <span className="font-semibold">حالة الاعتماد / Approval</span>
        <Badge tone={approved ? 'success' : 'warning'}>
          {approved ? 'معتمد' : 'بانتظار الاعتماد'}
        </Badge>
        {!approved ? (
          <span className="text-xs text-zinc-500">لن يظهر العميل في المبيعات قبل الاعتماد.</span>
        ) : null}
      </div>
      {!approved ? (
        <Button size="sm" disabled={mutation.isPending} onClick={() => mutation.mutate()}>
          {mutation.isPending ? 'جارٍ الاعتماد…' : 'اعتماد العميل'}
        </Button>
      ) : null}
      {mutation.isError ? (
        <p role="alert" className="w-full text-xs text-red-600 dark:text-red-400">
          {mutation.error.message}
        </p>
      ) : null}
    </Card>
  )
}

/**
 * The customer form captures `geo` on create/edit (`MasterFormPanel`'s
 * `GeoField`), but until now there was nowhere to see it again afterwards —
 * only the edit dialog ever rendered the "open in Google Maps" link.
 */
function GeoCard({ geo }: { geo: string | null | undefined }) {
  const mapsUrl = googleMapsUrl(geo)
  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <span className="text-sm font-semibold">الموقع الجغرافي / Location</span>
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          dir="ltr"
          className="text-sm text-blue-600 underline dark:text-blue-400"
        >
          {geo} — عرض على خرائط Google
        </a>
      ) : (
        <span className="text-xs text-zinc-500">لا يوجد موقع مسجّل لهذا العميل.</span>
      )}
    </Card>
  )
}

export function CustomerDetailPage() {
  const { id: customerId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { principal } = useAuth()
  // The route now also admits BranchAccountant / ChiefAccountant / SalesRep
  // (widened for the CRM panels below), but `admin_set_status` and
  // `assign_customer_rep` / the portal-account Function stay narrower — hide
  // the actions those roles would only get a 403 from (claude.md A.6).
  const canApprove = principal != null && isSystemAdmin(principal)
  const canManageRepAndPortal =
    principal != null &&
    (isSystemAdmin(principal) ||
      hasRole(principal, Role.BranchAccountant) ||
      hasRole(principal, Role.ChiefAccountant))

  const customerQuery = useQuery<Customer, AppError>({
    queryKey: queryKeys.admin.detail('customer', customerId),
    enabled: customerId !== '',
    queryFn: async () => {
      const result = await customersRepo.get(customerId)
      if (isErr(result)) throw result.error
      return result.value
    },
  })

  return (
    <div className="space-y-4">
      <PageHeader
        title={`العميل${customerQuery.data ? ` — ${customerQuery.data.name}` : ''}`}
        titleEn="Customer"
        actions={
          <Button variant="ghost" onClick={() => navigate('/admin/customers')}>
            رجوع
          </Button>
        }
      />

      {customerQuery.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : customerQuery.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">
          {customerQuery.error.message}
        </Card>
      ) : customerQuery.data ? (
        <>
          {canApprove ? (
            <ApprovalCard
              customer={customerQuery.data}
              onDone={() =>
                void queryClient.invalidateQueries({
                  queryKey: queryKeys.admin.detail('customer', customerId),
                })
              }
            />
          ) : null}
          <GeoCard geo={customerQuery.data.geo} />
          {canManageRepAndPortal ? (
            <RepAssignmentCard
              // Force a remount on navigation between customers — React
              // Router doesn't remount this page on a `:id` change alone, and
              // `choice` is seeded from props via `useState` (only runs once).
              key={customerQuery.data.$id}
              customer={customerQuery.data}
              onDone={() =>
                void queryClient.invalidateQueries({
                  queryKey: queryKeys.admin.detail('customer', customerId),
                })
              }
            />
          ) : null}
          {canManageRepAndPortal ? (
            <PortalAccountPanel
              customer={customerQuery.data}
              onChanged={() => {
                void queryClient.invalidateQueries({
                  queryKey: queryKeys.admin.detail('customer', customerId),
                })
              }}
            />
          ) : null}
          <CustomerFollowupList customer={customerQuery.data} />
          <CustomerActivityLog customer={customerQuery.data} />
        </>
      ) : (
        <Card className="text-sm text-zinc-500">العميل غير موجود</Card>
      )}
    </div>
  )
}
