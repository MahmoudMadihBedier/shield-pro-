/**
 * Data layer for the two `manufacturing` submittable documents. Both are plain
 * `makeDocumentRepo` instances — the shared lifecycle layer owns reference-id
 * allocation, Draft writes and the submit / cancel Function calls
 * (`@/shared/documents`). Nothing bespoke is needed here.
 */
import { makeDocumentRepo, type DocumentRepo } from '@/shared/documents'

import {
  productionBatchRowSchema,
  productionRequestRowSchema,
  type ProductionBatch,
  type ProductionBatchDraft,
  type ProductionRequest,
  type ProductionRequestDraft,
} from '../domain/schemas'

export const productionRequestsRepo: DocumentRepo<ProductionRequest, ProductionRequestDraft> =
  makeDocumentRepo<ProductionRequest, ProductionRequestDraft>({
    entity: 'ProductionRequest',
    rowSchema: productionRequestRowSchema,
  })

export const productionBatchesRepo: DocumentRepo<ProductionBatch, ProductionBatchDraft> =
  makeDocumentRepo<ProductionBatch, ProductionBatchDraft>({
    entity: 'ProductionBatch',
    rowSchema: productionBatchRowSchema,
  })
