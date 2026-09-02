/**
 * Reads of the `bin_balances` projection — "stock on hand" and the
 * count-session recorded-qty lookup.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  getBinQty,
  listBinBalances,
  type BinBalanceListPage,
  type BinBalanceListParams,
} from '../../data/bin-balances-repo'
import type { BinBalance } from '../../domain/schemas'
import { inventoryKeys } from '../query-keys'

export function useBinBalances(params: BinBalanceListParams = {}) {
  return useQuery<BinBalanceListPage, AppError>({
    queryKey: inventoryKeys.bin.list(params),
    queryFn: async () => {
      const result = await listBinBalances(params)
      if (!result.ok) throw result.error
      return result.value
    },
    placeholderData: (prev) => prev,
  })
}

export function useBinQty(productId: string | undefined, warehouseId: string | undefined) {
  return useQuery<number, AppError>({
    queryKey: inventoryKeys.bin.qty(productId ?? '', warehouseId ?? ''),
    enabled: Boolean(productId) && Boolean(warehouseId),
    queryFn: async () => {
      const result = await getBinQty(productId as string, warehouseId as string)
      if (!result.ok) throw result.error
      return result.value
    },
  })
}

export type { BinBalance }
