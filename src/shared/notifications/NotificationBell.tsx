/**
 * Compact header bell — unread badge + a dropdown of the most recent
 * notifications (Implementation Plan §4 / Phase 2 Story 2.6). Presentation
 * only: reads/mutates through the module's hooks, ZERO business logic.
 * RTL-correct (the panel opens toward the inline-start, matching a
 * right-aligned header in Arabic), dark-mode aware, explicit loading / empty
 * states. Exported for the app shell to mount in `AppLayout`'s header — see
 * this module's `index.ts` / the Story's final report for the mount snippet.
 */
import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

import { Badge, Button } from '@/shared/ui'
import { formatDateTime } from '@/shared/formatters'

import { bilingualKindLabel } from './domain'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
  useNotificationsRealtime,
  useUnreadCount,
} from './useNotifications'

const RECENT_COUNT = 8

function BellIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
    >
      <path
        d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function NotificationBell() {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useNotificationsRealtime()
  const unread = useUnreadCount()
  const list = useNotificationList({ page: 0, pageSize: RECENT_COUNT })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  useEffect(() => {
    if (!open) return
    function onPointerDown(e: PointerEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const rows = list.data?.rows ?? []
  const unreadCount = unread.data ?? 0

  return (
    <div ref={containerRef} className="relative">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        aria-label="الإشعارات / Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="relative"
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <Badge
            tone="danger"
            className="absolute -end-1 -top-1 min-w-[1.1rem] justify-center px-1 py-0 text-[0.65rem] leading-4"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        ) : null}
      </Button>

      {open ? (
        <div
          role="menu"
          className="absolute end-0 z-20 mt-2 w-80 rounded-xl border border-black/10 bg-white text-zinc-900 shadow-lg dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <div className="flex items-center justify-between gap-2 border-b border-black/5 px-3 py-2 dark:border-white/5">
            <span className="text-sm font-semibold">الإشعارات / Notifications</span>
            <Button
              size="sm"
              variant="ghost"
              disabled={unreadCount === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              تحديد الكل كمقروء / Mark all read
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {list.isLoading ? (
              <div
                data-testid="notif-bell-loading"
                role="status"
                className="px-3 py-6 text-center text-sm text-zinc-500"
              >
                جارٍ التحميل… / Loading…
              </div>
            ) : list.isError ? (
              <div
                role="alert"
                className="px-3 py-6 text-center text-sm text-red-600 dark:text-red-400"
              >
                {list.error.message}
              </div>
            ) : rows.length === 0 ? (
              <div
                data-testid="notif-bell-empty"
                role="status"
                className="px-3 py-6 text-center text-sm text-zinc-500"
              >
                لا توجد إشعارات / No notifications
              </div>
            ) : (
              <ul data-testid="notif-bell-list">
                {rows.map((row) => (
                  <li key={row.$id}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!row.is_read) markRead.mutate(row.$id)
                      }}
                      className={`block w-full px-3 py-2.5 text-start text-sm transition hover:bg-black/5 dark:hover:bg-white/10 ${
                        row.is_read
                          ? 'text-zinc-500'
                          : 'font-medium text-zinc-900 dark:text-zinc-100'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate">{row.title}</span>
                        {!row.is_read ? (
                          <span
                            aria-hidden="true"
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500"
                          />
                        ) : null}
                      </div>
                      <div className="mt-0.5 flex items-center justify-between gap-2 text-xs text-zinc-400">
                        <span>{bilingualKindLabel(row.kind)}</span>
                        <span dir="ltr">{formatDateTime(row.created_at)}</span>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="border-t border-black/5 px-3 py-2 text-center dark:border-white/5">
            <Link
              to="/notifications"
              onClick={() => setOpen(false)}
              className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
            >
              عرض الكل / View all
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
