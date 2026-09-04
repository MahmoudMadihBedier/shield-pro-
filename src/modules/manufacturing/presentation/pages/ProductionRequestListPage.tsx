/**
 * Production requests list. Shared `DataTable` with server-side paging + search
 * on `reference_id`, plus a client-side `status` filter (the shared document
 * list query does not filter arbitrary business columns — acceptable at this
 * volume; revisit with a dedicated index if the table grows).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import { useDebouncedValue, DataTable, type ColumnDef } from '@/shared/data-table'
import { formatDate, formatQuantity } from '@/shared/formatters'
import { Badge, Button, PageHeader } from '@/shared/ui'

import {
  PRODUCTION_REQUEST_STATUSES,
  type ProductionRequest,
  type ProductionRequestStatus,
} from '../../domain/schemas'
import { useProductOptions } from '../hooks/catalog'
import { useProductionRequestList } from '../hooks/documents'
import { REQUEST_STATUS_LABEL, REQUEST_STATUS_TONE } from '../labels'

const PAGE_SIZE = 25

const DOC_STATUS_LABEL: Record<number, string> = {
  [DocStatus.Draft]: 'مسودة',
  [DocStatus.Submitted]: 'معتمد',
  [DocStatus.Cancelled]: 'ملغى',
}

export function ProductionRequestListPage() {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [page, setPage] = useState(0)
  const [statusFilter, setStatusFilter] = useState<ProductionRequestStatus | ''>('')

  const query = useProductionRequestList({ search, page, pageSize: PAGE_SIZE })
  const products = useProductOptions()

  const productName = useMemo(() => {
    const map = new Map((products.data ?? []).map((p) => [p.$id, p.name]))
    return (id: string) => map.get(id) ?? id
  }, [products.data])

  const rows = useMemo(() => {
    const all = query.data?.rows ?? []
    return statusFilter ? all.filter((r) => r.status === statusFilter) : all
  }, [query.data?.rows, statusFilter])

  const columns = useMemo<ColumnDef<ProductionRequest>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع', accessor: (r) => r.reference_id },
      { id: 'product', header: 'المنتج', accessor: (r) => productName(r.product_id) },
      {
        id: 'planned_qty',
        header: 'الكمية المخططة',
        align: 'end',
        accessor: (r) => r.planned_qty,
        cell: (r) => <span dir="ltr">{formatQuantity(r.planned_qty)}</span>,
      },
      {
        id: 'status',
        header: 'حالة الطلب',
        accessor: (r) => r.status,
        cell: (r) => (
          <Badge tone={REQUEST_STATUS_TONE[r.status]}>{REQUEST_STATUS_LABEL[r.status]}</Badge>
        ),
      },
      {
        id: 'doc_status',
        header: 'حالة المستند',
        accessor: (r) => r.doc_status,
        cell: (r) => DOC_STATUS_LABEL[r.doc_status] ?? String(r.doc_status),
      },
      {
        id: 'posting_datetime',
        header: 'التاريخ',
        accessor: (r) => r.posting_datetime,
        cell: (r) => <span dir="ltr">{formatDate(r.posting_datetime)}</span>,
      },
      {
        id: '__actions',
        header: '',
        align: 'end',
        width: '8rem',
        accessor: () => null,
        cell: (r) => (
          <Link to={`/manufacturing/requests/${r.$id}`}>
            <Button size="sm" variant="secondary">
              عرض
            </Button>
          </Link>
        ),
      },
    ],
    [productName],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="طلبات الإنتاج"
        titleEn="Production requests"
        actions={
          <Link to="/manufacturing/requests/new">
            <Button>+ طلب إنتاج</Button>
          </Link>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.$id}
        pagination={{ pageIndex: page, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next) => setPage(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد طلبات إنتاج"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={searchInput}
              onChange={(e) => {
                setSearchInput(e.target.value)
                setPage(0)
              }}
              placeholder="بحث برقم المرجع…"
              className="w-full max-w-xs rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ProductionRequestStatus | '')}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            >
              <option value="">كل الحالات</option>
              {PRODUCTION_REQUEST_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {REQUEST_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </div>
  )
}
