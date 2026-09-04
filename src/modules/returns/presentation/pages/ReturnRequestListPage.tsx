/**
 * Return-request list. `doc_status` tabs drive the server-side filter (the
 * shared document repo supports it natively); the approval `status` tabs and
 * the reference/origin search narrow the loaded page client-side, same as
 * `SalesInvoiceListPage`.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import { formatDate } from '@/shared/formatters'
import { DataTable, useDebouncedValue, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Badge, Button, PageHeader } from '@/shared/ui'

import type { ReturnRequestRow, ReturnStatus } from '../../domain/schemas'
import { DocStatusPill } from '../components'
import { useReturnRequestList } from '../hooks'

const PAGE_SIZE = 25

const DOC_STATUS_TABS = [
  { key: 'all', label: 'الكل / All', value: undefined },
  { key: 'draft', label: 'مسودة / Draft', value: DocStatus.Draft },
  { key: 'submitted', label: 'معتمد / Submitted', value: DocStatus.Submitted },
  { key: 'cancelled', label: 'ملغي / Cancelled', value: DocStatus.Cancelled },
] as const

const STATUS_TABS: ReadonlyArray<{ key: string; label: string; value: ReturnStatus | undefined }> = [
  { key: 'all', label: 'كل الحالات', value: undefined },
  { key: 'pending', label: 'قيد الانتظار', value: 'pending' },
  { key: 'approved', label: 'مقبول', value: 'approved' },
  { key: 'rejected', label: 'مرفوض', value: 'rejected' },
]

const STATUS_TONE: Record<ReturnStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'danger',
}

const STATUS_LABEL: Record<ReturnStatus, string> = {
  pending: 'قيد الانتظار',
  approved: 'مقبول',
  rejected: 'مرفوض',
}

export function ReturnRequestListPage() {
  const navigate = useNavigate()
  const [docTab, setDocTab] = useState<(typeof DOC_STATUS_TABS)[number]['key']>('all')
  const [statusTab, setStatusTab] = useState<string>('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [search, setSearch] = useState('')

  const debouncedSearch = useDebouncedValue(search, 300)
  const docStatus = DOC_STATUS_TABS.find((t) => t.key === docTab)?.value
  const statusFilter = STATUS_TABS.find((t) => t.key === statusTab)?.value

  const query = useReturnRequestList({
    docStatus,
    page: pageIndex,
    pageSize: PAGE_SIZE,
  })

  const rows = useMemo(() => {
    let list = query.data?.rows ?? []
    if (statusFilter) list = list.filter((r) => r.status === statusFilter)
    const needle = debouncedSearch.trim().toLowerCase()
    if (needle) {
      list = list.filter(
        (r) =>
          r.reference_id.toLowerCase().includes(needle) ||
          r.origin_ref.toLowerCase().includes(needle),
      )
    }
    return list
  }, [query.data?.rows, statusFilter, debouncedSearch])

  const columns = useMemo<ColumnDef<ReturnRequestRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      { id: 'origin_ref', header: 'المستند الأصلي / Origin', accessor: (r) => r.origin_ref },
      {
        id: 'status',
        header: 'حالة الاعتماد / Status',
        accessor: (r) => r.status,
        cell: (r) => <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>,
      },
      {
        id: 'doc_status',
        header: 'المستند / Doc',
        accessor: (r) => r.doc_status,
        cell: (r) => <DocStatusPill status={r.doc_status} />,
      },
      { id: 'reason', header: 'السبب / Reason', accessor: (r) => r.reason },
      {
        id: 'posting',
        header: 'التاريخ / Date',
        accessor: (r) => r.posting_datetime,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="text-zinc-500">
            {formatDate(r.posting_datetime)}
          </span>
        ),
      },
      {
        id: '__actions',
        header: '',
        accessor: () => null,
        align: 'end',
        width: '7rem',
        cell: (r) => (
          <Button size="sm" variant="secondary" onClick={() => navigate(`/returns/requests/${r.$id}`)}>
            فتح
          </Button>
        ),
      },
    ],
    [navigate],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="طلبات المرتجعات"
        titleEn="Return requests"
        actions={<Button onClick={() => navigate('/returns/requests/new')}>+ طلب مرتجع جديد</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        {DOC_STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setDocTab(t.key)
              setPageIndex(0)
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              docTab === t.key
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'border border-black/15 dark:border-white/15'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setStatusTab(t.key)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              statusTab === t.key
                ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                : 'border border-black/15 dark:border-white/15'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالمرجع أو المستند الأصلي…"
          className="rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/15"
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد طلبات مرتجعات بعد"
      />
    </div>
  )
}
