/**
 * Credit-limit hooks (Story 2.5): a live check for the invoice form and the
 * admin override mutation for a blocked draft.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { queryKeys } from '@/application/query/keys'

import {
  checkCustomerCredit,
  recordCreditOverride,
  type CreditCheckResult,
  type CreditOverrideResult,
} from '../../data/credit-ops'
import { salesKeys } from '../query-keys'

/**
 * Live credit check for `customerId` against a prospective `newAmount`.
 * Disabled until a customer is chosen; refetches whenever the amount changes.
 */
export function useCustomerCreditCheck(customerId: string | undefined, newAmount: number) {
  return useQuery<CreditCheckResult, AppError>({
    queryKey: salesKeys.credit.check(customerId ?? '', newAmount),
    enabled: Boolean(customerId),
    queryFn: async () => {
      const res = await checkCustomerCredit(customerId as string, newAmount)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

/** Admin/Chief-Accountant override for a blocked over-limit draft invoice. */
export function useRecordCreditOverride() {
  const queryClient = useQueryClient()
  return useMutation<CreditOverrideResult, AppError, { invoiceRef: string; reason: string }>({
    mutationFn: async ({ invoiceRef, reason }) => {
      const res = await recordCreditOverride(invoiceRef, reason)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.root('sales_invoices') })
      void queryClient.invalidateQueries({ queryKey: salesKeys.root })
    },
  })
}
