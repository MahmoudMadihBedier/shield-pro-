/**
 * Thin bindings of the shared submittable-document hooks
 * (`src/shared/documents`) to the three `sales` doc repos. Presentation code
 * calls these instead of passing a repo around.
 */
import {
  useDocument,
  useDocumentActions,
  useDocumentList,
  type DocumentListParams,
} from '@/shared/documents'

import { repCloseoutsRepo, repStockIssuesRepo, salesInvoicesRepo } from '../../data/repos'

// --- sales invoices -----------------------------------------------------------

export const useSalesInvoiceList = (params: DocumentListParams = {}) =>
  useDocumentList(salesInvoicesRepo, params)

export const useSalesInvoice = (id: string | undefined) => useDocument(salesInvoicesRepo, id)

export const useSalesInvoiceActions = () => useDocumentActions(salesInvoicesRepo)

// --- rep stock issues -------------------------------------------------------

export const useRepStockIssueList = (params: DocumentListParams = {}) =>
  useDocumentList(repStockIssuesRepo, params)

export const useRepStockIssue = (id: string | undefined) => useDocument(repStockIssuesRepo, id)

export const useRepStockIssueActions = () => useDocumentActions(repStockIssuesRepo)

// --- rep close-outs -------------------------------------------------------

export const useRepCloseoutList = (params: DocumentListParams = {}) =>
  useDocumentList(repCloseoutsRepo, params)

export const useRepCloseout = (id: string | undefined) => useDocument(repCloseoutsRepo, id)

export const useRepCloseoutActions = () => useDocumentActions(repCloseoutsRepo)
