/**
 * Hooks for the customer-aging report and a single-customer drill-in.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  customerAgingReport,
  customerStatement,
  listReceiptsForCustomer,
  listSubmittedInvoices,
  type CustomerAgingRow,
} from '../../data/aging-repo'
import type { CustomerStatement } from '../../domain/statement'
import type { InvoiceForAging } from '../../domain/schemas'
import type { Receipt } from '../../domain/schemas'
import { accountingKeys } from '../query-keys'

/** `asOf` is normalised to a day key so the cache is stable within a day. */
export function useCustomerAging(asOf: Date) {
  const dayKey = asOf.toISOString().slice(0, 10)
  return useQuery<CustomerAgingRow[], AppError>({
    queryKey: accountingKeys.aging.report(dayKey),
    queryFn: async () => {
      const res = await customerAgingReport(asOf)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export interface CustomerLedger {
  invoices: InvoiceForAging[]
  receipts: Receipt[]
}

/** The submitted invoices + receipts behind one customer's aging row. */
export function useCustomerLedger(customerId: string | undefined) {
  return useQuery<CustomerLedger, AppError>({
    queryKey: accountingKeys.aging.customer(customerId ?? ''),
    enabled: Boolean(customerId),
    queryFn: async () => {
      const [invoices, receipts] = await Promise.all([
        listSubmittedInvoices({ customerId }),
        listReceiptsForCustomer(customerId as string),
      ])
      if (!invoices.ok) throw invoices.error
      if (!receipts.ok) throw receipts.error
      return { invoices: invoices.value, receipts: receipts.value }
    },
  })
}

export interface StatementRange {
  from?: string
  to?: string
}

/** One customer's running-balance account statement over an optional range. */
export function useCustomerStatement(customerId: string | undefined, range: StatementRange = {}) {
  return useQuery<CustomerStatement, AppError>({
    queryKey: accountingKeys.aging.statement(customerId ?? '', range),
    enabled: Boolean(customerId),
    queryFn: async () => {
      const res = await customerStatement(customerId as string, range)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}
