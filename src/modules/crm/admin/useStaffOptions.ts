/**
 * Active-staff picker for the follow-up "assigned to" field. Reads the
 * `admin` module's `usersRepo` (single source of truth — this module never
 * re-declares staff). Values are `auth_user_id` — the same id every
 * `created_by` / `assigned_to` / `requested_by` column stores.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { usersRepo } from '@/modules/admin'
import type { SelectOption } from '@/shared/forms'

import { crmAdminKeys } from '../query-keys'

const MAX_ROWS = 300

export function useStaffOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: crmAdminKeys.staffOptions(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await usersRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'full_name', dir: 'asc' },
        filters: [{ field: 'is_active', value: 'true' }],
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ value: row.auth_user_id, label: row.full_name }))
    },
  })
}
