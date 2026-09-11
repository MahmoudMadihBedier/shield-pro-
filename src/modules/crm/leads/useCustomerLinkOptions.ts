/**
 * Customer picker for linking a "won" lead to the `customers` row created for
 * it. Reads the `admin` module's `customersRepo` (single source of truth —
 * this module never re-declares customers).
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { customersRepo } from '@/modules/admin'
import type { SelectOption } from '@/shared/forms'

import { crmLeadsKeys } from '../query-keys'

const MAX_ROWS = 200

export function useCustomerLinkOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: [...crmLeadsKeys.root(), 'customer-link-options'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await customersRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ value: row.$id, label: `${row.code} — ${row.name}` }))
    },
  })
}
