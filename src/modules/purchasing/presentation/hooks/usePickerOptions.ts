/**
 * Small option lists for the purchasing pickers. All capped at 100 rows — these
 * are master tables / low-volume drafts, not transaction history.
 *
 * Supplier and raw-material options read the `admin` module's repos directly
 * (single source of truth — this module never re-declares those entities).
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { DocStatus } from '@/core/doc-status'
import { rawMaterialsRepo, suppliersRepo, warehousesRepo } from '@/modules/admin'
import type { SelectOption } from '@/shared/forms'

import { purchaseOrdersRepo } from '../../data/repos'
import type { PurchaseOrder } from '../../domain/schemas'
import { purchasingKeys } from '../query-keys'

const MAX_ROWS = 100

export function useSupplierOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: purchasingKeys.supplierOptions(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await suppliersRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ value: row.$id, label: row.name }))
    },
  })
}

export function useRawMaterialOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: purchasingKeys.rawMaterialOptions(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await rawMaterialsRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({
        value: row.$id,
        label: `${row.name} (${row.code})`,
      }))
    },
  })
}

/** Warehouses of `kind === 'raw_store'` — the destination for received raw material. */
export function useRawStoreWarehouseOptions() {
  return useQuery<SelectOption[], AppError>({
    queryKey: purchasingKeys.rawStoreWarehouseOptions(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await warehousesRepo.list({
        page: 0,
        pageSize: MAX_ROWS,
        sort: { field: 'name', dir: 'asc' },
        filters: [{ field: 'kind', value: 'raw_store' }],
      })
      if (!res.ok) throw res.error
      return res.value.rows.map((row) => ({ value: row.$id, label: row.name }))
    },
  })
}

/** Submitted purchase orders — the only ones a stock receipt may reference. */
export function useSubmittedPurchaseOrders() {
  return useQuery<PurchaseOrder[], AppError>({
    queryKey: purchasingKeys.submittedPoOptions(),
    staleTime: 30_000,
    queryFn: async () => {
      const res = await purchaseOrdersRepo.list({
        docStatus: DocStatus.Submitted,
        page: 0,
        pageSize: MAX_ROWS,
      })
      if (!res.ok) throw res.error
      return res.value.rows
    },
  })
}
