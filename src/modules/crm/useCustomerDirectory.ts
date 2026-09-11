/**
 * Shared customer directory for the CRM module — reads the `admin` module's
 * `customersRepo` (single source of truth) once; every CRM surface that
 * needs an id → customer lookup derives from this ONE cached query instead
 * of issuing its own `customersRepo.list()` (the leads "link to customer"
 * picker and the hub's "my follow-ups" customer names used to each fetch
 * this separately).
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { customersRepo } from '@/modules/admin'

import { crmDirectoryKeys } from './query-keys'

const MAX_ROWS = 300

export interface CustomerDirectoryEntry {
  id: string
  code: string
  name: string
}

export function useCustomerDirectory() {
  return useQuery<CustomerDirectoryEntry[], AppError>({
    queryKey: crmDirectoryKeys.customers(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await customersRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ id: row.$id, code: row.code, name: row.name }))
    },
  })
}

/** id → display name. */
export function useCustomerNameMap() {
  const query = useCustomerDirectory()
  return useMemo(() => new Map(query.data?.map((c) => [c.id, c.name]) ?? []), [query.data])
}
