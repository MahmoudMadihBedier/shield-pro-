/**
 * Thin wrappers binding the shared submittable-document hooks
 * (`@/shared/documents`) to the two `manufacturing` repos, so screens import one
 * local hook instead of repeating the repo argument.
 */
import {
  useDocument,
  useDocumentActions,
  useDocumentList,
  type DocumentListParams,
} from '@/shared/documents'

import { productionBatchesRepo, productionRequestsRepo } from '../../data/repos'

export function useProductionRequestList(params: DocumentListParams = {}) {
  return useDocumentList(productionRequestsRepo, params)
}

export function useProductionRequest(id: string | undefined) {
  return useDocument(productionRequestsRepo, id)
}

export function useProductionRequestActions() {
  return useDocumentActions(productionRequestsRepo)
}

export function useProductionBatchList(params: DocumentListParams = {}) {
  return useDocumentList(productionBatchesRepo, params)
}

export function useProductionBatch(id: string | undefined) {
  return useDocument(productionBatchesRepo, id)
}

export function useProductionBatchActions() {
  return useDocumentActions(productionBatchesRepo)
}
