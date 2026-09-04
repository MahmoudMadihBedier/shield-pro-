/**
 * Production batches list. Server-side paging + `reference_id` search via the
 * shared document list; client-side `qc_status` filter (same tradeoff as the
 * request list).
 */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import { DataTable, useDebouncedValue, type ColumnDef } from '@/shared/data-table'
import { formatCurrency, formatDate, formatQuantity } from '@/shared/formatters'
import { Badge, Button, PageHeader } from '@/shared/ui'

import { QC_STATUSES, type ProductionBatch, type QcStatus } from '../../domain/schemas'
import { useProductOptions } from '../hooks/catalog'
import { useProductionBatchList } from '../hooks/documents'
import { QC_STATUS_LABEL, QC_STATUS_TONE } from '../labels'

const PAGE_SIZE = 25

const DOC_STATUS_LABEL: Record<number, string> = {
  [DocStatus.Draft]: 'مسودة',
  [DocStatus.Submitted]: 'معتمد',
  [DocStatus.Cancelled]: 'ملغى',
}

export function ProductionBatchListPage() {
  const [searchInput, setSearchInput] = useState('')
  const search = useDebouncedValue(searchInput.trim())
  const [page, setPage] = useState(0)
  const [qcFilter, setQcFilter] = useState<QcStatus | ''>('')

  const query = useProductionBatchList({ search, page, pageSize: PAGE_SIZE })
  const products = useProductOptions()

  const productName = useMemo(() => {
    const map = new Map((products.data ?? []).map((p) => [p.$id, p.name]))
    return (id: string) => map.get(id) ?? id
  }, [products.data])

  const rows = useMemo(() => {
    const all = query.data?.rows ?? []
    return qcFilter ? all.filter((r) => r.qc_status === qcFilter) : all
  }, [query.data?.rows, qcFilter])

  const columns = useMemo<ColumnDef<ProductionBatch>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع', accessor: (r) => r.reference_id },
      { id: 'lot_number', header: 'رقم التشغيلة', accessor: (r) => r.lot_number },
      { id: 'product', header: 'المنتج', accessor: (r) => productName(r.product_id) },
      {
        id: 'produced_qty',
        header: 'المنتجة',
        align: 'end',
        accessor: (r) => r.produced_qty,
        cell: (r) => <span dir="ltr">{formatQuantity(r.produced_qty)}</span>,
      },
      {
        id: 'waste_qty',
        header: 'الهالك',
        align: 'end',
        accessor: (r) => r.waste_qty,
        cell: (r) => <span dir="ltr">{formatQuantity(r.waste_qty)}</span>,
      },
      {
        id: 'expected_profit',
        header: 'الربح المتوقع',
        align: 'end',
        accessor: (r) => r.expected_profit,
        cell: (r) => <span dir="ltr">{formatCurrency(r.expected_profit)}</span>,
      },
      {
        id: 'qc_status',
        header: 'فحص الجودة',
        accessor: (r) => r.qc_status,
        cell: (r) => <Badge tone={QC_STATUS_TONE[r.qc_status]}>{QC_STATUS_LABEL[r.qc_status]}</Badge>,
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
          <Link to={`/manufacturing/batches/${r.$id}`}>
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
        title="أوامر التشغيل"
        titleEn="Production batches"
        actions={
          <Link to="/manufacturing/batches/new">
            <Button>+ أمر تشغيل</Button>
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
        emptyMessage="لا توجد أوامر تشغيل"
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
              value={qcFilter}
              onChange={(e) => setQcFilter(e.target.value as QcStatus | '')}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            >
              <option value="">كل حالات الفحص</option>
              {QC_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {QC_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
        }
      />
    </div>
  )
}
