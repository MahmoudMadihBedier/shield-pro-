/**
 * TanStack Query hooks for the notification centre, plus a small Supabase
 * Realtime subscription that invalidates them on a matching event
 * (Implementation Plan §4 / Phase 2 Story 2.6).
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'

import { useAuth } from '@/application/auth/context'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { supabase } from '@/infrastructure/appwrite/client'
import { Tables } from '@/infrastructure/appwrite/collections'

import type { Notification } from './domain'
import {
  listNotifications,
  markAllRead,
  markRead,
  syncOverdueFollowupNotifications,
  type NotificationListPage,
  type NotificationListParams,
} from './repo'

/**
 * Local TanStack Query key factory (the shared `src/application/query/keys.ts`
 * is not edited — see `src/modules/fraud/query-keys.ts` for the same pattern).
 */
export const notificationKeys = {
  root: ['notifications'] as const,
  unreadCount: (recipientUserId: string) =>
    ['notifications', 'unread-count', recipientUserId] as const,
  list: (params: NotificationListParams) => ['notifications', 'list', params] as const,
}

function invalidateAll(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: notificationKeys.root })
}

/** Unread count for the signed-in principal — `0` (and disabled) with no session. */
export function useUnreadCount() {
  const { principal } = useAuth()
  const recipientUserId = principal?.userId ?? null

  return useQuery<number, AppError>({
    queryKey: notificationKeys.unreadCount(recipientUserId ?? ''),
    queryFn: async () => {
      if (!recipientUserId) return 0
      const result = await listNotifications({ recipientUserId, onlyUnread: true, pageSize: 1 })
      if (isErr(result)) throw result.error
      // `total` is the server-side match count, not just this page's rows.
      return result.value.total
    },
    enabled: recipientUserId !== null,
  })
}

export type NotificationListHookParams = Omit<NotificationListParams, 'recipientUserId'>

/** Paginated notifications for the signed-in principal. */
export function useNotificationList(params: NotificationListHookParams = {}) {
  const { principal } = useAuth()
  const recipientUserId = principal?.userId ?? null
  const fullParams: NotificationListParams = { recipientUserId: recipientUserId ?? '', ...params }

  return useQuery<NotificationListPage, AppError>({
    queryKey: notificationKeys.list(fullParams),
    queryFn: async () => {
      const result = await listNotifications(fullParams)
      if (isErr(result)) throw result.error
      return result.value
    },
    enabled: recipientUserId !== null,
    placeholderData: (prev) => prev,
  })
}

/** Mark one notification read; invalidates the unread-count + list queries. */
export function useMarkNotificationRead() {
  const queryClient = useQueryClient()

  return useMutation<Notification, AppError, string>({
    mutationFn: async (id) => {
      const result = await markRead(id)
      if (isErr(result)) throw result.error
      return result.value
    },
    onSuccess: () => invalidateAll(queryClient),
  })
}

/** Mark every unread notification read for the signed-in principal. */
export function useMarkAllNotificationsRead() {
  const { principal } = useAuth()
  const queryClient = useQueryClient()

  return useMutation<void, AppError, void>({
    mutationFn: async () => {
      if (!principal) return
      const result = await markAllRead(principal.userId)
      if (isErr(result)) throw result.error
    },
    onSuccess: () => invalidateAll(queryClient),
  })
}

/**
 * "Check on read" for CRM follow-ups (docs/CRM_PLAN.md Phase A #2) — no
 * scheduled job exists yet, so this fires the idempotent sync RPC once per
 * signed-in session (react-query's cache dedupes repeats within
 * `staleTime`; it is NOT a poll/timer) and refreshes the bell immediately if
 * it created anything, rather than waiting for the next Realtime event.
 * Side-effect only — mount it once, near `useNotificationsRealtime`.
 */
/**
 * Deliberately NOT under the `notifications` key prefix: `invalidateAll`
 * targets `notificationKeys.root` (`['notifications']`), which prefix-matches
 * any key starting with it — sharing that prefix would have this query
 * invalidate (and immediately refetch) itself every time it found something
 * to sync, firing the RPC twice in a row and defeating the "once per
 * session" `staleTime` below.
 */
const SYNC_QUERY_KEY = (recipientUserId: string) =>
  ['crm-followup-notification-sync', recipientUserId] as const

export function useSyncOverdueFollowupNotifications(): void {
  const { principal } = useAuth()
  const queryClient = useQueryClient()
  const recipientUserId = principal?.userId ?? null

  const query = useQuery<number, AppError>({
    queryKey: SYNC_QUERY_KEY(recipientUserId ?? ''),
    enabled: recipientUserId !== null,
    staleTime: 5 * 60_000,
    // Best-effort background sync (same posture as `useNotificationsRealtime`
    // degrading to "no live push" on a dropped connection) — a failure here
    // must never surface as user-facing noise for what is, worst case, one
    // missed notification. It is not silent to a developer: logged below.
    retry: false,
    queryFn: async () => {
      const result = await syncOverdueFollowupNotifications()
      if (isErr(result)) throw result.error
      if (result.value > 0) invalidateAll(queryClient)
      return result.value
    },
  })

  useEffect(() => {
    if (query.isError) {
      console.error('overdue-follow-up notification sync failed:', query.error)
    }
  }, [query.isError, query.error])
}

/**
 * The Supabase Realtime channel name for `notifications` row events. Postgres
 * changes are delivered on any channel once the client subscribes to
 * `postgres_changes` for `public.notifications`; the string is kept exported
 * (and stable) purely so tests can assert on it.
 */
export const NOTIFICATIONS_CHANNEL = `realtime:public:${Tables.notifications}`

/**
 * Subscribes to `postgres_changes` on `public.notifications`, filtered to the
 * signed-in principal's rows, and invalidates the unread-count + list queries
 * so the bell/page pick a new notification up live. A dropped connection
 * degrades to "no live push" — the queries still refetch on their own.
 */
export function useNotificationsRealtime(): void {
  const { principal } = useAuth()
  const queryClient = useQueryClient()
  const recipientUserId = principal?.userId ?? null

  useEffect(() => {
    if (!recipientUserId) return undefined

    const channel = supabase
      .channel(`notifications:${recipientUserId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: Tables.notifications,
          filter: `recipient_user_id=eq.${recipientUserId}`,
        },
        () => invalidateAll(queryClient),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [recipientUserId, queryClient])
}
