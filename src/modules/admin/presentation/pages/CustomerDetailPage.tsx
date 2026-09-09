/**
 * Customer detail view. Today this only hosts the CRM client-portal account
 * panel (create / reset PIN / revoke) — everything else about the customer
 * (name, discount, credit limit, …) is still edited from the customers list's
 * dialog. `PortalAccountPanel` itself lives in `@/modules/crm` (built there so
 * the CRM module owns its own UI); this page just mounts it.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { adminSetStatus } from '@/infrastructure/appwrite/functions'
// Leaf imports (not the `@/modules/crm` barrel) so this page doesn't pull the
// whole CRM module — portal pages, admin hooks, everything — into its chunk.
import { CustomerActivityLog } from '@/modules/crm/admin/CustomerActivityLog'
import { PortalAccountPanel } from '@/modules/crm/admin/PortalAccountPanel'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { customersRepo } from '../../data/repos'
import type { Customer } from '../../domain/schemas'

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

export function CustomerDetailPage() {
  const { id: customerId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

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
          <ApprovalCard
            customer={customerQuery.data}
            onDone={() =>
              void queryClient.invalidateQueries({
                queryKey: queryKeys.admin.detail('customer', customerId),
              })
            }
          />
          <PortalAccountPanel
            customer={customerQuery.data}
            onChanged={() => {
              void queryClient.invalidateQueries({
                queryKey: queryKeys.admin.detail('customer', customerId),
              })
            }}
          />
          <CustomerActivityLog customer={customerQuery.data} />
        </>
      ) : (
        <Card className="text-sm text-zinc-500">العميل غير موجود</Card>
      )}
    </div>
  )
}
