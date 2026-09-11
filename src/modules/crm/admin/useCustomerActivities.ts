/**
 * Staff-side hooks for the customer activity log. Read + append + delete,
 * against `crm_activities` (branch-scoped RLS). This module never touches
 * `@/application/query/keys` — it uses the local `crmAdminKeys` factory.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import {
  deleteActivity,
  listActivities,
  logActivity,
  type LogActivityInput,
} from '../data/activities-repo'
import { sortActivities, type ActivityRow } from '../domain/activity'
import { crmAdminKeys } from '../query-keys'

export function useCustomerActivities(customerId: string | undefined) {
  return useQuery<ActivityRow[], AppError>({
    queryKey: crmAdminKeys.activities(customerId ?? ''),
    enabled: Boolean(customerId),
    queryFn: async () => {
      const res = await listActivities(customerId as string)
      if (!res.ok) throw res.error
      return sortActivities(res.value)
    },
  })
}

export function useLogActivity(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation<ActivityRow, AppError, LogActivityInput>({
    mutationFn: async (input) => {
      const res = await logActivity(input)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmAdminKeys.activities(customerId) })
    },
  })
}

export function useDeleteActivity(customerId: string) {
  const queryClient = useQueryClient()
  return useMutation<null, AppError, string>({
    mutationFn: async (id) => {
      const res = await deleteActivity(id)
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: crmAdminKeys.activities(customerId) })
    },
  })
}
