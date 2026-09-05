/**
 * TanStack Query bindings for `incentive_rules` master data.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import type { ListParams, ListPage } from '@/modules/admin/data/master-repo'

import { incentiveRulesRepo } from '../../data/incentive-rules-repo'
import type { IncentiveRule, IncentiveRuleInput } from '../../domain/schemas'
import { hrKeys } from '../query-keys'

export function useIncentiveRules(params: ListParams) {
  return useQuery<ListPage<IncentiveRule>, AppError>({
    queryKey: hrKeys.incentiveRules.list(params),
    queryFn: async () => {
      const result = await incentiveRulesRepo.list(params)
      if (!result.ok) throw result.error
      return result.value
    },
    placeholderData: (prev) => prev,
  })
}

export interface IncentiveRuleMutations {
  create: (input: IncentiveRuleInput) => Promise<IncentiveRule>
  update: (args: { id: string; patch: Partial<IncentiveRuleInput> }) => Promise<IncentiveRule>
  remove: (id: string) => Promise<void>
  isPending: boolean
}

export function useIncentiveRuleMutations(): IncentiveRuleMutations {
  const queryClient = useQueryClient()

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ['hr', 'incentive-rules'] })
  }

  const createMutation = useMutation<IncentiveRule, AppError, IncentiveRuleInput>({
    mutationFn: async (input) => {
      const result = await incentiveRulesRepo.create(input)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation<
    IncentiveRule,
    AppError,
    { id: string; patch: Partial<IncentiveRuleInput> }
  >({
    mutationFn: async ({ id, patch }) => {
      const result = await incentiveRulesRepo.update(id, patch)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  const removeMutation = useMutation<void, AppError, string>({
    mutationFn: async (id) => {
      const result = await incentiveRulesRepo.remove(id)
      if (isErr(result)) throw result.error
    },
    onSuccess: invalidate,
  })

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
    isPending: createMutation.isPending || updateMutation.isPending || removeMutation.isPending,
  }
}
