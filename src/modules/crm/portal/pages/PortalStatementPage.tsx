/**
 * Customer account statement — a running-balance ledger of the customer's own
 * submitted credit-side invoices (debits) vs. return credit notes and receipts
 * (credits). The whole computation is server-side (`portal_statement` RPC,
 * migration 0028) over the full account history, so the balance is authoritative
 * and matches the accounting-side statement. This page only renders and prints.
 */
import { formatCurrency, formatDate } from '@/shared/formatters'
import { Card, PageHeader } from '@/shared/ui'
import { DocumentLetterhead } from '@/shared/documents'

import { usePortalAuth } from '../auth/portal-context'
import { usePortalStatement } from '../hooks'

const KIND_LABEL: Record<'invoice' | 'return' | 'receipt', string> = {
  invoice: 'فاتورة',
  return: 'إشعار مرتجع',
  receipt: 'تحصيل',
}

export function PortalStatementPage() {
  const { customer } = usePortalAuth()
  const query = usePortalStatement()
  const statement = query.data

  return (
    <div className="space-y-4">
      <DocumentLetterhead
        reference="كشف حساب / Account statement"
        subtitle={customer ? `${customer.name} — ${customer.code}` : undefined}
      />
      <PageHeader
        title="كشف الحساب"
        description="الفواتير الآجلة مقابل التحصيلات وإشعارات المرتجع، برصيد جارٍ"
      />

      {query.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : query.isError ? (
        <Card className="flex flex-col items-start gap-2 text-sm text-red-600 dark:text-red-400">
          {query.error.message}
          <button type="button" className="no-print underline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        </Card>
      ) : !statement || statement.rows.length === 0 ? (
        <Card className="text-sm text-zinc-500">لا توجد حركات على الحساب.</Card>
      ) : (
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
                {statement.rows.map((row, i) => (
                  <tr
                    key={`${row.kind}-${row.reference}-${i}`}
                    className="border-t border-black/5 dark:border-white/5"
                  >
                    <td className="p-2" dir="ltr">
                      {formatDate(row.date)}
                    </td>
                    <td className="p-2">
                      {KIND_LABEL[row.kind]}{' '}
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
      )}
    </div>
  )
}
