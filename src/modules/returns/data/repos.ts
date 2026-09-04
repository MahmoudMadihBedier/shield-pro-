/**
 * Submittable-document repository for the `returns` module, built from the
 * shared `makeDocumentRepo` factory (`src/shared/documents`). Gives the module
 * typed `list` / `get` / `createDraft` / `updateDraft` / `submit` / `cancel`
 * operations whose lifecycle calls route through `shield-server`.
 *
 * The `status` field (pending / approved / rejected) is advanced with
 * `updateDraft` while the row is still a Draft — there is no dedicated Function
 * route for it — then `submit` locks the row once it has been approved.
 */
import { makeDocumentRepo, type DocumentRepo } from '@/shared/documents'

import { returnRequestRowSchema, type ReturnRequestRow, type ReturnRequestWriteFields } from '../domain/schemas'

export const returnRequestsRepo: DocumentRepo<ReturnRequestRow, ReturnRequestWriteFields> =
  makeDocumentRepo({
    entity: 'ReturnRequest',
    rowSchema: returnRequestRowSchema,
  })
