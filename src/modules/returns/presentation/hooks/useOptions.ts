/**
 * Small option lists for the returns pickers, sourced from the `admin`
 * master-data repos (`claude.md` — import, never reimplement). Capped at 200
 * rows: warehouses and products are master tables, not transaction volume.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { productsRepo, warehousesRepo } from '@/modules/admin'

import { returnsKeys } from '../query-keys'

export interface Option {
  value: string
  label: string
}

const OPTION_PAGE = { page: 0, pageSize: 200 } as const

export function useWarehouseOptions() {
  return useQuery<Option[], AppError>({
    queryKey: returnsKeys.options.warehouses(),
    staleTime: 60_000,
    queryFn: async () => {
      const result = await warehousesRepo.list({
        ...OPTION_PAGE,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!result.ok) throw result.error
      return result.value.rows.map((row) => ({ value: row.$id, label: row.name }))
    },
  })
}

export function useProductOptions() {
  return useQuery<Option[], AppError>({
    queryKey: returnsKeys.options.products(),
    staleTime: 60_000,
    queryFn: async () => {
      const result = await productsRepo.list({
        ...OPTION_PAGE,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!result.ok) throw result.error
      return result.value.rows.map((row) => ({
        value: row.$id,
        label: `${row.code} — ${row.name}`,
      }))
    },
  })
}

/** A `Map<id, label>` view over an option list, for cheap row rendering. */
export function optionLabelMap(options: readonly Option[] | undefined): Map<string, string> {
  return new Map((options ?? []).map((o) => [o.value, o.label]))
}
