/**
 * Customer account statement — a running-balance ledger of the customer's own
 * submitted invoices (debits) vs. receipts (credits). The maths is the pure
 * `buildPortalStatement`; this page only renders and prints it. There is no
 * server statement route — it folds the two `portal_*` list reads the portal
 * already makes.
 */
import { useMemo } from 'react'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { Card, PageHeader } from '@/shared/ui'
import { DocumentLetterhead } from '@/shared/documents'

import { usePortalAuth } from '../auth/portal-context'
import { usePortalInvoices, usePortalReceipts } from '../hooks'
import { buildPortalStatement } from '../statement'

const STATEMENT_PAGE_SIZE = 100

export function PortalStatementPage() {
  const { customer } = usePortalAuth()
  const invoices = usePortalInvoices({ page: 0, pageSize: STATEMENT_PAGE_SIZE })
  const receipts = usePortalReceipts({ page: 0, pageSize: STATEMENT_PAGE_SIZE })

  const isLoading = invoices.isLoading || receipts.isLoading
  const isError = invoices.isError || receipts.isError

  const statement = useMemo(
    () =>
      buildPortalStatement({
        invoices: invoices.data?.rows ?? [],
        receipts: receipts.data?.rows ?? [],
      }),
    [invoices.data, receipts.data],
  )

  // The two reads are capped at STATEMENT_PAGE_SIZE — say so rather than
  // present a partial ledger as complete.
  const truncated =
    (invoices.data ? invoices.data.total > STATEMENT_PAGE_SIZE : false) ||
    (receipts.data ? receipts.data.total > STATEMENT_PAGE_SIZE : false)

  return (
    <div className="space-y-4">
      <DocumentLetterhead
        reference="كشف حساب / Account statement"
        subtitle={customer ? `${customer.name} — ${customer.code}` : undefined}
      />
      <PageHeader
        title="كشف الحساب"
        description="الفواتير والتحصيلات مرتّبة حسب التاريخ، برصيد جارٍ"
      />

      {isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">تعذّر تحميل كشف الحساب.</Card>
      ) : statement.rows.length === 0 ? (
        <Card className="text-sm text-zinc-500">لا توجد حركات بعد.</Card>
      ) : (
        <>
          {truncated ? (
            <Card className="text-xs text-amber-700 dark:text-amber-300">
              يعرض هذا الكشف أحدث {STATEMENT_PAGE_SIZE} فاتورة و{STATEMENT_PAGE_SIZE} تحصيل فقط.
              للحصول على كشف كامل تواصل مع المحاسبة.
            </Card>
          ) : null}

          <Card className="p-0">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                  <tr>
                    <th className="p-2 text-start">التاريخ</th>
                    <th className="p-2 text-start">البيان</th>
                    <th className="p-2 text-end">مدين</th>
                    <th className="p-2 text-end">دائن</th>
                    <th className="p-2 text-end">الرصيد</th>
                  </tr>
                </thead>
                <tbody>
                  {statement.rows.map((row) => (
                    <tr
                      key={`${row.kind}-${row.id}`}
                      className="border-t border-black/5 dark:border-white/5"
                    >
                      <td className="p-2" dir="ltr">
                        {formatDate(row.date)}
                      </td>
                      <td className="p-2">
                        {row.kind === 'invoice' ? 'فاتورة' : 'تحصيل'}{' '}
                        <span className="font-mono text-xs" dir="ltr">
                          {row.reference}
                        </span>
                      </td>
                      <td className="p-2 text-end tabular-nums" dir="ltr">
                        {row.debit ? formatCurrency(row.debit) : '—'}
                      </td>
                      <td
                        className="p-2 text-end tabular-nums text-emerald-700 dark:text-emerald-400"
                        dir="ltr"
                      >
                        {row.credit ? formatCurrency(row.credit) : '—'}
                      </td>
                      <td className="p-2 text-end tabular-nums" dir="ltr">
                        {formatCurrency(row.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-black/20 text-sm font-bold dark:border-white/20">
                  <tr>
                    <td className="p-2" colSpan={2}>
                      الإجمالي / رصيد ختامي
                    </td>
                    <td className="p-2 text-end tabular-nums" dir="ltr">
                      {formatCurrency(statement.totalDebit)}
                    </td>
                    <td className="p-2 text-end tabular-nums" dir="ltr">
                      {formatCurrency(statement.totalCredit)}
                    </td>
                    <td
                      className={`p-2 text-end tabular-nums ${
                        statement.closingBalance > 0 ? 'text-red-600 dark:text-red-400' : ''
                      }`}
                      dir="ltr"
                    >
                      {formatCurrency(statement.closingBalance)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}
