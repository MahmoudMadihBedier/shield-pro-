/**
 * TanStack Query bindings for the customer-facing portal data routes. Every
 * read goes through a `shield-server` Function wrapper
 * (`@/infrastructure/appwrite/functions`) — never a raw `tablesDB` read (see
 * the module's security model notes in `functions/routes/portal-data.ts`).
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  getPortalInvoiceDetail,
  listPortalInvoices,
  listPortalReceipts,
  type PortalInvoiceDetailResult,
  type PortalInvoiceListPayload,
  type PortalInvoiceListResult,
  type PortalReceiptListPayload,
  type PortalReceiptListResult,
} from '@/infrastructure/appwrite/functions'

import { portalKeys } from '../query-keys'

export function usePortalInvoices(params: PortalInvoiceListPayload = {}) {
  return useQuery<PortalInvoiceListResult, AppError>({
    queryKey: portalKeys.invoices(params),
    queryFn: async () => {
      const result = await listPortalInvoices(params)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export function usePortalInvoiceDetail(invoiceId: string | undefined) {
  return useQuery<PortalInvoiceDetailResult, AppError>({
    queryKey: portalKeys.invoice(invoiceId ?? ''),
    queryFn: async () => {
      const result = await getPortalInvoiceDetail({ invoiceId: invoiceId as string })
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
      const result = await listPortalReceipts(params)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}
