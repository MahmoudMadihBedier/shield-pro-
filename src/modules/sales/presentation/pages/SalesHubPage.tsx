/** Landing page for the sales section — links into the three workflows. */
import { Link } from 'react-router-dom'

import { Card, PageHeader } from '@/shared/ui'

const SECTIONS = [
  {
    to: '/sales/invoices',
    ar: 'الفواتير',
    en: 'Sales invoices',
    desc: 'إصدار فواتير المبيعات وترحيلها إلى دفاتر المخزون والأستاذ.',
  },
  {
    to: '/sales/rep-issues',
    ar: 'صرف عهدة المندوب',
    en: 'Rep stock issues',
    desc: 'طلب واعتماد صرف بضاعة من المخزن الفرعي إلى عهدة المندوب.',
  },
  {
    to: '/sales/closeouts',
    ar: 'تقفيل المندوب اليومي',
    en: 'Rep daily close-out',
    desc: 'مطابقة: المصروف = المُباع + المرتجع + المتبقي، ومطابقة النقدية.',
  },
] as const

export function SalesHubPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="المبيعات" titleEn="Sales" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((section) => (
          <Link key={section.to} to={section.to} className="block">
            <Card className="h-full transition hover:border-zinc-400 dark:hover:border-zinc-500">
              <h3 className="text-sm font-semibold">
                {section.ar} <span className="text-zinc-400">/ {section.en}</span>
              </h3>
              <p className="mt-1 text-sm text-zinc-500">{section.desc}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
