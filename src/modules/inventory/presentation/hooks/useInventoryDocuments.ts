/**
 * Thin bindings of the shared submittable-document hooks
 * (`src/shared/documents`) to the three inventory doc repos. Presentation code
 * calls these instead of passing a repo around.
 */
import {
  useDocument,
  useDocumentActions,
  useDocumentList,
  type DocumentListParams,
} from '@/shared/documents'

import {
  stockCountSessionsRepo,
  warehouseTransfersRepo,
  writeOffsRepo,
} from '../../data/document-repos'

// --- warehouse transfers --------------------------------------------------

export const useWarehouseTransferList = (params: DocumentListParams = {}) =>
  useDocumentList(warehouseTransfersRepo, params)

export const useWarehouseTransfer = (id: string | undefined) =>
  useDocument(warehouseTransfersRepo, id)

export const useWarehouseTransferActions = () => useDocumentActions(warehouseTransfersRepo)

// --- stock count sessions ----------------------------------------------------

export const useStockCountSessionList = (params: DocumentListParams = {}) =>
  useDocumentList(stockCountSessionsRepo, params)

export const useStockCountSession = (id: string | undefined) =>
  useDocument(stockCountSessionsRepo, id)

export const useStockCountSessionActions = () => useDocumentActions(stockCountSessionsRepo)

// --- write-offs -----------------------------------------------------------

export const useWriteOffList = (params: DocumentListParams = {}) =>
  useDocumentList(writeOffsRepo, params)

export const useWriteOff = (id: string | undefined) => useDocument(writeOffsRepo, id)

export const useWriteOffActions = () => useDocumentActions(writeOffsRepo)
