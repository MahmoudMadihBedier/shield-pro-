/**
 * Read-only master-data lookups the manufacturing screens need: the product
 * catalogue, a single product's BOM, and the factory / raw-store warehouse ids.
 * All go through the admin repos (`@/modules/admin`) — no master-data access is
 * re-implemented here.
 */
import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  productBomRepo,
  productsRepo,
  rawMaterialsRepo,
  warehousesRepo,
  type Product,
  type ProductBomLine,
  type RawMaterial,
  type Warehouse,
} from '@/modules/admin'

import { manufacturingKeys } from '../query-keys'

/** Active products, capped — this is master-data volume, not transactions. */
export function useProductOptions() {
  return useQuery<Product[], AppError>({
    queryKey: manufacturingKeys.productOptions(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await productsRepo.list({
        page: 0,
        pageSize: 100,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows
    },
  })
}

/** Active raw materials, capped — for name resolution + price maps. */
export function useRawMaterialOptions() {
  return useQuery<RawMaterial[], AppError>({
    queryKey: ['manufacturing', 'raw-material-options'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await rawMaterialsRepo.list({
        page: 0,
        pageSize: 100,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      return res.value.rows
    },
  })
}

/** Look up a product by id from the (already loaded) catalogue. */
export function useProduct(productId: string | undefined, products: Product[] | undefined) {
  return useMemo(
    () => (productId ? (products ?? []).find((p) => p.$id === productId) ?? null : null),
    [productId, products],
  )
}

/** BOM lines for one product. */
export function useProductBom(productId: string | undefined) {
  return useQuery<ProductBomLine[], AppError>({
    queryKey: manufacturingKeys.productBom(productId ?? ''),
    enabled: Boolean(productId),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await productBomRepo.listForProduct(productId as string)
      if (!res.ok) throw res.error
      return res.value.rows
    },
  })
}

export interface FactoryWarehouses {
  factoryCustodyWarehouseId: string | null
  rawStoreWarehouseId: string | null
}

/**
 * The single factory-custody + raw-store warehouse ids the batch ledger posting
 * needs. Picks the first active warehouse of each `kind`.
 */
export function useFactoryWarehouses() {
  return useQuery<FactoryWarehouses, AppError>({
    queryKey: manufacturingKeys.warehouses(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await warehousesRepo.list({
        page: 0,
        pageSize: 100,
        sort: { field: 'name', dir: 'asc' },
      })
      if (!res.ok) throw res.error
      const pick = (kind: Warehouse['kind']) =>
        res.value.rows.find((w) => w.kind === kind && w.is_active)?.$id ?? null
      return {
        factoryCustodyWarehouseId: pick('factory_custody'),
        rawStoreWarehouseId: pick('raw_store'),
      }
    },
  })
}
