/** Accounting landing page — KPI tiles + a card per sub-area. */
import { useMemo } from 'react'
import { Link } from 'react-router-dom'

import { formatCurrency } from '@/shared/formatters'
import { Card, PageHeader } from '@/shared/ui'

import { GlAccount } from '../../domain/gl'
import { overdueTotal } from '../../domain/aging'
import { useAccountBalance, useCustomerAging } from '../hooks'

const SECTIONS = [
  {
    to: '/accounting/receipts',
    ar: 'التحصيلات',
    en: 'Collections',
    desc: 'سندات تحصيل من العملاء مقابل الفواتير المعتمدة.',
  },
  {
    to: '/accounting/vouchers',
    ar: 'سندات الصرف والقبض',
    en: 'Payment vouchers',
    desc: 'حركات الخزينة الواردة والصادرة بسبب إلزامي.',
  },
  {
    to: '/accounting/aging',
    ar: 'أعمار الديون',
    en: 'Customer aging',
    desc: 'أرصدة العملاء موزّعة على فترات 0–30 / 31–60 / 61–90 / +90.',
  },
  {
    to: '/accounting/trial-balance',
    ar: 'ميزان المراجعة',
    en: 'Trial balance',
    desc: 'أرصدة الحسابات من دفتر الأستاذ.',
  },
  {
    to: '/accounting/ledger',
    ar: 'دفتر الأستاذ',
    en: 'General ledger',
    desc: 'كل القيود المزدوجة، قابلة للتصفية.',
  },
]

function Kpi({
  label,
  labelEn,
  value,
  loading,
  error,
}: {
  label: string
  labelEn: string
  value: string
  loading?: boolean
  error?: boolean
}) {
  return (
    <Card>
      <div className="text-xs text-zinc-400">
        {label} / {labelEn}
      </div>
      <div className="mt-1 text-xl font-semibold" dir="ltr">
        {loading ? '…' : error ? '—' : value}
      </div>
    </Card>
  )
}

export function AccountingHubPage() {
  const aging = useCustomerAging(useMemo(() => new Date(), []))
  const cash = useAccountBalance(GlAccount.Cash)
  const bank = useAccountBalance(GlAccount.Bank)

  const totalAr = (aging.data ?? []).reduce((s, r) => s + Math.max(r.outstanding, 0), 0)
  const overdueAr = (aging.data ?? []).reduce((s, r) => s + overdueTotal(r), 0)
  const cashPosition = (cash.data ?? 0) + (bank.data ?? 0)

  return (
    <div className="space-y-4">
      <PageHeader
        title="المحاسبة"
        titleEn="Accounting"
        description="التحصيلات والسندات والذمم ودفتر الأستاذ."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="إجمالي الذمم"
          labelEn="Total AR"
          value={formatCurrency(totalAr)}
          loading={aging.isLoading}
          error={aging.isError}
        />
        <Kpi
          label="ذمم متأخرة"
          labelEn="Overdue AR"
          value={formatCurrency(overdueAr)}
          loading={aging.isLoading}
          error={aging.isError}
        />
        <Kpi
          label="السيولة (نقد + بنك)"
          labelEn="Cash position"
          value={formatCurrency(cashPosition)}
          loading={cash.isLoading || bank.isLoading}
          error={cash.isError || bank.isError}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link
            key={section.to}
            to={section.to}
            className="rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
          >
            <div className="font-semibold">{section.ar}</div>
            <div className="text-xs text-zinc-400">{section.en}</div>
            <p className="mt-2 text-sm text-zinc-500">{section.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
