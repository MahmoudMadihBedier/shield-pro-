/**
 * Shared shapes for the `purchasing` list hooks: the controlled list state the
 * pages hold, mapped onto the shared `DocumentListParams`.
 */
import type { DocumentListParams } from '@/shared/documents'
import type { DocStatus } from '@/core/doc-status'
import type { SortState } from '@/shared/data-table'

export interface PurchasingListParams {
  search?: string
  pageIndex: number
  pageSize: number
  sort?: SortState
  docStatus?: DocStatus
}

export function toDocumentListParams(params: PurchasingListParams): DocumentListParams {
  return {
    search: params.search?.trim() || undefined,
    page: params.pageIndex,
    pageSize: params.pageSize,
    docStatus: params.docStatus,
    sort: params.sort ? { column: params.sort.columnId, dir: params.sort.dir } : undefined,
  }
}
