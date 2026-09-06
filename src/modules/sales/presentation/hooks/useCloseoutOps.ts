/**
 * Mutations for the two server-side rep close-out operations (Story 2.4):
 * auto-building the `expected` bag, and confirming a submitted close-out.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { queryKeys } from '@/application/query/keys'

import {
  buildCloseoutExpected,
  confirmCloseout,
  type RepCloseoutConfirmResult,
} from '../../data/closeout-ops'
import type { CloseoutExpected } from '../../domain/schemas'
import { salesKeys } from '../query-keys'

/** Ask the server to assemble `expected` from the day's movement. */
export function useBuildCloseoutExpected() {
  return useMutation<CloseoutExpected, AppError, { repUserId: string; businessDate: string }>({
    mutationFn: async ({ repUserId, businessDate }) => {
      const res = await buildCloseoutExpected(repUserId, businessDate)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

/** Confirm a submitted close-out — the server recomputes variance + flags. */
export function useConfirmCloseout() {
  const queryClient = useQueryClient()
  return useMutation<RepCloseoutConfirmResult, AppError, string>({
    mutationFn: async (rowId) => {
      const res = await confirmCloseout(rowId)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.documents.root('rep_closeouts') })
      void queryClient.invalidateQueries({ queryKey: salesKeys.root })
    },
  })
}
