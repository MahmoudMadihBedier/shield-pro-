/**
 * Hooks behind the Production Waste Report — see
 * `../../data/waste-report-repo.ts` for why these bypass the shared
 * `productionBatchesRepo.list()` / `useProductOptions()` reads.
 */
import { useMemo } from 'react'

import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import type { Product } from '@/modules/admin'

import {
  listProductsByIds,
  listSubmittedBatchesInRange,
  type WasteReportBatchesPage,
} from '../../data/waste-report-repo'
import { manufacturingKeys } from '../query-keys'

export function useWasteReportBatches(range: { from?: string; to?: string }) {
  return useQuery<WasteReportBatchesPage, AppError>({
    queryKey: manufacturingKeys.wasteReportBatches(range.from ?? '', range.to ?? ''),
    queryFn: async () => {
      const res = await listSubmittedBatchesInRange(range)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

/** Products for exactly the given (possibly unsorted, possibly duplicated) ids. */
export function useProductsByIds(ids: readonly string[]) {
  const sortedIds = useMemo(() => Array.from(new Set(ids)).sort(), [ids])
  return useQuery<Product[], AppError>({
    queryKey: manufacturingKeys.productsByIds(sortedIds),
    enabled: sortedIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const res = await listProductsByIds(sortedIds)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}
