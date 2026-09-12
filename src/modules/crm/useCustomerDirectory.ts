/**
 * Shared customer directory for the CRM module — reads the `admin` module's
 * `customersRepo` (single source of truth) once; every CRM surface that
 * needs an id → customer lookup derives from this ONE cached query instead
 * of issuing its own `customersRepo.list()` (the leads "link to customer"
 * picker and the hub's "my follow-ups" customer names used to each fetch
 * this separately).
 *
 * Pages through the whole table (bounded by `DIRECTORY_CAP`) rather than a
 * single capped page — a single page silently made any customer past it
 * unresolvable (shown as a bare id) with no signal that more existed.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { appError } from '@/core/errors'
import type { AppError } from '@/core/errors'
import { customersRepo } from '@/modules/admin'

import { crmDirectoryKeys } from './query-keys'

const PAGE_SIZE = 200
/** Hard stop so a runaway customer count fails loudly instead of hanging. */
const DIRECTORY_CAP = 5_000

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
      const out: CustomerDirectoryEntry[] = []
      for (let page = 0; page * PAGE_SIZE < DIRECTORY_CAP; page++) {
        const res = await customersRepo.list({
          page,
          pageSize: PAGE_SIZE,
          sort: { field: 'name', dir: 'asc' },
        })
        if (!res.ok) throw res.error
        out.push(...res.value.rows.map((row) => ({ id: row.$id, code: row.code, name: row.name })))
        if (res.value.rows.length < PAGE_SIZE) return out
      }
      throw appError('server', 'عدد العملاء كبير جدًا لعرضه هنا — تواصل مع الدعم.', {
        detail: `customers: exceeded ${DIRECTORY_CAP} rows`,
      })
    },
  })
}

/** id → display name. */
export function useCustomerNameMap() {
  const query = useCustomerDirectory()
  return useMemo(() => new Map(query.data?.map((c) => [c.id, c.name]) ?? []), [query.data])
}
