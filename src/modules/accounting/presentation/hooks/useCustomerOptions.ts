/**
 * Option lists for the accounting pickers. Customers come from the `admin`
 * master-data repo (single source of truth — never re-declared here). The
 * submitted-invoice list feeds the receipt form's invoice-ref picker and
 * carries the customer + amount needed to pre-fill the form.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { customersRepo } from '@/modules/admin'
import type { SelectOption } from '@/shared/forms'

import { listSubmittedInvoices } from '../../data/aging-repo'
import { accountingKeys } from '../query-keys'

const MAX_ROWS = 200

export interface CustomerOption extends SelectOption {
  creditLimit: number
  branchId: string
}

export function useCustomerOptions() {
  return useQuery<CustomerOption[], AppError>({
    queryKey: accountingKeys.options.customers(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await customersRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({
        value: row.$id,
        label: `${row.code} — ${row.name}`,
        creditLimit: row.credit_limit,
        branchId: row.branch_id,
      }))
    },
  })
}

export interface SubmittedInvoiceOption {
  /** `reference_id` — what `receipts.invoice_ref` stores. */
  value: string
  label: string
  customerId: string
  amount: number
}

export function useSubmittedInvoiceOptions() {
  return useQuery<SubmittedInvoiceOption[], AppError>({
    queryKey: accountingKeys.options.submittedInvoices(),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await listSubmittedInvoices()
      if (!res.ok) throw res.error
      return res.value.map((inv) => ({
        value: inv.reference_id,
        label: inv.reference_id,
        customerId: inv.customer_id,
        amount: inv.net_total,
      }))
    },
  })
}
