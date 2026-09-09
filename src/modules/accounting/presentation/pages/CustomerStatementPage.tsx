/**
 * Customer account statement (كشف حساب) — Phase 4.1/4.2. A printable
 * running-balance ledger of one customer's credit-side invoices vs. their
 * receipts and return credit notes. Reads submitted documents through the
 * aging repo; the running-balance maths is the pure `domain/statement`.
 */
import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { formatCurrency, formatDate } from '@/shared/formatters'
import { ExportButton } from '@/shared/excel'
import { Card, PageHeader, PrintButton } from '@/shared/ui'
import { DocumentLetterhead } from '@/shared/documents'

import { customerStatementToRows, type StatementEntryKind } from '../../domain/statement'
import { useCustomerOptions, useCustomerStatement } from '../hooks'

const ENTRY_LABEL: Record<StatementEntryKind, string> = {
  invoice: 'فاتورة',
  receipt: 'تحصيل',
  return: 'مرتجع',
}

export function CustomerStatementPage() {
  const [params, setParams] = useSearchParams()
  const customerId = params.get('customer') ?? ''
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const customers = useCustomerOptions()
  const customerName = useMemo(
    () => customers.data?.find((c) => c.value === customerId)?.label ?? '',
    [customers.data, customerId],
  )

  const range = useMemo(
    () => ({
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    [from, to],
  )
  const query = useCustomerStatement(customerId || undefined, range)
  const statement = query.data

  const exportRows = useMemo(
    () =>
      statement
        ? customerStatementToRows(statement).map((r) => ({
            ...r,
            debit: round2(r.debit),
            credit: round2(r.credit),
            balance: round2(r.balance),
          }))
        : [],
    [statement],
  )

  return (
    <div className="space-y-4">
      <DocumentLetterhead
        reference={customerName ? `كشف حساب — ${customerName}` : undefined}
        subtitle={from || to ? `من ${from || '—'} إلى ${to || '—'}` : undefined}
      />
      <PageHeader
        title="كشف حساب عميل"
        titleEn="Customer statement"
        description="حركة حساب العميل: الفواتير الآجلة مقابل التحصيلات وإشعارات المرتجع، برصيد جارٍ."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              fileName={`customer-statement-${customerId || 'none'}`}
              rows={exportRows}
              columns={[
                { key: 'date', header: 'Date' },
                { key: 'type', header: 'Type' },
                { key: 'reference', header: 'Reference' },
                { key: 'debit', header: 'Debit' },
                { key: 'credit', header: 'Credit' },
                { key: 'balance', header: 'Balance' },
              ]}
              disabled={!statement}
            />
            <PrintButton documentTitle={customerName ? `كشف حساب · ${customerName}` : undefined} />
          </div>
        }
      />

      <Card className="flex flex-wrap items-end gap-3 no-print">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">العميل / Customer</span>
          <select
            value={customerId}
            onChange={(e) => {
              const next = new URLSearchParams(params)
              if (e.target.value) next.set('customer', e.target.value)
              else next.delete('customer')
              setParams(next, { replace: true })
            }}
            className="min-w-56 rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          >
            <option value="">اختر عميلًا…</option>
            {(customers.data ?? []).map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">من / From</span>
          <input
            type="date"
            dir="ltr"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">إلى / To</span>
          <input
            type="date"
            dir="ltr"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </label>
      </Card>

      {!customerId ? (
        <Card className="text-sm text-zinc-500">اختر عميلًا لعرض كشف الحساب.</Card>
      ) : query.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : query.isError ? (
        <Card className="flex flex-col items-start gap-2 text-sm text-red-600 dark:text-red-400">
          {query.error.message}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        </Card>
      ) : statement ? (
        <Card className="p-0">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-black/[0.02] text-xs text-zinc-500 dark:bg-white/[0.03]">
                <tr>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">النوع</th>
                  <th className="p-2 text-start">المرجع</th>
                  <th className="p-2 text-end">مدين</th>
                  <th className="p-2 text-end">دائن</th>
                  <th className="p-2 text-end">الرصيد</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-black/10 font-medium dark:border-white/10">
                  <td className="p-2" colSpan={5}>
                    رصيد افتتاحي / Opening balance
                  </td>
                  <td className="p-2 text-end tabular-nums" dir="ltr">
                    {formatCurrency(statement.openingBalance)}
                  </td>
                </tr>
                {statement.lines.map((line, i) => (
                  <tr
                    key={`${line.reference}-${i}`}
                    className="border-t border-black/5 dark:border-white/5"
                  >
                    <td className="p-2" dir="ltr">
                      {formatDate(line.date)}
                    </td>
                    <td className="p-2">{ENTRY_LABEL[line.kind]}</td>
                    <td className="p-2 font-mono text-xs" dir="ltr">
                      {line.reference}
                    </td>
                    <td className="p-2 text-end tabular-nums" dir="ltr">
                      {line.debit ? formatCurrency(line.debit) : '—'}
                    </td>
                    <td className="p-2 text-end tabular-nums" dir="ltr">
                      {line.credit ? formatCurrency(line.credit) : '—'}
                    </td>
                    <td className="p-2 text-end tabular-nums" dir="ltr">
                      {formatCurrency(line.balance)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-black/20 text-sm font-bold dark:border-white/20">
                <tr>
                  <td className="p-2" colSpan={3}>
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
      ) : null}
    </div>
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}
