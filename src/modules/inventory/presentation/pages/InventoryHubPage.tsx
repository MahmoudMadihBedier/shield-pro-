/** Inventory landing page — a card per sub-area. */
import { Link } from 'react-router-dom'

import { PageHeader } from '@/shared/ui'

const SECTIONS = [
  {
    to: '/inventory/stock',
    ar: 'الرصيد الحالي',
    en: 'Stock on hand',
    desc: 'أرصدة الأصناف في كل مخزن (إسقاط دفتر المخزون).',
  },
  {
    to: '/inventory/transfers',
    ar: 'التحويلات',
    en: 'Warehouse transfers',
    desc: 'طلب → اعتماد → إرسال → تأكيد الاستلام.',
  },
  {
    to: '/inventory/counts',
    ar: 'الجرد',
    en: 'Stock counts',
    desc: 'جلسات جرد فعلي واحتساب الفروقات.',
  },
  {
    to: '/inventory/write-offs',
    ar: 'الهالك',
    en: 'Write-offs',
    desc: 'تسجيل التلف والفقد والخردة.',
  },
]

export function InventoryHubPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="المخزون"
        titleEn="Inventory"
        description="الأرصدة والتحويلات والجرد والهالك."
      />
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
