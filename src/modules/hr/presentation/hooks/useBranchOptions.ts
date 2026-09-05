/**
 * Branch picker options, sourced from `@/modules/admin`'s `branchesRepo`
 * (read-only reuse, never reimplemented — `claude.md` B.2).
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { branchesRepo } from '@/modules/admin'

import { hrKeys } from '../query-keys'

export interface BranchOption {
  value: string
  label: string
}

export function useBranchOptions() {
  return useQuery<BranchOption[], AppError>({
    queryKey: [...hrKeys.root, 'branch-options'],
    staleTime: 60_000,
    queryFn: async () => {
      const result = await branchesRepo.list({
        page: 0,
        pageSize: 200,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!result.ok) throw result.error
      return result.value.rows.map((row) => ({ value: row.$id, label: row.name }))
    },
  })
}
