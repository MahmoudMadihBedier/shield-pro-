/**
 * Submittable-document repositories for the `sales` module, built from the
 * shared `makeDocumentRepo` factory (`src/shared/documents`). Each gives the
 * module typed `list` / `get` / `createDraft` / `updateDraft` / `submit` /
 * `cancel` operations whose lifecycle calls route through `shield-server`.
 *
 * The workflow `status` field (rep issue approve/reject, close-out
 * submit/confirm) is advanced with `updateDraft` while the row is still a Draft;
 * `submit` then locks the row once the workflow completes.
 */
import { makeDocumentRepo, type DocumentRepo } from '@/shared/documents'

import {
  repCloseoutRowSchema,
  repStockIssueRowSchema,
  salesInvoiceRowSchema,
  type RepCloseoutRow,
  type RepCloseoutWriteFields,
  type RepStockIssueRow,
  type RepStockIssueWriteFields,
  type SalesInvoiceRow,
  type SalesInvoiceWriteFields,
} from '../domain/schemas'

export const salesInvoicesRepo: DocumentRepo<SalesInvoiceRow, SalesInvoiceWriteFields> =
  makeDocumentRepo({
    entity: 'SalesInvoice',
    rowSchema: salesInvoiceRowSchema,
  })

export const repStockIssuesRepo: DocumentRepo<RepStockIssueRow, RepStockIssueWriteFields> =
  makeDocumentRepo({
    entity: 'RepStockIssue',
    rowSchema: repStockIssueRowSchema,
  })

export const repCloseoutsRepo: DocumentRepo<RepCloseoutRow, RepCloseoutWriteFields> =
  makeDocumentRepo({
    entity: 'RepCloseout',
    rowSchema: repCloseoutRowSchema,
  })
