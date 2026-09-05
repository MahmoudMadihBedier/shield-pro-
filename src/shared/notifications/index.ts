/**
 * Public surface of the in-app notification centre (Implementation Plan §4 /
 * Phase 2 Story 2.6) — a bell + full list fed by Appwrite Realtime over the
 * `notifications` control table.
 */

// --- components ---------------------------------------------------------
export { NotificationBell } from './NotificationBell'
export { NotificationsPage } from './NotificationsPage'

// --- routing + nav --------------------------------------------------------
export { notificationsRoutes } from './routes'
export { notificationsNavItems } from './nav'

// --- hooks (presentation) --------------------------------------------------
export {
  notificationKeys,
  NOTIFICATIONS_CHANNEL,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useNotificationsRealtime,
  useUnreadCount,
  type NotificationListHookParams,
} from './useNotifications'

// --- data (repository) ------------------------------------------------------
export {
  listNotifications,
  markAllRead,
  markRead,
  type NotificationListPage,
  type NotificationListParams,
} from './repo'

// --- domain (schema, labels) -------------------------------------------------
export {
  notificationRowSchema,
  notificationKindLabel,
  bilingualKindLabel,
  NOTIFICATION_KIND_LABELS,
  type Notification,
  type NotificationKindLabel,
} from './domain'
