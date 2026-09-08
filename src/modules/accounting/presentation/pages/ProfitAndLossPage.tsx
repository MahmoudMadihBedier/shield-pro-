/**
 * Profit & Loss statement — Phase 4.2 (report) + 4.1 (Excel export). Reads the
 * live GL through the `trial_balance` RPC (branch-scoped server-side) and
 * re-classifies the accounts into P&L sections. Date range optional.
 */
import { useMemo, useState } from 'react'

import { formatCurrency, formatPercent } from '@/shared/formatters'
import { ExportButton } from '@/shared/excel'
import { Card, PageHeader } from '@/shared/ui'
import { DocumentLetterhead } from '@/shared/documents'

import { profitAndLossToRows, type PnlSectionResult } from '../../domain/pnl'
import { useProfitAndLoss } from '../hooks'

const SECTION_LABEL: Record<string, string> = {
  revenue: 'الإيرادات / Revenue',
  contra_revenue: 'مردودات ومسموحات / Returns & allowances',
  cogs: 'تكلفة البضاعة المباعة / COGS',
  operating_expense: 'المصروفات التشغيلية / Operating expenses',
  other_income: 'إيرادات أخرى / Other income',
  other_expense: 'مصروفات أخرى / Other expenses',
}

export function ProfitAndLossPage() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const range = useMemo(
    () => ({
      // `T00:00:00` (no `Z`) = local wall-clock, so a day bound means the local
      // day boundary, not UTC — the product locale is Cairo (EGP, UTC+2/+3).
      from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
      to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
    }),
    [from, to],
  )

  const query = useProfitAndLoss(range)
  const pnl = query.data

  const exportRows = useMemo(
    () =>
      (pnl ? profitAndLossToRows(pnl) : []).map((r) => ({
        section: r.section,
        account: r.account,
        amount: r.amount,
      })),
    [pnl],
  )

  return (
    <div className="space-y-4">
      <DocumentLetterhead />
      <PageHeader
        title="قائمة الدخل"
        titleEn="Profit & Loss"
        description="الإيرادات والمصروفات من دفتر الأستاذ الحيّ — بدون تجميع مخزّن مسبقًا."
        actions={
          <ExportButton
            fileName={`profit-and-loss${from || to ? `-${from || 'start'}_${to || 'now'}` : ''}`}
            rows={exportRows}
            columns={[
              { key: 'section', header: 'Section' },
              { key: 'account', header: 'Account' },
              { key: 'amount', header: 'Amount' },
            ]}
            disabled={!pnl}
          />
        }
      />

      <Card className="flex flex-wrap items-end gap-3">
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

      {query.isLoading ? (
        <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card>
      ) : query.isError ? (
        <Card className="flex flex-col items-start gap-2 text-sm text-red-600 dark:text-red-400">
          {query.error.message}
          <button type="button" className="underline" onClick={() => void query.refetch()}>
            إعادة المحاولة
          </button>
        </Card>
      ) : pnl ? (
        <Card>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <tbody>
                <Section section={pnl.revenue} />
                <Section section={pnl.contraRevenue} negate />
                <SubtotalRow label="صافي الإيرادات / Net revenue" value={pnl.netRevenue} />
                <Section section={pnl.cogs} negate />
                <SubtotalRow label="مجمل الربح / Gross profit" value={pnl.grossProfit} />
                <Section section={pnl.operatingExpense} negate />
                <SubtotalRow
                  label="الربح التشغيلي / Operating profit"
                  value={pnl.operatingProfit}
                />
                <Section section={pnl.otherIncome} />
                <Section section={pnl.otherExpense} negate />
                <SubtotalRow label="صافي الربح / Net profit" value={pnl.netProfit} strong />
                <tr>
                  <td className="px-2 py-2 text-zinc-500">هامش صافي الربح / Net margin</td>
                  <td className="px-2 py-2 text-end tabular-nums" dir="ltr">
                    {formatPercent(pnl.netMargin)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function Section({ section, negate = false }: { section: PnlSectionResult; negate?: boolean }) {
  if (section.lines.length === 0) return null
  const sign = negate ? -1 : 1
  return (
    <>
      <tr className="border-t border-black/10 dark:border-white/10">
        <td className="px-2 pt-3 pb-1 font-semibold" colSpan={2}>
          {SECTION_LABEL[section.section] ?? section.section}
        </td>
      </tr>
      {section.lines.map((line) => (
        <tr key={`${section.section}-${line.account}`}>
          <td className="px-2 py-1 ps-6 text-zinc-600 dark:text-zinc-300" dir="ltr">
            {line.account}
          </td>
          <td className="px-2 py-1 text-end tabular-nums" dir="ltr">
            {formatCurrency(sign * line.amount)}
          </td>
        </tr>
      ))}
      <tr>
        <td className="px-2 py-1 ps-6 text-zinc-500">
          إجمالي {SECTION_LABEL[section.section]?.split(' / ')[0] ?? section.section}
        </td>
        <td className="px-2 py-1 text-end font-medium tabular-nums" dir="ltr">
          {formatCurrency(sign * section.total)}
        </td>
      </tr>
    </>
  )
}

function SubtotalRow({
  label,
  value,
  strong = false,
}: {
  label: string
  value: number
  strong?: boolean
}) {
  return (
    <tr className="border-t border-black/20 dark:border-white/20">
      <td className={`px-2 py-2 ${strong ? 'text-base font-bold' : 'font-semibold'}`}>{label}</td>
      <td
        className={`px-2 py-2 text-end tabular-nums ${strong ? 'text-base font-bold' : 'font-semibold'} ${
          value < 0 ? 'text-red-600 dark:text-red-400' : ''
        }`}
        dir="ltr"
      >
        {formatCurrency(value)}
      </td>
    </tr>
  )
}
