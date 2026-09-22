/**
 * Cash flow statement — indirect method — for a chosen period. Operating
 * (net income adjusted for AR/AP movement), Investing (nothing this system
 * posts today), Financing (capital contributed minus withdrawn).
 */
import { useMemo, useState } from 'react'

import { DocumentLetterhead } from '@/shared/documents'
import { formatCurrency } from '@/shared/formatters'
import { Badge, Card, PageHeader } from '@/shared/ui'

import { useCashFlowStatement } from '../hooks'

function startOfMonthIso(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function Row({
  label,
  labelEn,
  value,
  bold,
}: {
  label: string
  labelEn: string
  value: number
  bold?: boolean
}) {
  return (
    <div className={`flex justify-between text-sm ${bold ? 'font-semibold' : ''}`}>
      <span className="text-zinc-600 dark:text-zinc-400">
        {label} / {labelEn}
      </span>
      <span dir="ltr">{formatCurrency(value)}</span>
    </div>
  )
}

export function CashFlowStatementPage() {
  const [from, setFrom] = useState(startOfMonthIso())
  const [to, setTo] = useState(todayIso())

  const range = useMemo(
    () => ({
      from: new Date(`${from}T00:00:00.000Z`).toISOString(),
      to: new Date(`${to}T23:59:59.999Z`).toISOString(),
    }),
    [from, to],
  )

  const query = useCashFlowStatement(range)
  const cf = query.data

  return (
    <div className="space-y-4">
      <DocumentLetterhead />
      <PageHeader
        title="قائمة التدفقات النقدية"
        titleEn="Cash flow statement"
        description="الطريقة غير المباشرة: صافي الربح مُعدَّلاً بحركة رأس المال العامل، لفترة محددة."
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
        {cf ? (
          <Badge tone={cf.reconciles ? 'success' : 'danger'}>
            {cf.reconciles ? 'متوافقة مع الرصيد الفعلي' : 'غير متوافقة'}
          </Badge>
        ) : null}
      </Card>

      {query.isLoading ? <Card className="text-sm text-zinc-500">جارٍ التحميل…</Card> : null}
      {query.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{query.error.message}</Card>
      ) : null}

      {cf ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="space-y-2">
            <div className="text-sm font-semibold">الأنشطة التشغيلية / Operating activities</div>
            <Row label="صافي الربح" labelEn="Net income" value={cf.netIncome} />
            <Row
              label="التغير في الذمم المدينة"
              labelEn="Change in AR"
              value={-cf.accountsReceivableChange}
            />
            <Row
              label="التغير في الذمم الدائنة"
              labelEn="Change in AP"
              value={cf.accountsPayableChange}
            />
            <Row
              label="صافي التدفق التشغيلي"
              labelEn="Net operating cash flow"
              value={cf.operatingActivities}
              bold
            />
          </Card>

          <Card className="space-y-2">
            <div className="text-sm font-semibold">الأنشطة الاستثمارية / Investing activities</div>
            <p className="text-xs text-zinc-500">
              لا توجد أنشطة استثمارية مسجَّلة (شراء أصول ثابتة نقدًا) في هذا النظام حتى الآن.
            </p>
            <Row
              label="صافي التدفق الاستثماري"
              labelEn="Net investing cash flow"
              value={cf.investingActivities}
              bold
            />
          </Card>

          <Card className="space-y-2">
            <div className="text-sm font-semibold">الأنشطة التمويلية / Financing activities</div>
            <Row
              label="رأس مال مُساهَم به (نقدًا)"
              labelEn="Capital contributed"
              value={cf.capitalContributed}
            />
            <Row label="رأس مال مسحوب" labelEn="Capital withdrawn" value={-cf.capitalWithdrawn} />
            <Row
              label="صافي التدفق التمويلي"
              labelEn="Net financing cash flow"
              value={cf.financingActivities}
              bold
            />
          </Card>

          <Card className="space-y-2 lg:col-span-3">
            <Row
              label="صافي التغير في النقدية"
              labelEn="Net change in cash"
              value={cf.netChangeInCash}
              bold
            />
            <Row
              label="النقدية أول الفترة"
              labelEn="Cash, beginning of period"
              value={cf.cashBeginning}
            />
            <Row
              label="النقدية آخر الفترة"
              labelEn="Cash, end of period"
              value={cf.cashEnding}
              bold
            />
          </Card>
        </div>
      ) : null}
    </div>
  )
}
