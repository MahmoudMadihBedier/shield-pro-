/**
 * Staff-side hooks for a customer's follow-up tasks. Read + create + status
 * change + delete, against `crm_followups` (branch-scoped RLS).
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  createFollowup,
  deleteFollowup,
  listFollowups,
  reopenFollowup,
  setFollowupStatus,
  type CreateFollowupInput,
} from '../data/followups-repo'
import { sortFollowups, type FollowupRow, type FollowupStatus } from '../domain/followup'
import { crmAdminKeys, crmHubKeys } from '../query-keys'

/**
 * A follow-up mutated from the customer detail page also shows up on the CRM
 * hub's "my open follow-ups" widget (`crmHubKeys`) — a separate query-key
 * namespace from `crmAdminKeys`, so it needs its own invalidation call or it
 * silently goes stale (still shows a just-completed follow-up as open).
 */
function invalidateFollowups(queryClient: ReturnType<typeof useQueryClient>, customerId: string) {
  void queryClient.invalidateQueries({ queryKey: crmAdminKeys.followups(customerId) })
  void queryClient.invalidateQueries({ queryKey: crmHubKeys.root() })
}

export function useCustomerFollowups(customerId: string | undefined) {
  return useQuery<FollowupRow[], AppError>({
    queryKey: crmAdminKeys.followups(customerId ?? ''),
    enabled: Boolean(customerId),
    queryFn: async () => {
      const res = await listFollowups(customerId as string)
      if (!res.ok) throw res.error
      return sortFollowups(res.value)
    },
  })
}

export function useCreateFollowup(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation<FollowupRow, AppError, CreateFollowupInput>({
    mutationFn: async (input) => {
      const res = await createFollowup(input)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      invalidateFollowups(queryClient, customerId)
    },
  })
}

export function useSetFollowupStatus(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation<
    FollowupRow,
    AppError,
    { id: string; status: Extract<FollowupStatus, 'done' | 'cancelled'>; doneBy: string }
  >({
    mutationFn: async ({ id, status, doneBy }) => {
      const res = await setFollowupStatus(id, status, doneBy)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      invalidateFollowups(queryClient, customerId)
    },
  })
}

export function useReopenFollowup(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation<FollowupRow, AppError, string>({
    mutationFn: async (id) => {
      const res = await reopenFollowup(id)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      invalidateFollowups(queryClient, customerId)
    },
  })
}

export function useDeleteFollowup(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation<null, AppError, string>({
    mutationFn: async (id) => {
      const res = await deleteFollowup(id)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      invalidateFollowups(queryClient, customerId)
    },
  })
}
