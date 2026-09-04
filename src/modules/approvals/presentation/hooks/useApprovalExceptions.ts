/**
 * The exceptions dashboard's data: the list of `pending` approval requests
 * (force-manual escalations — never the auto-approved routine ones, per
 * Implementation Plan §4.5 "shows exceptions, not routine approvals") and the
 * approve/reject mutation.
 */
import { useMutation, useQuery, useQueryClient, type UseQueryResult } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'

import { decideApprovalRequest, type DecideApprovalResult } from '../../data/decisions'
import { approvalRequestsRepo, type ListPage } from '../../data/repos'
import type { ApprovalRequestRow } from '../../domain/schemas'
import { approvalsKeys } from '../query-keys'

export interface PendingApprovalsParams {
  pageIndex: number
  pageSize: number
}

export function usePendingApprovalRequests(
  params: PendingApprovalsParams,
): UseQueryResult<ListPage<ApprovalRequestRow>, AppError> {
  const { pageIndex, pageSize } = params
  return useQuery<ListPage<ApprovalRequestRow>, AppError>({
    queryKey: approvalsKeys.requests.pending({ pageIndex, pageSize }),
    queryFn: async () => {
      const result = await approvalRequestsRepo.list({ page: pageIndex, pageSize, state: 'pending' })
      if (!result.ok) throw result.error
      return result.value
    },
    placeholderData: (prev: ListPage<ApprovalRequestRow> | undefined) => prev,
  })
}

export interface DecideApprovalArgs {
  approvalRequestId: string
  decision: 'approved' | 'rejected'
  reason?: string
}

export function useDecideApprovalRequest() {
  const queryClient = useQueryClient()

  return useMutation<DecideApprovalResult, AppError, DecideApprovalArgs>({
    mutationFn: async (args) => {
      const result = await decideApprovalRequest(args)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: approvalsKeys.requests.root })
    },
  })
}
