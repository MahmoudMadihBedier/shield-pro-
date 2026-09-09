import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import { inventoryValuation } from '../../data/valuation-repo'
import type { ValuationReport } from '../../domain/valuation'
import { inventoryKeys } from '../query-keys'

/** Current whole-company stock value, warehouse-scoped server-side. */
export function useInventoryValuation() {
  return useQuery<ValuationReport, AppError>({
    queryKey: inventoryKeys.valuation(),
    staleTime: 60_000,
    queryFn: async () => {
      const res = await inventoryValuation()
      if (!res.ok) throw res.error
      return res.value
    },
  })
}
