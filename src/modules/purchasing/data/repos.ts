/**
 * Data layer for the `purchasing` documents. Both are ERPNext-style submittable
 * documents, so they are built from the shared `makeDocumentRepo` factory
 * (`@/shared/documents`) — which routes `createDraft` through
 * `/allocate-reference-id` and `submit` / `cancel` through `shield-server`.
 * This module adds no bespoke lifecycle.
 */
import { makeDocumentRepo } from '@/shared/documents'

import {
  purchaseOrderRowSchema,
  stockReceiptRowSchema,
  type PurchaseOrder,
  type PurchaseOrderDraft,
  type StockReceipt,
  type StockReceiptDraft,
} from '../domain/schemas'

export const purchaseOrdersRepo = makeDocumentRepo<PurchaseOrder, PurchaseOrderDraft>({
  entity: 'PurchaseOrder',
  rowSchema: purchaseOrderRowSchema,
})

export const stockReceiptsRepo = makeDocumentRepo<StockReceipt, StockReceiptDraft>({
  entity: 'StockReceipt',
  rowSchema: stockReceiptRowSchema,
})
