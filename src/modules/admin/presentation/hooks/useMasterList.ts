/**
 * Paged list query for any master-data entity. One hook, keyed via the central
 * query-key factory, used by every list page (`claude.md` — DRY per entity).
 */
import { useQuery, type UseQueryResult } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'

import type { ListFilter, ListPage, ListSort } from '../../data/master-repo'
import { ADMIN_REGISTRY, type AdminEntity, type AdminRowMap } from '../registry'

export interface MasterListParams {
  search?: string
  pageIndex: number
  pageSize: number
  sort?: ListSort | null
  filters?: ListFilter[]
}

export function useMasterList<K extends AdminEntity>(
  entity: K,
  params: MasterListParams,
): UseQueryResult<ListPage<AdminRowMap[K]>, AppError> {
  const { search, pageIndex, pageSize, sort, filters } = params
  return useQuery<ListPage<AdminRowMap[K]>, AppError>({
    queryKey: queryKeys.admin.list(entity, {
      search: search ?? '',
      pageIndex,
      pageSize,
      sort: sort ?? null,
      filters: filters ?? [],
    }),
    queryFn: async () => {
      const repo = ADMIN_REGISTRY[entity].repo
      const result = await repo.list({
        search,
        page: pageIndex,
        pageSize,
        sort: sort ?? null,
        filters,
      })
      if (!result.ok) throw result.error
      return result.value
    },
    placeholderData: (prev: ListPage<AdminRowMap[K]> | undefined) => prev,
  })
}
