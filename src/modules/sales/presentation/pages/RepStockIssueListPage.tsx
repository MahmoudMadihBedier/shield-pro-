/** Rep stock-issue list. Reference search (server) + workflow-status narrowing. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { formatDate } from '@/shared/formatters'
import {
  DataTable,
  useDebouncedValue,
  type ColumnDef,
  type PaginationState,
} from '@/shared/data-table'
import { Badge, Button, PageHeader } from '@/shared/ui'

import { REP_ISSUE_STATUSES, type RepStockIssueRow } from '../../domain/schemas'
import { DocStatusPill } from '../components'
import {
  optionLabelMap,
  useRepOptions,
  useRepStockIssueList,
  useSubWarehouseOptions,
} from '../hooks'
import { REP_ISSUE_STATUS_LABEL, REP_ISSUE_STATUS_TONE } from '../labels'

const PAGE_SIZE = 25

export function RepStockIssueListPage() {
  const navigate = useNavigate()
  const [pageIndex, setPageIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const debouncedSearch = useDebouncedValue(search, 300)

  const query = useRepStockIssueList({
    search: debouncedSearch || undefined,
    page: pageIndex,
    pageSize: PAGE_SIZE,
  })
  const reps = useRepOptions()
  const subWarehouses = useSubWarehouseOptions()
  const repLabel = useMemo(() => optionLabelMap(reps.data), [reps.data])
  const whLabel = useMemo(() => optionLabelMap(subWarehouses.data), [subWarehouses.data])

  const rows = useMemo(() => {
    const list = query.data?.rows ?? []
    return status ? list.filter((r) => r.status === status) : list
  }, [query.data?.rows, status])

  const columns = useMemo<ColumnDef<RepStockIssueRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'sub_warehouse',
        header: 'المخزن الفرعي / Sub-WH',
        accessor: (r) => r.sub_warehouse_id,
        cell: (r) => whLabel.get(r.sub_warehouse_id) ?? r.sub_warehouse_id,
      },
      {
        id: 'rep',
        header: 'المندوب / Rep',
        accessor: (r) => r.rep_user_id,
        cell: (r) => repLabel.get(r.rep_user_id) ?? r.rep_user_id,
      },
      {
        id: 'status',
        header: 'سير العمل / Flow',
        accessor: (r) => r.status,
        cell: (r) => (
          <Badge tone={REP_ISSUE_STATUS_TONE[r.status]}>{REP_ISSUE_STATUS_LABEL[r.status]}</Badge>
        ),
      },
      {
        id: 'doc_status',
        header: 'المستند / Doc',
        accessor: (r) => r.doc_status,
        cell: (r) => <DocStatusPill status={r.doc_status} />,
      },
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
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate(`/sales/rep-issues/${r.$id}`)}
          >
            فتح
          </Button>
        ),
      },
    ],
    [navigate, repLabel, whLabel],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="صرف عُهد المندوبين"
        titleEn="Rep stock issues"
        actions={<Button onClick={() => navigate('/sales/rep-issues/new')}>+ صرف جديد</Button>}
      />

      <div className="flex flex-wrap gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالمرجع…"
          className="rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/15"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/15"
        >
          <option value="">كل الحالات</option>
          {REP_ISSUE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {REP_ISSUE_STATUS_LABEL[s]}
            </option>
          ))}
        </select>
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
        emptyMessage="لا توجد أذون صرف"
      />
    </div>
  )
}
