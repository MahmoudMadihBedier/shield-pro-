import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import { supplierPerformance } from '../../data/supplier-performance-repo'
import type { SupplierPerformanceReport } from '../../domain/supplier-performance'
import { purchasingKeys } from '../query-keys'

/** Whole-company supplier performance, branch-scoped server-side. */
export function useSupplierPerformance() {
  return useQuery<SupplierPerformanceReport, AppError>({
    queryKey: purchasingKeys.supplierPerformance(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await supplierPerformance()
      if (!res.ok) throw res.error
      return res.value
    },
  })
}
