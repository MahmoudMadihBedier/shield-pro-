/**
 * Supplier performance — Phase 4.2. One row per supplier from the
 * `supplier_performance` RPC (aggregated over `purchase_orders`,
 * branch-scoped server-side): order count, spend, average order value,
 * cancellation rate, and recency. Printable + CSV/Excel export.
 */
import { useMemo } from 'react'

import { Role } from '@/core/rbac'
import { RequireRole } from '@/presentation/components/RequireRole'
import { formatCurrency, formatDate, formatNumber, formatPercent } from '@/shared/formatters'
import { ExportButton } from '@/shared/excel'
import { Card, PageHeader, PrintButton } from '@/shared/ui'
import { DocumentLetterhead } from '@/shared/documents'

import {
  daysSinceLastOrder,
  sortBySpend,
  supplierPerformanceToRows,
} from '../../domain/supplier-performance'
import { useSupplierPerformance } from '../hooks/useSupplierPerformance'

/** Highlight a supplier that has gone quiet. */
const STALE_DAYS = 90

const ALLOWED_ROLES = [Role.PurchasingAccountant, Role.SystemAdmin] as const

export function SupplierPerformancePage() {
  return (
    <RequireRole
      anyOf={ALLOWED_ROLES}
      fallback={
        <Card className="text-sm text-zinc-500">
          هذا التقرير متاح لمحاسب المشتريات ومدير النظام فقط.
        </Card>
      }
    >
      <SupplierPerformanceReport />
    </RequireRole>
  )
}

function SupplierPerformanceReport() {
  const query = useSupplierPerformance()
  const report = query.data

  const rows = useMemo(() => (report ? sortBySpend(report.rows) : []), [report])
  const exportRows = useMemo(() => (report ? supplierPerformanceToRows(report) : []), [report])

  return (
    <div className="space-y-4">
      <DocumentLetterhead reference="أداء الموردين / Supplier performance" />
      <PageHeader
        title="أداء الموردين"
        titleEn="Supplier performance"
        description="من أوامر الشراء: عدد الأوامر، الإنفاق، متوسط قيمة الأمر، نسبة الإلغاء، وآخر تعامل."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              fileName="supplier-performance"
              rows={exportRows}
              columns={[
                { key: 'supplier', header: 'Supplier' },
                { key: 'orders', header: 'Orders' },
                { key: 'spend', header: 'Spend' },
                { key: 'avg_order_value', header: 'Avg order value' },
                { key: 'cancelled', header: 'Cancelled' },
                { key: 'cancel_rate_pct', header: 'Cancel rate %' },
                { key: 'last_order', header: 'Last order' },
              ]}
              disabled={!report || report.rows.length === 0}
            />
            <PrintButton documentTitle="أداء الموردين" />
          </div>
        }
      />

      {query.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : query.isError ? (
        <Card className="flex flex-col items-start gap-2 text-sm text-red-600 dark:text-red-400">
          {query.error.message}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        </Card>
      ) : !report || report.rows.length === 0 ? (
        <Card className="text-sm text-zinc-500">لا توجد أوامر شراء لعرض أداء الموردين.</Card>
      ) : (
        <>
          <Card className="flex flex-wrap items-baseline justify-between gap-2">
            <span className="text-sm text-zinc-500">
              إجمالي الإنفاق / Total spend ({formatNumber(report.supplierCount)} مورد)
            </span>
            <span className="text-lg font-bold tabular-nums" dir="ltr">
              {formatCurrency(report.totalSpend)}
            </span>
          </Card>

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                  <tr>
                    <th className="p-2 text-start">المورد / Supplier</th>
                    <th className="p-2 text-end">الأوامر / Orders</th>
                    <th className="p-2 text-end">الإنفاق / Spend</th>
                    <th className="p-2 text-end">متوسط الأمر / Avg</th>
                    <th className="p-2 text-end">ملغاة / Cancelled</th>
                    <th className="p-2 text-end">نسبة الإلغاء / Cancel %</th>
                    <th className="p-2 text-end">آخر تعامل / Last order</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const stale = (daysSinceLastOrder(row) ?? 0) > STALE_DAYS
                    return (
                      <tr
                        key={row.supplierId}
                        className="border-t border-black/5 dark:border-white/5"
                      >
                        <td className="p-2">{row.supplierName}</td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {formatNumber(row.orderCount)}
                        </td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {formatCurrency(row.submittedValue)}
                        </td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {formatCurrency(row.avgOrderValue)}
                        </td>
                        <td className="p-2 text-end tabular-nums" dir="ltr">
                          {row.cancelledCount ? formatNumber(row.cancelledCount) : '—'}
                        </td>
                        <td
                          className={`p-2 text-end tabular-nums ${
                            row.cancelRate >= 0.2 ? 'text-red-600 dark:text-red-400' : ''
                          }`}
                          dir="ltr"
                        >
                          {formatPercent(row.cancelRate)}
                        </td>
                        <td
                          className={`p-2 text-end tabular-nums ${
                            stale ? 'text-amber-700 dark:text-amber-300' : ''
                          }`}
                          dir="ltr"
                        >
                          {row.lastOrderAt ? formatDate(row.lastOrderAt) : '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
