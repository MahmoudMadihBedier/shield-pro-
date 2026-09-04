/**
 * TanStack Query bindings for the two read-only rep ledgers. Shown on the
 * close-out confirmation screen so the account manager sees the rep's running
 * stock + cash position.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  listRepCashLedger,
  listRepStockLedger,
  repCashBalance,
  repStockBalance,
  type LedgerPage,
  type RepCashBalanceRow,
  type RepStockBalanceRow,
} from '../../data/rep-ledgers-repo'
import type { CloseoutCashMethod, RepCashLedgerRow, RepStockLedgerRow } from '../../domain/schemas'
import { salesKeys } from '../query-keys'

export interface RepStockLedgerQuery {
  repUserId: string | undefined
  productId?: string
  page?: number
  pageSize?: number
}

export function useRepStockLedger(params: RepStockLedgerQuery) {
  const { repUserId, ...rest } = params
  return useQuery<LedgerPage<RepStockLedgerRow>, AppError>({
    queryKey: salesKeys.repLedger.stock(params),
    enabled: Boolean(repUserId),
    queryFn: async () => {
      const res = await listRepStockLedger({ repUserId: repUserId as string, ...rest })
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export interface RepCashLedgerQuery {
  repUserId: string | undefined
  method?: CloseoutCashMethod
  page?: number
  pageSize?: number
}

export function useRepCashLedger(params: RepCashLedgerQuery) {
  const { repUserId, ...rest } = params
  return useQuery<LedgerPage<RepCashLedgerRow>, AppError>({
    queryKey: salesKeys.repLedger.cash(params),
    enabled: Boolean(repUserId),
    queryFn: async () => {
      const res = await listRepCashLedger({ repUserId: repUserId as string, ...rest })
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useRepStockBalance(repUserId: string | undefined) {
  return useQuery<RepStockBalanceRow[], AppError>({
    queryKey: salesKeys.repLedger.stockBalance(repUserId ?? ''),
    enabled: Boolean(repUserId),
    queryFn: async () => {
      const res = await repStockBalance(repUserId as string)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useRepCashBalance(repUserId: string | undefined) {
  return useQuery<RepCashBalanceRow[], AppError>({
    queryKey: salesKeys.repLedger.cashBalance(repUserId ?? ''),
    enabled: Boolean(repUserId),
    queryFn: async () => {
      const res = await repCashBalance(repUserId as string)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}
