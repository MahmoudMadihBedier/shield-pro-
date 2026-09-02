/**
 * Lightweight per-entity row counts for the admin dashboard cards. Each entity
 * is a single `limit(1)` list call — Appwrite returns `total` regardless.
 */
import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'

import { ADMIN_LIST_ENTITIES, ADMIN_REGISTRY, type AdminListEntity } from '../registry'

export type AdminCounts = Record<AdminListEntity, number>

export function useAdminCounts() {
  return useQuery<AdminCounts, AppError>({
    queryKey: queryKeys.admin.counts(),
    staleTime: 30_000,
    queryFn: async () => {
      const entries = await Promise.all(
        ADMIN_LIST_ENTITIES.map(async (entity): Promise<[AdminListEntity, number]> => {
          const result = await ADMIN_REGISTRY[entity].repo.list({ page: 0, pageSize: 1, sort: null })
          if (!result.ok) throw result.error
          return [entity, result.value.total]
        }),
      )
      return Object.fromEntries(entries) as AdminCounts
    },
  })
}
