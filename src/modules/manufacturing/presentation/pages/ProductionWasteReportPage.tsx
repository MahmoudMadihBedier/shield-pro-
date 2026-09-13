/**
 * Production Waste Report (Plan §4.1 export, §4.2 "production output, waste
 * %"). Reads Submitted batches only (a Draft has no final produced/waste
 * figures yet), bounded to a capped, newest-first scan — same "bounded read,
 * not an unbounded scan" discipline as the reports dashboard
 * (`@/modules/reports/data/dashboard-repo.ts`).
 */
import { useMemo, useState } from 'react'

import { DocStatus } from '@/core/doc-status'
import { DataTable, type ColumnDef } from '@/shared/data-table'
import { ExportButton } from '@/shared/excel'
import { formatDate, formatPercent, formatQuantity } from '@/shared/formatters'
import { Badge, PageHeader } from '@/shared/ui'

import {
  buildProductWasteLookup,
  buildWasteReportRows,
  summarizeWasteReport,
  wasteReportToCsvRows,
  type WasteReportRow,
} from '../../domain/waste-report'
import { useProductOptions } from '../hooks/catalog'
import { useProductionBatchList } from '../hooks/documents'

/** Newest-first, capped — a report is a bounded read, never an unbounded scan. */
const SCAN_CAP = 500

export function ProductionWasteReportPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const batches = useProductionBatchList({
    docStatus: DocStatus.Submitted,
    pageSize: SCAN_CAP,
    sort: { column: 'posting_datetime', dir: 'desc' },
  })
  const products = useProductOptions()

  const rows = useMemo<WasteReportRow[]>(() => {
    const lookup = buildProductWasteLookup(products.data ?? [])
    const all = buildWasteReportRows(batches.data?.rows ?? [], lookup)
    // `from`/`to` are local calendar days (`<input type="date">`); parsing them
    // without a timezone designator makes `Date` treat them as local-day
    // boundaries, so the comparison lines up with the viewer's own calendar
    // day rather than drifting by Egypt's UTC offset at midnight.
    const fromTime = from ? new Date(`${from}T00:00:00`).getTime() : null
    const toTime = to ? new Date(`${to}T23:59:59.999`).getTime() : null
    return all.filter((r) => {
      const t = new Date(r.postingDatetime).getTime()
      if (fromTime !== null && t < fromTime) return false
      if (toTime !== null && t > toTime) return false
      return true
    })
  }, [batches.data?.rows, products.data, from, to])

  const summary = useMemo(() => summarizeWasteReport(rows), [rows])
  const exportRows = useMemo(() => wasteReportToCsvRows(rows), [rows])

  const columns = useMemo<ColumnDef<WasteReportRow>[]>(
    () => [
      { id: 'referenceId', header: 'المرجع', accessor: (r) => r.referenceId },
      { id: 'lotNumber', header: 'رقم التشغيلة', accessor: (r) => r.lotNumber },
      { id: 'productName', header: 'المنتج', accessor: (r) => r.productName },
      {
        id: 'producedQty',
        header: 'المنتجة',
        align: 'end',
        accessor: (r) => r.producedQty,
        cell: (r) => <span dir="ltr">{formatQuantity(r.producedQty)}</span>,
      },
      {
        id: 'wasteQty',
        header: 'الهالك',
        align: 'end',
        accessor: (r) => r.wasteQty,
        cell: (r) => <span dir="ltr">{formatQuantity(r.wasteQty)}</span>,
      },
      {
        id: 'ratio',
        header: 'نسبة الهالك',
        align: 'end',
        accessor: (r) => r.ratio,
        cell: (r) => (
          <span dir="ltr" className="tabular-nums">
            {formatPercent(r.ratio)}
          </span>
        ),
      },
      {
        id: 'allowedPct',
        header: 'المسموح به',
        align: 'end',
        accessor: (r) => r.allowedPct,
        cell: (r) => (
          <span dir="ltr" className="tabular-nums">
            {formatPercent(r.allowedPct / 100)}
          </span>
        ),
      },
      {
        id: 'withinAllowance',
        header: 'الحالة',
        accessor: (r) => r.withinAllowance,
        cell: (r) => (
          <Badge tone={r.withinAllowance ? 'success' : 'danger'}>
            {r.withinAllowance ? 'ضمن المسموح' : 'تجاوز المسموح'}
          </Badge>
        ),
      },
      {
        id: 'postingDatetime',
        header: 'التاريخ',
        accessor: (r) => r.postingDatetime,
        cell: (r) => <span dir="ltr">{formatDate(r.postingDatetime)}</span>,
      },
    ],
    [],
  )

  const error = batches.isError ? batches.error : products.isError ? products.error : null

  return (
    <div className="space-y-4">
      <PageHeader
        title="تقرير الهالك"
        titleEn="Production waste report"
        actions={
          <ExportButton
            rows={exportRows}
            columns={[
              { key: 'reference_id', header: 'المرجع' },
              { key: 'lot_number', header: 'رقم التشغيلة' },
              { key: 'product', header: 'المنتج' },
              { key: 'produced_qty', header: 'المنتجة' },
              { key: 'waste_qty', header: 'الهالك' },
              { key: 'waste_pct', header: 'نسبة الهالك %' },
              { key: 'allowed_waste_pct', header: 'المسموح به %' },
              { key: 'within_allowance', header: 'ضمن المسموح' },
              { key: 'posting_datetime', header: 'التاريخ' },
            ]}
            fileName={`production-waste-report-${new Date().toISOString().slice(0, 10)}`}
          />
        }
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SummaryCard label="عدد الأوامر" value={String(summary.batchCount)} />
        <SummaryCard label="إجمالي المنتج" value={formatQuantity(summary.totalProduced)} />
        <SummaryCard label="إجمالي الهالك" value={formatQuantity(summary.totalWaste)} />
        <SummaryCard
          label="نسبة الهالك الإجمالية"
          value={formatPercent(summary.overallRatio)}
          tone={summary.exceedingCount > 0 ? 'danger' : undefined}
        />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(r) => r.$id}
        isLoading={batches.isLoading || products.isLoading}
        error={error}
        onRetry={() => {
          void batches.refetch()
          void products.refetch()
        }}
        emptyMessage="لا توجد أوامر تشغيل معتمدة في هذه الفترة"
        toolbar={
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm">
              من
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              إلى
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
              />
            </label>
          </div>
        }
      />

      {(batches.data?.total ?? 0) > SCAN_CAP ? (
        <p className="text-xs text-amber-700 dark:text-amber-400">
          هناك أكثر من {SCAN_CAP} أمر تشغيل معتمد — هذا التقرير يعرض الأحدث {SCAN_CAP} فقط. ضيّق
          نطاق التاريخ لعرض فترة أقدم.
        </p>
      ) : null}
    </div>
  )
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone?: 'danger' }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white p-3 dark:border-white/10 dark:bg-zinc-900">
      <p className="text-xs text-zinc-500">{label}</p>
      <p
        className={
          tone === 'danger'
            ? 'mt-1 text-lg font-semibold text-red-600 dark:text-red-400'
            : 'mt-1 text-lg font-semibold'
        }
      >
        {value}
      </p>
    </div>
  )
}
