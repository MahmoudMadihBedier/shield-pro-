/**
 * Manufacturing section landing page — two entry points: production requests
 * (factory → raw store) and production batches / work orders.
 */
import { Link } from 'react-router-dom'

import { Card, PageHeader } from '@/shared/ui'

const CARDS = [
  {
    to: '/manufacturing/requests',
    title: 'طلبات الإنتاج',
    titleEn: 'Production requests',
    body: 'طلب تحويل الخامات من مخزن المشتريات إلى المصنع، مع اعتماد الكميات المطلوبة من قائمة المواد.',
  },
  {
    to: '/manufacturing/batches',
    title: 'أوامر التشغيل',
    titleEn: 'Production batches',
    body: 'تسجيل التشغيلة: الكمية المنتجة والهالك، الخامات المستهلكة، فحص الجودة، ثم الاعتماد وترحيل المخزون.',
  },
] as const

export function ManufacturingHubPage() {
  return (
    <div className="space-y-4">
      <PageHeader title="التصنيع" titleEn="Manufacturing" />
      <div className="grid gap-4 sm:grid-cols-2">
        {CARDS.map((card) => (
          <Link key={card.to} to={card.to} className="block">
            <Card className="h-full transition hover:border-black/25 dark:hover:border-white/25">
              <h3 className="text-base font-semibold">
                {card.title}
                <span className="text-zinc-400"> / {card.titleEn}</span>
              </h3>
              <p className="mt-2 text-sm text-zinc-500">{card.body}</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
