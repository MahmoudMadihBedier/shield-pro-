/**
 * The accounting period lock — read (`system_settings`) + write
 * (`set_posting_lock_date` RPC, System Admin only). Controls whether
 * `post_gl` / `post_stock_ledger` accept a posting dated at or before the
 * lock.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { setPostingLockDate } from '@/infrastructure/appwrite/functions'

import { getPostingLockDate } from '../../data/settings-repo'
import { accountingKeys } from '../query-keys'

export function usePostingLockDate() {
  return useQuery<string | null, AppError>({
    queryKey: accountingKeys.reports.postingLockDate(),
    queryFn: async () => {
      const res = await getPostingLockDate()
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useSetPostingLockDate() {
  const queryClient = useQueryClient()
  return useMutation<{ date: string | null }, AppError, string | null>({
    mutationFn: async (date) => {
      const res = await setPostingLockDate(date)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountingKeys.reports.postingLockDate() })
    },
  })
}
