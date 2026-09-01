import { useInfiniteQuery } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'

import {
  DEFAULT_AUDIT_LIMIT,
  getAuditTrail,
  type AuditTrailPage,
} from '../../data/traceability-repo'

export interface AuditTrailFilters {
  entityRef?: string
  actorId?: string
}

/** Paginated `audit_log` reader for the viewer screen. */
export function useAuditTrail(filters: AuditTrailFilters = {}) {
  return useInfiniteQuery<AuditTrailPage, AppError>({
    queryKey: queryKeys.audit.trail(filters),
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => {
      const result = await getAuditTrail({
        ...filters,
        limit: DEFAULT_AUDIT_LIMIT,
        cursor: pageParam as string | undefined,
      })
      if (!result.ok) throw result.error
      return result.value
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  })
}
