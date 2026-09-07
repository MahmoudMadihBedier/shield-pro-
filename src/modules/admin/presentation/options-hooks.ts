/**
 * Shared picker option lists sourced from the master-data repos this module
 * owns (`users`, `branches`). Business modules (`sales`, `purchasing`, …) import
 * these instead of re-declaring the same query + role-filter logic
 * (`claude.md` A.2 — no duplication across modules).
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import type { SelectOption } from '@/shared/forms'

import { branchesRepo } from '../data/repos'
import { usersRepo } from '../data/users-repo'

const OPTION_PAGE = { page: 0, pageSize: 200 } as const
const SALES_REP_ROLE = 'sales_rep'

/** Active staff whose `roles` include `sales_rep` — falls back to all active staff. */
export function useRepOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: ['admin', 'options', 'reps'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await usersRepo.list({ ...OPTION_PAGE, sort: { field: 'full_name', dir: 'asc' } })
      if (!res.ok) throw res.error
      const active = res.value.rows.filter((row) => row.is_active)
      const reps = active.filter((row) => (row.roles ?? '').includes(SALES_REP_ROLE))
      const pool = reps.length > 0 ? reps : active
      return pool.map((row) => ({ value: row.$id, label: row.full_name }))
    },
  })
}

/** Every branch, name-sorted — for branch pickers and the multi-rep editor. */
export function useBranchOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: ['admin', 'options', 'branches'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await branchesRepo.list({ ...OPTION_PAGE, sort: { field: 'name', dir: 'asc' } })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ value: row.$id, label: row.name }))
    },
  })
}
