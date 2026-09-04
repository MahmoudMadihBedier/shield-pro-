/**
 * Thin bindings of the shared submittable-document hooks
 * (`src/shared/documents`) to the `returnRequestsRepo`. Presentation code calls
 * these instead of passing the repo around.
 */
import { useDocument, useDocumentActions, useDocumentList, type DocumentListParams } from '@/shared/documents'

import { returnRequestsRepo } from '../../data/repos'

export const useReturnRequestList = (params: DocumentListParams = {}) =>
  useDocumentList(returnRequestsRepo, params)

export const useReturnRequest = (id: string | undefined) => useDocument(returnRequestsRepo, id)

export const useReturnRequestActions = () => useDocumentActions(returnRequestsRepo)
