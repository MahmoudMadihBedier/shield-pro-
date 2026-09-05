/**
 * Full paginated notification list — all / unread filter, mark-read per row,
 * mark-all-read (Implementation Plan §4 / Phase 2 Story 2.6). Uses the shared
 * `DataTable` (`claude.md` B.6) for pagination + the loading / error / empty
 * states; this page owns only the filter tabs and the mark-read actions.
 */
import { useMemo, useState } from 'react'

import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { formatDateTime } from '@/shared/formatters'
import { Badge, Button, PageHeader } from '@/shared/ui'

import { bilingualKindLabel, type Notification } from './domain'
import {
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  useNotificationList,
} from './useNotifications'

const PAGE_SIZE = 25

type Filter = 'all' | 'unread'

export function NotificationsPage() {
  const [filter, setFilter] = useState<Filter>('all')
  const [pageIndex, setPageIndex] = useState(0)

  const query = useNotificationList({
    onlyUnread: filter === 'unread',
    page: pageIndex,
    pageSize: PAGE_SIZE,
  })
  const markRead = useMarkNotificationRead()
  const markAllRead = useMarkAllNotificationsRead()

  const rows = query.data?.rows ?? []
  const total = query.data?.total ?? 0
  const hasUnread = rows.some((r) => !r.is_read)

  const columns = useMemo<ColumnDef<Notification>[]>(
    () => [
      {
        id: 'status',
        header: '',
        accessor: (r) => r.is_read,
        width: '2.5rem',
        cell: (r) =>
          !r.is_read ? (
            <span
              aria-label="غير مقروء / Unread"
              className="block h-2 w-2 rounded-full bg-sky-500"
            />
          ) : null,
      },
      {
        id: 'kind',
        header: 'النوع / Kind',
        accessor: (r) => r.kind,
        cell: (r) => (
          <Badge tone={r.is_read ? 'neutral' : 'info'}>{bilingualKindLabel(r.kind)}</Badge>
        ),
      },
      {
        id: 'title',
        header: 'العنوان / Title',
        accessor: (r) => r.title,
        cell: (r) => (
          <div className={r.is_read ? 'text-zinc-500' : 'font-medium'}>
            <div>{r.title}</div>
            {r.body ? <div className="mt-0.5 text-xs text-zinc-400">{r.body}</div> : null}
          </div>
        ),
      },
      {
        id: 'created_at',
        header: 'التاريخ / Date',
        accessor: (r) => r.created_at,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDateTime(r.created_at)}
          </span>
        ),
      },
      {
        id: '__actions',
        header: '',
        accessor: () => null,
        align: 'end',
        width: '9rem',
        cell: (r) =>
          !r.is_read ? (
            <Button
              size="sm"
              variant="secondary"
              disabled={markRead.isPending}
              onClick={() => markRead.mutate(r.$id)}
            >
              تحديد كمقروء / Mark read
            </Button>
          ) : null,
      },
    ],
    [markRead],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="الإشعارات"
        titleEn="Notifications"
        description="تنبيهات النظام: بلاغات الاحتيال، طلبات الموافقة، ومزيد لاحقًا."
        actions={
          <Button
            disabled={!hasUnread || markAllRead.isPending}
            onClick={() => markAllRead.mutate()}
          >
            تحديد الكل كمقروء / Mark all read
          </Button>
        }
      />

      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filter === 'all' ? 'primary' : 'secondary'}
          onClick={() => {
            setFilter('all')
            setPageIndex(0)
          }}
        >
          الكل / All
        </Button>
        <Button
          size="sm"
          variant={filter === 'unread' ? 'primary' : 'secondary'}
          onClick={() => {
            setFilter('unread')
            setPageIndex(0)
          }}
        >
          غير مقروء / Unread
        </Button>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage={filter === 'unread' ? 'لا توجد إشعارات غير مقروءة' : 'لا توجد إشعارات'}
      />
    </div>
  )
}
