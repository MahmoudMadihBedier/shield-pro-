/**
 * TanStack Query hooks over the read-only bank statement repo.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  listBankStatementLines,
  reconcileBankStatementLine,
  type BankStatementListPage,
  type BankStatementListParams,
} from '../../data/bank-statement-repo'
import { accountingKeys } from '../query-keys'

export function useBankStatementList(params: BankStatementListParams = {}) {
  return useQuery<BankStatementListPage, AppError>({
    queryKey: accountingKeys.bankStatement.list(params),
    queryFn: async () => {
      const res = await listBankStatementLines(params)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useReconcileBankStatementLine() {
  const queryClient = useQueryClient()
  return useMutation<void, AppError, { id: string; reconciled: boolean }>({
    mutationFn: async ({ id, reconciled }) => {
      const res = await reconcileBankStatementLine(id, reconciled)
      if (!res.ok) throw res.error
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['accounting', 'bank-statement'] })
    },
  })
}
