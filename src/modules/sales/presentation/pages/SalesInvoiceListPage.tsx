/**
 * Sales-invoice list. Status tabs drive the server-side `doc_status` filter and
 * a reference search; rep / customer / date narrow the loaded page client-side
 * (the shared document list has no server filter for those yet).
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { DocStatus } from '@/core/doc-status'
import { formatCurrency, formatDate } from '@/shared/formatters'
import {
  DataTable,
  useDebouncedValue,
  type ColumnDef,
  type PaginationState,
} from '@/shared/data-table'
import { Button, PageHeader } from '@/shared/ui'

import type { SalesInvoiceRow } from '../../domain/schemas'
import { DocStatusPill } from '../components'
import { useCustomerOptions, useRepOptions, useSalesInvoiceList, optionLabelMap } from '../hooks'
import { PAYMENT_METHOD_LABEL } from '../labels'

const PAGE_SIZE = 25

const STATUS_TABS = [
  { key: 'all', label: 'الكل / All', value: undefined },
  { key: 'draft', label: 'مسودة / Draft', value: DocStatus.Draft },
  { key: 'submitted', label: 'معتمد / Submitted', value: DocStatus.Submitted },
  { key: 'cancelled', label: 'ملغي / Cancelled', value: DocStatus.Cancelled },
] as const

export function SalesInvoiceListPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]['key']>('all')
  const [pageIndex, setPageIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [repId, setRepId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [date, setDate] = useState('')

  const debouncedSearch = useDebouncedValue(search, 300)
  const docStatus = STATUS_TABS.find((t) => t.key === tab)?.value

  const query = useSalesInvoiceList({
    docStatus,
    search: debouncedSearch || undefined,
    page: pageIndex,
    pageSize: PAGE_SIZE,
  })

  const reps = useRepOptions()
  const customers = useCustomerOptions()
  const repLabel = useMemo(() => optionLabelMap(reps.data), [reps.data])
  const customerLabel = useMemo(() => optionLabelMap(customers.data), [customers.data])

  const rows = useMemo(() => {
    let list = query.data?.rows ?? []
    if (repId) list = list.filter((r) => r.rep_user_id === repId)
    if (customerId) list = list.filter((r) => r.customer_id === customerId)
    if (date) list = list.filter((r) => r.posting_datetime.slice(0, 10) === date)
    return list
  }, [query.data?.rows, repId, customerId, date])

  const columns = useMemo<ColumnDef<SalesInvoiceRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'customer',
        header: 'العميل / Customer',
        accessor: (r) => r.customer_id,
        cell: (r) => customerLabel.get(r.customer_id) ?? r.customer_id,
      },
      {
        id: 'rep',
        header: 'المندوب / Rep',
        accessor: (r) => r.rep_user_id,
        cell: (r) => repLabel.get(r.rep_user_id) ?? r.rep_user_id,
      },
      {
        id: 'net_total',
        header: 'الصافي / Net',
        accessor: (r) => r.net_total,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="tabular-nums">
            {formatCurrency(r.net_total)}
          </span>
        ),
      },
      {
        id: 'payment_method',
        header: 'الدفع / Payment',
        accessor: (r) => r.payment_method,
        cell: (r) => PAYMENT_METHOD_LABEL[r.payment_method],
      },
      {
        id: 'doc_status',
        header: 'الحالة / Status',
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
            onClick={() => navigate(`/sales/invoices/${r.$id}`)}
          >
            فتح
          </Button>
        ),
      },
    ],
    [navigate, customerLabel, repLabel],
  )

  return (
    <div className="space-y-4">
      <PageHeader
        title="فواتير المبيعات"
        titleEn="Sales invoices"
        actions={<Button onClick={() => navigate('/sales/invoices/new')}>+ فاتورة جديدة</Button>}
      />

      <div className="flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key)
              setPageIndex(0)
            }}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              tab === t.key
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
          placeholder="بحث بالمرجع…"
          className="rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/15"
        />
        <select
          value={repId}
          onChange={(e) => setRepId(e.target.value)}
          className="rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/15"
        >
          <option value="">كل المندوبين</option>
          {(reps.data ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={customerId}
          onChange={(e) => setCustomerId(e.target.value)}
          className="rounded-lg border border-black/15 bg-transparent px-3 py-1.5 text-sm dark:border-white/15"
        >
          <option value="">كل العملاء</option>
          {(customers.data ?? []).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <input
          type="date"
          dir="ltr"
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
        emptyMessage="لا توجد فواتير"
      />
    </div>
  )
}
