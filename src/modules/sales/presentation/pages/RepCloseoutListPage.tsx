/**
 * Rep close-out list + an inline "open a close-out" form. A close-out is unique
 * per (rep, business_date) — `scripts/appwrite/schema.ts` enforces it with a
 * unique index; this page also checks the loaded rows to fail fast with a
 * friendly message.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { formatCurrency, formatNumber } from '@/shared/formatters'
import { DataTable, type ColumnDef, type PaginationState } from '@/shared/data-table'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { canActOnSales } from '../../domain/permissions'
import type { RepCloseoutRow } from '../../domain/schemas'
import { DocStatusPill } from '../components'
import { optionLabelMap, useRepCloseoutActions, useRepCloseoutList, useRepOptions } from '../hooks'
import { CLOSEOUT_STATUS_LABEL, CLOSEOUT_STATUS_TONE } from '../labels'

const PAGE_SIZE = 25
const EMPTY_OBJECT_BAG = JSON.stringify({ products: [], cash: [] })

export function RepCloseoutListPage() {
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnSales(principal)

  const [pageIndex, setPageIndex] = useState(0)
  const [repId, setRepId] = useState('')
  const [date, setDate] = useState('')
  const [openError, setOpenError] = useState<string | null>(null)

  const query = useRepCloseoutList({ page: pageIndex, pageSize: PAGE_SIZE })
  const reps = useRepOptions()
  const repLabel = useMemo(() => optionLabelMap(reps.data), [reps.data])
  const { createDraft } = useRepCloseoutActions()

  const rows = query.data?.rows ?? []

  const open = async () => {
    setOpenError(null)
    if (!repId || !date) {
      setOpenError('اختر المندوب وتاريخ يوم العمل.')
      return
    }
    if (rows.some((r) => r.rep_user_id === repId && r.business_date === date)) {
      setOpenError('يوجد تقفيل لهذا المندوب في هذا التاريخ بالفعل.')
      return
    }
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          rep_user_id: repId,
          business_date: date,
          expected: EMPTY_OBJECT_BAG,
          actual: EMPTY_OBJECT_BAG,
          stock_variance: 0,
          cash_variance: 0,
          status: 'open',
        },
      })
      navigate(`/sales/closeouts/${row.$id}`)
    } catch (e) {
      setOpenError(e instanceof Error ? e.message : 'تعذّر فتح التقفيل.')
    }
  }

  const columns = useMemo<ColumnDef<RepCloseoutRow>[]>(
    () => [
      { id: 'reference_id', header: 'المرجع / Ref', accessor: (r) => r.reference_id },
      {
        id: 'rep',
        header: 'المندوب / Rep',
        accessor: (r) => r.rep_user_id,
        cell: (r) => repLabel.get(r.rep_user_id) ?? r.rep_user_id,
      },
      { id: 'business_date', header: 'يوم العمل / Date', accessor: (r) => r.business_date },
      {
        id: 'stock_variance',
        header: 'فرق المخزون / Stock Δ',
        accessor: (r) => r.stock_variance,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="tabular-nums">
            {formatNumber(r.stock_variance)}
          </span>
        ),
      },
      {
        id: 'cash_variance',
        header: 'فرق النقدية / Cash Δ',
        accessor: (r) => r.cash_variance,
        align: 'end',
        cell: (r) => (
          <span dir="ltr" className="tabular-nums">
            {formatCurrency(r.cash_variance)}
          </span>
        ),
      },
      {
        id: 'status',
        header: 'الحالة / Status',
        accessor: (r) => r.status,
        cell: (r) => (
          <Badge tone={CLOSEOUT_STATUS_TONE[r.status]}>{CLOSEOUT_STATUS_LABEL[r.status]}</Badge>
        ),
      },
      {
        id: 'doc_status',
        header: 'المستند / Doc',
        accessor: (r) => r.doc_status,
        cell: (r) => <DocStatusPill status={r.doc_status} />,
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
            onClick={() => navigate(`/sales/closeouts/${r.$id}`)}
          >
            فتح
          </Button>
        ),
      },
    ],
    [navigate, repLabel],
  )

  return (
    <div className="space-y-4">
      <PageHeader title="تقفيلات المندوبين اليومية" titleEn="Rep daily close-outs" />

      {canAct ? (
        <Card className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">المندوب / Rep</span>
            <select
              value={repId}
              onChange={(e) => setRepId(e.target.value)}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            >
              <option value="">اختر مندوبًا…</option>
              {(reps.data ?? []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">يوم العمل / Date</span>
            <input
              type="date"
              dir="ltr"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
            />
          </label>
          <Button disabled={createDraft.isPending} onClick={() => void open()}>
            فتح تقفيل
          </Button>
          {openError ? (
            <p className="w-full text-xs text-red-600 dark:text-red-400">{openError}</p>
          ) : null}
        </Card>
      ) : null}

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.$id}
        pagination={{ pageIndex, pageSize: PAGE_SIZE, total: query.data?.total ?? 0 }}
        onPaginationChange={(next: PaginationState) => setPageIndex(next.pageIndex)}
        isLoading={query.isLoading}
        error={query.isError ? query.error : null}
        onRetry={() => void query.refetch()}
        emptyMessage="لا توجد تقفيلات"
      />
    </div>
  )
}
