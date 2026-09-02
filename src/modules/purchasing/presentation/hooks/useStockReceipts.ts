/**
 * TanStack Query bindings for stock receipts — thin wrappers over the shared
 * document data layer (`stockReceiptsRepo` + `useDocumentActions`) keyed
 * through the module-local `purchasingKeys`.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  useDocumentActions,
  type DocumentListPage,
  type DraftEnvelopeExtras,
} from '@/shared/documents'

import { stockReceiptsRepo } from '../../data/repos'
import type { StockReceipt, StockReceiptDraft } from '../../domain/schemas'
import { purchasingKeys } from '../query-keys'
import { toDocumentListParams, type PurchasingListParams } from './shared'

export function useStockReceiptList(params: PurchasingListParams) {
  return useQuery<DocumentListPage<StockReceipt>, AppError>({
    queryKey: purchasingKeys.receiptList(params),
    queryFn: async () => {
      const res = await stockReceiptsRepo.list(toDocumentListParams(params))
      if (!res.ok) throw res.error
      return res.value
    },
    placeholderData: (prev) => prev,
  })
}

export function useStockReceipt(id: string | undefined) {
  return useQuery<StockReceipt, AppError>({
    queryKey: purchasingKeys.receiptDetail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await stockReceiptsRepo.get(id as string)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useStockReceiptActions() {
  const queryClient = useQueryClient()
  const base = useDocumentActions(stockReceiptsRepo)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: purchasingKeys.all })

  return {
    createDraft: async (fields: StockReceiptDraft, extras?: DraftEnvelopeExtras) => {
      const row = await base.createDraft.mutateAsync({ fields, extras })
      await invalidate()
      return row
    },
    updateDraft: async (id: string, patch: Partial<StockReceiptDraft>) => {
      const row = await base.updateDraft.mutateAsync({ id, patch })
      await invalidate()
      return row
    },
    submit: async (id: string) => {
      const res = await base.submit.mutateAsync(id)
      await invalidate()
      return res
    },
    cancel: async (id: string, reason: string) => {
      const res = await base.cancel.mutateAsync({ id, reason })
      await invalidate()
      return res
    },
    isPending:
      base.createDraft.isPending ||
      base.updateDraft.isPending ||
      base.submit.isPending ||
      base.cancel.isPending,
  }
}
