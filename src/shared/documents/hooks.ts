/**
 * TanStack Query bindings for a `DocumentRepo`. A module calls `makeDocumentRepo`
 * once, then uses `useDocumentList` for its list screen and `useDocumentActions`
 * for the create-draft / submit / cancel buttons — invalidation is handled here.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { useAuth } from '@/application/auth/context'
import { queryKeys } from '@/application/query/keys'
import type { AppError } from '@/core/errors'

import type {
  DocumentListParams,
  DocumentListPage,
  DocumentRepo,
  DocumentTransitionResult,
  DraftEnvelopeExtras,
} from './document-repo'

export function useDocumentList<TRow, TDraft extends Record<string, unknown>>(
  repo: DocumentRepo<TRow, TDraft>,
  params: DocumentListParams = {},
) {
  return useQuery<DocumentListPage<TRow>, AppError>({
    queryKey: queryKeys.documents.list(repo.table, params),
    queryFn: async () => {
      const res = await repo.list(params)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

export function useDocument<TRow, TDraft extends Record<string, unknown>>(
  repo: DocumentRepo<TRow, TDraft>,
  id: string | undefined,
) {
  return useQuery<TRow, AppError>({
    queryKey: queryKeys.documents.detail(repo.table, id ?? ''),
    enabled: Boolean(id),
    queryFn: async () => {
      const res = await repo.get(id as string)
      if (!res.ok) throw res.error
      return res.value
    },
  })
}

/**
 * `createDraft` / `updateDraft` / `submit` / `cancel` as mutations. `createDraft`
 * fills the actor from the current `Principal`; a signed-out caller is rejected
 * before the request.
 */
export function useDocumentActions<TRow, TDraft extends Record<string, unknown>>(
  repo: DocumentRepo<TRow, TDraft>,
) {
  const queryClient = useQueryClient()
  const { principal } = useAuth()

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.documents.root(repo.table) })

  const createDraft = useMutation<TRow, AppError, { fields: TDraft; extras?: DraftEnvelopeExtras }>({
    mutationFn: async ({ fields, extras }) => {
      if (!principal) {
        throw { code: 'unauthorized', message: 'Please sign in again.' } satisfies AppError
      }
      const res = await repo.createDraft(
        fields,
        { userId: principal.userId, branchId: principal.branchId },
        extras,
      )
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: invalidate,
  })

  const updateDraft = useMutation<TRow, AppError, { id: string; patch: Partial<TDraft> }>({
    mutationFn: async ({ id, patch }) => {
      const res = await repo.updateDraft(id, patch)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: invalidate,
  })

  const submit = useMutation<DocumentTransitionResult, AppError, string>({
    mutationFn: async (id) => {
      const res = await repo.submit(id)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: invalidate,
  })

  const cancel = useMutation<DocumentTransitionResult, AppError, { id: string; reason: string }>({
    mutationFn: async ({ id, reason }) => {
      const res = await repo.cancel(id, reason)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: invalidate,
  })

  return { createDraft, updateDraft, submit, cancel }
}
