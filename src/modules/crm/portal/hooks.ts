/**
 * TanStack Query bindings for the customer-facing portal reads. Every call runs
 * on the dedicated `portalSupabase` client via `infrastructure/appwrite/portal`
 * and hits a `portal_*` SECURITY DEFINER RPC that scopes to the caller's own
 * `customers` row — never a raw `tablesDB` read.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  portalInvoiceDetail,
  portalInvoices,
  portalReceipts,
  portalStatement,
  type PortalStatementResult,
} from '@/infrastructure/appwrite/portal'
import type {
  PortalInvoiceDetailResult,
  PortalInvoiceListPayload,
  PortalInvoiceListResult,
  PortalReceiptListPayload,
  PortalReceiptListResult,
} from '@/infrastructure/appwrite/functions'

import { portalKeys } from '../query-keys'

export function usePortalInvoices(params: PortalInvoiceListPayload = {}) {
  return useQuery<PortalInvoiceListResult, AppError>({
    queryKey: portalKeys.invoices(params),
    queryFn: async () => {
      const result = await portalInvoices(params)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export function usePortalInvoiceDetail(invoiceId: string | undefined) {
  return useQuery<PortalInvoiceDetailResult, AppError>({
    queryKey: portalKeys.invoice(invoiceId ?? ''),
    queryFn: async () => {
      const result = await portalInvoiceDetail(invoiceId as string)
      if (!result.ok) throw result.error
      return result.value
    },
    enabled: Boolean(invoiceId),
  })
}

export function usePortalReceipts(params: PortalReceiptListPayload = {}) {
  return useQuery<PortalReceiptListResult, AppError>({
    queryKey: portalKeys.receipts(params),
    queryFn: async () => {
      const result = await portalReceipts(params)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export function usePortalStatement() {
  return useQuery<PortalStatementResult, AppError>({
    queryKey: portalKeys.statement(),
    queryFn: async () => {
      const result = await portalStatement()
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
