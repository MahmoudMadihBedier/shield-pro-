/**
 * Account statement: a client-side merge of the customer's own invoices and
 * receipts into one running list, sorted by date. No server-side statement
 * route exists (or is needed) for this — it's a display merge of two routes
 * that already exist.
 */
import { useMemo } from 'react'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { Card, PageHeader } from '@/shared/ui'

import { usePortalInvoices, usePortalReceipts } from '../hooks'
import { portalPaymentMethodLabel } from '../labels'

const STATEMENT_PAGE_SIZE = 100

type StatementRow =
  | { kind: 'invoice'; id: string; date: string; label: string; amount: number }
  | { kind: 'receipt'; id: string; date: string; label: string; amount: number }

export function PortalStatementPage() {
  const invoices = usePortalInvoices({ page: 0, pageSize: STATEMENT_PAGE_SIZE })
  const receipts = usePortalReceipts({ page: 0, pageSize: STATEMENT_PAGE_SIZE })

  const isLoading = invoices.isLoading || receipts.isLoading
  const isError = invoices.isError || receipts.isError

  const rows = useMemo<StatementRow[]>(() => {
    const invoiceRows: StatementRow[] = (invoices.data?.rows ?? []).map((inv) => ({
      kind: 'invoice',
      id: inv.id,
      date: inv.postingDatetime,
      label: `فاتورة ${inv.referenceId} (${portalPaymentMethodLabel(inv.paymentMethod)})`,
      amount: inv.netTotal,
    }))
    const receiptRows: StatementRow[] = (receipts.data?.rows ?? []).map((r) => ({
      kind: 'receipt',
      id: r.id,
      date: r.postingDatetime,
      label: `تحصيل ${r.invoiceRef}`,
      amount: -r.amount,
    }))
    return [...invoiceRows, ...receiptRows].sort((a, b) => b.date.localeCompare(a.date))
  }, [invoices.data, receipts.data])

  return (
    <div className="space-y-4">
      <PageHeader title="كشف الحساب" description="الفواتير والتحصيلات مرتّبة حسب التاريخ" />

      <Card>
        {isLoading ? (
          <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
        ) : isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">تعذّر تحميل كشف الحساب.</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-zinc-500">لا توجد حركات بعد.</p>
        ) : (
          <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
            {rows.map((row) => (
              <li key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-3 py-2">
                <span className="min-w-0 truncate">{row.label}</span>
                <span dir="ltr" className="shrink-0 text-xs text-zinc-400">
                  {formatDate(row.date)}
                </span>
                <span
                  dir="ltr"
                  className={`shrink-0 tabular-nums ${row.amount < 0 ? 'text-emerald-700 dark:text-emerald-400' : ''}`}
                >
                  {formatCurrency(row.amount)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
