/**
 * TanStack Query bindings for purchase orders — thin wrappers over the shared
 * document data layer (`purchaseOrdersRepo` + `useDocumentActions`) keyed
 * through the module-local `purchasingKeys`.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import {
  useDocumentActions,
  type DocumentListPage,
  type DraftEnvelopeExtras,
} from '@/shared/documents'

import { purchaseOrdersRepo } from '../../data/repos'
import type { PurchaseOrder, PurchaseOrderDraft } from '../../domain/schemas'
import { purchasingKeys } from '../query-keys'
import { toDocumentListParams, type PurchasingListParams } from './shared'

export function usePurchaseOrderList(params: PurchasingListParams) {
  return useQuery<DocumentListPage<PurchaseOrder>, AppError>({
    queryKey: purchasingKeys.poList(params),
    queryFn: async () => {
      const res = await purchaseOrdersRepo.list(toDocumentListParams(params))
      if (!res.ok) throw res.error
      return res.value
    },
    placeholderData: (prev) => prev,
  })
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery<PurchaseOrder, AppError>({
    queryKey: purchasingKeys.poDetail(id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await purchaseOrdersRepo.get(id as string)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function usePurchaseOrderActions() {
  const queryClient = useQueryClient()
  const base = useDocumentActions(purchaseOrdersRepo)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: purchasingKeys.all })

  return {
    createDraft: async (fields: PurchaseOrderDraft, extras?: DraftEnvelopeExtras) => {
      const row = await base.createDraft.mutateAsync({ fields, extras })
      await invalidate()
      return row
    },
    updateDraft: async (id: string, patch: Partial<PurchaseOrderDraft>) => {
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
