/** HR landing page — a card per sub-area. */
import { Link } from 'react-router-dom'

import { PageHeader } from '@/shared/ui'

const SECTIONS = [
  {
    to: '/hr/attendance',
    ar: 'الحضور والانصراف',
    en: 'Attendance',
    desc: 'سجل حضور يومي لكل موظف وملخص شهري.',
  },
  {
    to: '/hr/incentive-rules',
    ar: 'قواعد الحوافز',
    en: 'Incentive rules',
    desc: 'عمولات المبيعات ومكافآت الإنتاج والحضور.',
  },
  {
    to: '/hr/payroll',
    ar: 'الرواتب',
    en: 'Payroll',
    desc: 'مسيرات رواتب: مسودة → اعتماد → إلغاء.',
  },
]

export function HrHubPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="الموارد البشرية"
        titleEn="HR"
        description="الحضور وقواعد الحوافز ومسيرات الرواتب."
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
