/** Reads of `fraud_flags` for the dashboard list. */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  listFraudFlags,
  type FraudFlagListPage,
  type FraudFlagListParams,
} from '../../data/fraud-flags-repo'
import { fraudKeys } from '../../query-keys'

export function useFraudFlags(params: FraudFlagListParams = {}) {
  return useQuery<FraudFlagListPage, AppError>({
    queryKey: fraudKeys.flags.list(params),
    queryFn: async () => {
      const result = await listFraudFlags(params)
      if (!result.ok) throw result.error
      return result.value
    },
    placeholderData: (prev) => prev,
  })
}
