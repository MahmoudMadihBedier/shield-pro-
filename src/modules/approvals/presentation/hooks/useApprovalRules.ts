/**
 * List query + create/update mutations for `approval_rules`. Mirrors admin's
 * `useMasterList` / `useMasterMutations` shape, kept module-local since
 * `approval_rules` isn't part of the `admin` entity registry.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'

import { approvalRulesRepo, type ListPage, type ListSort } from '../../data/repos'
import type { ApprovalRuleInput, ApprovalRuleRow } from '../../domain/schemas'
import { approvalsKeys } from '../query-keys'

export interface ApprovalRulesListParams {
  search?: string
  pageIndex: number
  pageSize: number
  sort?: ListSort | null
}

export function useApprovalRulesList(
  params: ApprovalRulesListParams,
): UseQueryResult<ListPage<ApprovalRuleRow>, AppError> {
  const { search, pageIndex, pageSize, sort } = params
  return useQuery<ListPage<ApprovalRuleRow>, AppError>({
    queryKey: approvalsKeys.rules.list({
      search: search ?? '',
      pageIndex,
      pageSize,
      sort: sort ?? null,
    }),
    queryFn: async () => {
      const result = await approvalRulesRepo.list({
        search,
        page: pageIndex,
        pageSize,
        sort: sort ?? null,
      })
      if (!result.ok) throw result.error
      return result.value
    },
    placeholderData: (prev: ListPage<ApprovalRuleRow> | undefined) => prev,
  })
}

export interface ApprovalRuleMutations {
  create: (input: ApprovalRuleInput) => Promise<ApprovalRuleRow>
  update: (args: { id: string; patch: Partial<ApprovalRuleInput> }) => Promise<ApprovalRuleRow>
  isPending: boolean
}

export function useApprovalRuleMutations(): ApprovalRuleMutations {
  const queryClient = useQueryClient()

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: approvalsKeys.rules.root })
  }

  const createMutation = useMutation<ApprovalRuleRow, AppError, ApprovalRuleInput>({
    mutationFn: async (input) => {
      const result = await approvalRulesRepo.create(input)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  const updateMutation = useMutation<
    ApprovalRuleRow,
    AppError,
    { id: string; patch: Partial<ApprovalRuleInput> }
  >({
    mutationFn: async ({ id, patch }) => {
      const result = await approvalRulesRepo.update(id, patch)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: invalidate,
  })

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    isPending: createMutation.isPending || updateMutation.isPending,
  }
}
