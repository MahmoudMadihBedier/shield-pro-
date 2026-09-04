/**
 * Run-scan / review-flag mutations. Both invalidate every `fraud` query on
 * success so the list + counts refresh; the calling page surfaces
 * success/error (this hook shows nothing itself).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'

import {
  reviewFraudFlag as reviewFraudFlagAction,
  runFraudScan,
  type FraudScanPayload,
  type FraudScanResult,
  type ReviewFraudFlagPayload,
  type ReviewFraudFlagResult,
} from '../../data/fraud-actions'
import { fraudKeys } from '../../query-keys'

export function useFraudActions() {
  const queryClient = useQueryClient()

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: fraudKeys.root })
  }

  const scanMutation = useMutation<FraudScanResult, AppError, FraudScanPayload | undefined>({
    mutationFn: async (payload) => {
      const result = await runFraudScan(payload ?? {})
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  const reviewMutation = useMutation<ReviewFraudFlagResult, AppError, ReviewFraudFlagPayload>({
    mutationFn: async (payload) => {
      const result = await reviewFraudFlagAction(payload)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  return {
    runScan: scanMutation.mutateAsync,
    isScanning: scanMutation.isPending,
    lastScanResult: scanMutation.data,
    scanError: scanMutation.error,
    review: reviewMutation.mutateAsync,
    isReviewing: reviewMutation.isPending,
  }
}
