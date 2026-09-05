/**
 * TanStack Query hooks for the notification centre, plus a small Appwrite
 * Realtime subscription that invalidates them on a matching event
 * (Implementation Plan §4 / Phase 2 Story 2.6).
 */
import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { Realtime, Query as RealtimeQuery } from 'appwrite'

import { useAuth } from '@/application/auth/context'
import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import { client } from '@/infrastructure/appwrite/client'
import { DATABASE_ID, Tables } from '@/infrastructure/appwrite/collections'

import type { Notification } from './domain'
import {
  listNotifications,
  markAllRead,
  markRead,
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
 * The Realtime channel for `notifications` row events.
 *
 * `appwrite@26` ships a non-deprecated `Realtime` service (`new
 * Realtime(client)`) alongside a `Channel` builder
 * (`Channel.tablesdb(id).table(id).row()`); the older `client.subscribe(...)`
 * method still exists but its own doc comment says "deprecated, use the
 * Realtime service instead" and only documents the legacy
 * `databases`/`collections`/`documents` channel shape, which predates
 * TablesDB. Per Appwrite's Realtime docs (`docs/apis/realtime/subscribe` and
 * `.../queries`), the current TablesDB row channel string is
 * `tablesdb.<DATABASE_ID>.tables.<TABLE_ID>.rows` — written here as a plain
 * string (rather than via the `Channel` builder) only so it's trivial to
 * assert on in tests; both forms resolve to the identical wire channel.
 */
export const NOTIFICATIONS_CHANNEL = `tablesdb.${DATABASE_ID}.tables.${Tables.notifications}.rows`

interface NotificationRealtimePayload {
  recipient_user_id?: unknown
}

/**
 * Subscribes to {@link NOTIFICATIONS_CHANNEL} and, for every event whose
 * payload belongs to the signed-in principal, invalidates the unread-count +
 * list queries so the bell/page pick it up live. The server-side `Query`
 * passed as the third `subscribe` argument narrows the socket traffic to
 * this recipient — a nice-to-have; the payload check is what actually
 * decides whether to invalidate, since the collection's broader read
 * permission (see `repo.ts`) means this is the only check this client can
 * fully trust.
 */
export function useNotificationsRealtime(): void {
  const { principal } = useAuth()
  const queryClient = useQueryClient()
  const recipientUserId = principal?.userId ?? null

  useEffect(() => {
    if (!recipientUserId) return undefined

    const realtime = new Realtime(client)
    let cancelled = false
    let unsubscribe: (() => void) | null = null

    void realtime
      .subscribe<NotificationRealtimePayload>(
        NOTIFICATIONS_CHANNEL,
        (event) => {
          if (event.payload?.recipient_user_id !== recipientUserId) return
          invalidateAll(queryClient)
        },
        [RealtimeQuery.equal('recipient_user_id', recipientUserId)],
      )
      .then((subscription) => {
        if (cancelled) {
          void subscription.unsubscribe()
          return
        }
        unsubscribe = () => void subscription.unsubscribe()
      })
      .catch(() => {
        // A dropped/failed Realtime connection degrades to "no live push" —
        // the bell/list still work via normal query refetch/invalidation.
      })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [recipientUserId, queryClient])
}
