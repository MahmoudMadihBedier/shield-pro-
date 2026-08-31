import { useQuery } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'
import { pingAppwrite, type PingSuccess } from '@/infrastructure/appwrite/health/ping'
import { HEALTH_POLL_INTERVAL_MS } from '@/shared/constants'

/**
 * Live Appwrite connectivity. Backs the on-screen connection indicator and the
 * manual "Ping now" control.
 */
export function useAppwriteHealth() {
  return useQuery<PingSuccess, AppError>({
    queryKey: queryKeys.health.appwrite(),
    queryFn: async () => {
      const result = await pingAppwrite()
      if (!result.ok) throw result.error
      return result.value
    },
    refetchInterval: HEALTH_POLL_INTERVAL_MS,
    staleTime: 0,
  })
}
