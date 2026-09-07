/**
 * Customers list. Each row gets an "approve" action while the customer is still
 * pending (a pending customer can't be invoiced — `sales` filters its picker to
 * `approved`) plus a link to the detail view (CRM portal account + the same
 * approval control). Approval flips `approval_state` via `admin_set_status` —
 * audited, admin-only (the whole `/admin/*` tree is gated).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import { adminSetStatus } from '@/infrastructure/appwrite/functions'
import { Badge, Button } from '@/shared/ui'

import type { Customer } from '../../domain/schemas'
import { MasterListPage } from '../components/MasterListPage'

function CustomerRowActions({ row }: { row: Customer }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const approved = row.approval_state === 'approved'

  const approve = useMutation<unknown, AppError, void>({
    mutationFn: async () => {
      const res = await adminSetStatus(
        'customers',
        row.$id,
        { approval_state: 'approved' },
        'اعتماد العميل من قائمة العملاء',
      )
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.admin.root() }),
  })

  return (
    <>
      {approved ? (
        <Badge tone="success">معتمد</Badge>
      ) : (
        <Button size="sm" disabled={approve.isPending} onClick={() => approve.mutate()}>
          {approve.isPending ? 'جارٍ الاعتماد…' : 'اعتماد'}
        </Button>
      )}
      <Button size="sm" variant="secondary" onClick={() => navigate(`/admin/customers/${row.$id}`)}>
        تفاصيل
      </Button>
      {approve.isError ? (
        <span role="alert" className="w-full text-end text-xs text-red-600 dark:text-red-400">
          {approve.error.message}
        </span>
      ) : null}
    </>
  )
}

export function CustomersListPage() {
  return (
    <MasterListPage entity="customer" extraRowActions={(row) => <CustomerRowActions row={row} />} />
  )
}
