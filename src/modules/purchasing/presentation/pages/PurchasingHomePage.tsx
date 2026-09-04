/**
 * Purchasing hub — entry cards for the two documents in the module.
 */
import { Link } from 'react-router-dom'

import { PageHeader } from '@/shared/ui'

import { PURCHASING_LABELS } from '../../domain/labels'

const CARDS = [
  {
    to: '/purchasing/orders',
    label: PURCHASING_LABELS.purchaseOrder.many,
    desc: 'إنشاء أوامر الشراء واعتمادها لدى الموردين.',
  },
  {
    to: '/purchasing/receipts',
    label: PURCHASING_LABELS.stockReceipt.many,
    desc: 'تسجيل استلام الخامات مقابل أوامر شراء معتمدة وترحيلها إلى المخزون.',
  },
]

export function PurchasingHomePage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title={PURCHASING_LABELS.section.ar}
        titleEn={PURCHASING_LABELS.section.en}
        description="دورة الشراء: أمر شراء ← استلام خامات ← ترحيل إلى دفتر المخزون."
      />

      <div className="grid gap-3 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
          >
            <div className="font-semibold">{card.label.ar}</div>
            <div className="text-xs text-zinc-400">{card.label.en}</div>
            <p className="mt-2 text-sm text-zinc-500">{card.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
