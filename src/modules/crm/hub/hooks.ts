/**
 * Data for the CRM hub page — "my open follow-ups", across every customer,
 * branch-scoped server-side.
 */
import { useQuery } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'

import { listMyOpenFollowups } from '../data/followups-repo'
import { sortFollowups, type FollowupRow } from '../domain/followup'
import { crmHubKeys } from '../query-keys'

export function useMyOpenFollowups(userId: string | undefined) {
  return useQuery<FollowupRow[], AppError>({
    queryKey: crmHubKeys.myFollowups(userId ?? ''),
    enabled: Boolean(userId),
    queryFn: async () => {
      const res = await listMyOpenFollowups(userId as string)
      if (!res.ok) throw res.error
      return sortFollowups(res.value)
    },
  })
}
