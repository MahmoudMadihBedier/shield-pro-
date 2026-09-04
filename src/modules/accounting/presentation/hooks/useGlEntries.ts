/**
 * TanStack Query hooks over the read-only GL repo.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  accountBalance,
  listGlEntries,
  trialBalanceRows,
  type GlEntryListPage,
  type GlEntryListParams,
} from '../../data/gl-repo'
import type { TrialBalance } from '../../domain/gl'
import { accountingKeys } from '../query-keys'

export function useGlEntries(params: GlEntryListParams = {}) {
  return useQuery<GlEntryListPage, AppError>({
    queryKey: accountingKeys.gl.list(params),
    queryFn: async () => {
      const res = await listGlEntries(params)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useAccountBalance(account: string, enabled = true) {
  return useQuery<number, AppError>({
    queryKey: accountingKeys.gl.balance(account),
    enabled,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await accountBalance(account)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useTrialBalance(range: Pick<GlEntryListParams, 'from' | 'to' | 'branchId'> = {}) {
  return useQuery<TrialBalance, AppError>({
    queryKey: accountingKeys.gl.trialBalance(range),
    queryFn: async () => {
      const res = await trialBalanceRows(range)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}
