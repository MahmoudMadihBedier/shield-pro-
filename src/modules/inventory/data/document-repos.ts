/**
 * Submittable-document repositories for the `inventory` module, built from the
 * shared `makeDocumentRepo` factory (`src/shared/documents`). Each gives the
 * module typed `list` / `get` / `createDraft` / `updateDraft` / `submit` /
 * `cancel` operations whose lifecycle calls route through `shield-server`.
 *
 * The workflow `status` field (transfer / count session) is advanced with
 * `updateDraft` while the row is still a Draft — there is no dedicated Function
 * route for it — then `submit` locks the row once the workflow completes.
 */
import { makeDocumentRepo, type DocumentRepo } from '@/shared/documents'

import {
  stockCountSessionRowSchema,
  warehouseTransferRowSchema,
  writeOffRowSchema,
  type StockCountSessionRow,
  type StockCountSessionWriteFields,
  type WarehouseTransferRow,
  type WarehouseTransferWriteFields,
  type WriteOffRow,
  type WriteOffWriteFields,
} from '../domain/schemas'

export const warehouseTransfersRepo: DocumentRepo<
  WarehouseTransferRow,
  WarehouseTransferWriteFields
> = makeDocumentRepo({
  entity: 'WarehouseTransfer',
  rowSchema: warehouseTransferRowSchema,
})

export const stockCountSessionsRepo: DocumentRepo<
  StockCountSessionRow,
  StockCountSessionWriteFields
> = makeDocumentRepo({
  entity: 'StockCountSession',
  rowSchema: stockCountSessionRowSchema,
})

export const writeOffsRepo: DocumentRepo<WriteOffRow, WriteOffWriteFields> = makeDocumentRepo({
  entity: 'WriteOff',
  rowSchema: writeOffRowSchema,
})
