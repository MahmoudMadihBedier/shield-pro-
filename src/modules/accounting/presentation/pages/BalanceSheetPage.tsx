/**
 * Balance sheet — Assets = Liabilities + Equity, as of a chosen date.
 * Equity includes both posted capital accounts and the cumulative net income
 * to date ("retained earnings", since this system posts no formal period-end
 * closing entries).
 */
import { useState } from 'react'

import { DocumentLetterhead } from '@/shared/documents'
import { formatCurrency, formatDate } from '@/shared/formatters'
import { Badge, Card, PageHeader } from '@/shared/ui'

import type { BalanceSheetLine, BalanceSheetSection } from '../../domain/balance-sheet'
import { useBalanceSheet } from '../hooks'

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function SectionTable({
  title,
  titleEn,
  section,
}: {
  title: string
  titleEn: string
  section: BalanceSheetSection
}) {
  return (
    <div>
      <div className="mb-1 text-sm font-semibold">
        {title} / {titleEn}
      </div>
      {section.lines.length === 0 ? (
        <p className="text-sm text-zinc-500">لا توجد حسابات</p>
      ) : (
        <table className="w-full text-sm">
          <tbody>
            {section.lines.map((line: BalanceSheetLine) => (
              <tr key={line.account} className="border-b border-black/5 dark:border-white/5">
                <td className="py-1 text-zinc-600 dark:text-zinc-400">{line.account}</td>
                <td className="py-1 text-end" dir="ltr">
                  {formatCurrency(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="mt-1 flex justify-between border-t border-black/10 pt-1 text-sm font-semibold dark:border-white/10">
        <span>الإجمالي / Total</span>
        <span dir="ltr">{formatCurrency(section.total)}</span>
      </div>
    </div>
  )
}

export function BalanceSheetPage() {
  const [asOf, setAsOf] = useState(todayIso())
  const query = useBalanceSheet(asOf)
  const sheet = query.data

  return (
    <div className="space-y-4">
      <DocumentLetterhead />
      <PageHeader
        title="الميزانية العمومية"
        titleEn="Balance sheet"
        description="الأصول = الالتزامات + حقوق الملكية، حتى تاريخ محدد."
      />

      <Card className="flex flex-wrap items-end gap-3">
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">حتى تاريخ / As of</span>
          <input
            type="date"
            dir="ltr"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
          />
        </label>
        {sheet ? (
          <Badge tone={sheet.balanced ? 'success' : 'danger'}>
            {sheet.balanced ? 'متوازنة' : 'غير متوازنة'}
          </Badge>
        ) : null}
      </Card>

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}

      {sheet ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="space-y-4">
            <SectionTable title="الأصول" titleEn="Assets" section={sheet.assets} />
          </Card>

          <Card className="space-y-4">
            <SectionTable title="الالتزامات" titleEn="Liabilities" section={sheet.liabilities} />
            <SectionTable title="رأس المال" titleEn="Capital accounts" section={sheet.capital} />
            <div className="flex justify-between text-sm">
              <span className="text-zinc-600 dark:text-zinc-400">
                أرباح محتجزة (صافي الربح حتى الآن) / Retained earnings
              </span>
              <span dir="ltr">{formatCurrency(sheet.retainedEarnings)}</span>
            </div>
            <div className="flex justify-between border-t border-black/10 pt-1 text-sm font-semibold dark:border-white/10">
              <span>إجمالي حقوق الملكية / Total equity</span>
              <span dir="ltr">{formatCurrency(sheet.totalEquity)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold">
              <span>الالتزامات + حقوق الملكية / Liabilities + equity</span>
              <span dir="ltr">{formatCurrency(sheet.totalLiabilitiesAndEquity)}</span>
            </div>
          </Card>
        </div>
      ) : null}

      {sheet ? (
        <p className="text-xs text-zinc-500" dir="ltr">
          As of {formatDate(sheet.asOf)}
        </p>
      ) : null}
    </div>
  )
}
