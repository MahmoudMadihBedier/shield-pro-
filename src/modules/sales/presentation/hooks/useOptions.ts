/**
 * Picker option lists for the `sales` screens, sourced from the `admin`
 * master-data repos (`claude.md` — import, never reimplement). Capped at 200
 * rows: these are master / low-volume tables.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  customersRepo,
  productsRepo,
  warehousesRepo,
  type Customer,
  type Product,
} from '@/modules/admin'
import type { SelectOption } from '@/shared/forms'

import { salesKeys } from '../query-keys'

/**
 * Rep + branch pickers live in the `admin` master-data module (single source of
 * truth) — re-exported here so the sales screens keep their local import path.
 */
export { useRepOptions, useBranchOptions } from '@/modules/admin'

const OPTION_PAGE = { page: 0, pageSize: 200 } as const

export interface CustomerOption extends SelectOption {
  /** The customer's per-customer discount ceiling (`IMPLEMENTATION_PLAN.md` §1). */
  discountPct: number
  branchId: string
}

export interface ProductOption extends SelectOption {
  basePrice: number
  defaultDiscountPct: number
}

/** Approved customers only — a pending customer cannot be invoiced. */
export function useCustomerOptions(search?: string) {
  const term = search?.trim() || null
  return useQuery<CustomerOption[], AppError>({
    queryKey: salesKeys.options.customers(term),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await customersRepo.list({
        ...OPTION_PAGE,
        search: term ?? undefined,
        sort: { field: 'name', dir: 'asc' },
        filters: [{ field: 'approval_state', value: 'approved' }],
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row: Customer) => ({
        value: row.$id,
        label: `${row.name} (${row.code})`,
        discountPct: row.discount_pct,
        branchId: row.branch_id,
      }))
    },
  })
}

export function useProductOptions() {
  return useQuery<ProductOption[], AppError>({
    queryKey: salesKeys.options.products(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await productsRepo.list({ ...OPTION_PAGE, sort: { field: 'name', dir: 'asc' } })
      if (!res.ok) throw res.error
      return res.value.rows
        .filter((row: Product) => row.is_active)
        .map((row: Product) => ({
          value: row.$id,
          label: `${row.code} — ${row.name}`,
          basePrice: row.base_price,
          defaultDiscountPct: row.default_discount_pct,
        }))
    },
  })
}

function useWarehouseOptionsByKind(kind: 'rep_custody' | 'sub') {
  return useQuery<SelectOption[], AppError>({
    queryKey: salesKeys.options.warehouses(kind),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await warehousesRepo.list({
        ...OPTION_PAGE,
        sort: { field: 'name', dir: 'asc' },
        filters: [{ field: 'kind', value: kind }],
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ value: row.$id, label: row.name }))
    },
  })
}

/** `rep_custody` warehouses — the mobile "warehouse" a rep carries. */
export const useRepCustodyWarehouseOptions = () => useWarehouseOptionsByKind('rep_custody')
/** `sub` warehouses — the branch stockroom a rep issue draws from. */
export const useSubWarehouseOptions = () => useWarehouseOptionsByKind('sub')

/** A `Map<id, label>` view over an option list, for cheap row rendering. */
export function optionLabelMap(options: readonly SelectOption[] | undefined): Map<string, string> {
  return new Map((options ?? []).map((o) => [o.value, o.label]))
}
