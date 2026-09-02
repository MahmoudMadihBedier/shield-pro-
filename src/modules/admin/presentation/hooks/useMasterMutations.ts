/**
 * Create / update / remove mutations for any master-data entity. Each mutation
 * invalidates that entity's list keys and the admin counts; the calling page
 * surfaces success/error (this hook shows nothing itself).
 */
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { queryKeys } from '@/application/query/keys'
import { useAuth } from '@/application/auth/context'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'

import { ADMIN_REGISTRY, type AdminEntity, type AdminInputMap, type AdminRowMap } from '../registry'

export interface MasterMutations<K extends AdminEntity> {
  create: (input: AdminInputMap[K]) => Promise<AdminRowMap[K]>
  update: (args: { id: string; patch: Partial<AdminInputMap[K]> }) => Promise<AdminRowMap[K]>
  remove: ((id: string) => Promise<void>) | null
  isPending: boolean
}

export function useMasterMutations<K extends AdminEntity>(entity: K): MasterMutations<K> {
  const queryClient = useQueryClient()
  const { principal } = useAuth()
  const config = ADMIN_REGISTRY[entity]

  function invalidate() {
    // Prefix-match every paged list key for this entity, plus the counts.
    void queryClient.invalidateQueries({ queryKey: ['admin', 'list', entity] })
    void queryClient.invalidateQueries({ queryKey: queryKeys.admin.counts() })
  }

  const createMutation = useMutation<AdminRowMap[K], AppError, AdminInputMap[K]>({
    mutationFn: async (input) => {
      // `customers` stamp the acting principal as `created_by` (workflow field).
      const overrides =
        entity === 'customer' && principal ? { created_by: principal.userId } : undefined
      const result = await config.repo.create(input, overrides)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation<
    AdminRowMap[K],
    AppError,
    { id: string; patch: Partial<AdminInputMap[K]> }
  >({
    mutationFn: async ({ id, patch }) => {
      const result = await config.repo.update(id, patch)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  const removeFn = config.repo.remove
  const removeMutation = useMutation<void, AppError, string>({
    mutationFn: async (id) => {
      if (!removeFn) throw new Error(`remove is not supported for "${entity}"`)
      const result = await removeFn(id)
      if (isErr(result)) throw result.error
    },
    onSuccess: invalidate,
  })

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeFn ? removeMutation.mutateAsync : null,
    isPending: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  }
}
