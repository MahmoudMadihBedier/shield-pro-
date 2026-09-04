/** Returns landing page — one entry into the return-request list. */
import { Link } from 'react-router-dom'

import { PageHeader } from '@/shared/ui'

const SECTIONS = [
  {
    to: '/returns/requests',
    ar: 'طلبات المرتجعات',
    en: 'Return requests',
    desc: 'طلب → اعتماد / رفض → اعتماد المستند → ترحيل إلى دفتر المخزون.',
  },
]

export function ReturnsHubPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="المرتجعات"
        titleEn="Returns"
        description="مرتجعات المبيعات والتحويلات واستلامات الخامات — دون أي تعديل مباشر على الرصيد."
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
