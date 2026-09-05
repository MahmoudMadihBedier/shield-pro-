/**
 * Customer detail view. Today this only hosts the CRM client-portal account
 * panel (create / reset PIN / revoke) — everything else about the customer
 * (name, discount, credit limit, …) is still edited from the customers list's
 * dialog. `PortalAccountPanel` itself lives in `@/modules/crm` (built there so
 * the CRM module owns its own UI); this page just mounts it.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, useParams } from 'react-router-dom'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
// Leaf import (not the `@/modules/crm` barrel) so this page doesn't pull the
// whole CRM module — portal pages, admin hooks, everything — into its chunk.
import { PortalAccountPanel } from '@/modules/crm/admin/PortalAccountPanel'
import { Button, Card, PageHeader } from '@/shared/ui'

import { customersRepo } from '../../data/repos'
import type { Customer } from '../../domain/schemas'

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
        <PortalAccountPanel
          customer={customerQuery.data}
          onChanged={() => {
            void queryClient.invalidateQueries({
              queryKey: queryKeys.admin.detail('customer', customerId),
            })
          }}
        />
      ) : (
        <Card className="text-sm text-zinc-500">العميل غير موجود</Card>
      )}
    </div>
  )
}
