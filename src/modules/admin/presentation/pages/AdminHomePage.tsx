/**
 * Admin index — a card per master-data entity linking to its list, with a live
 * row count.
 */
import { Link } from 'react-router-dom'

import { Card, PageHeader } from '@/shared/ui'

import { ENTITY_LABELS } from '../../domain/labels'
import { useAdminCounts } from '../hooks/useAdminCounts'
import { ADMIN_ENTITY_SLUG, ADMIN_LIST_ENTITIES } from '../registry'

export function AdminHomePage() {
  const counts = useAdminCounts()

  return (
    <div className="space-y-4">
      <PageHeader
        title="الإدارة"
        titleEn="Admin"
        description="البيانات الأساسية: الفروع والمخازن والمستخدمون والمنتجات والخامات والموردون والعملاء."
      />

      {counts.isError ? (
        <Card className="text-sm text-red-600 dark:text-red-400">{counts.error.message}</Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {ADMIN_LIST_ENTITIES.map((entity) => {
          const label = ENTITY_LABELS[entity]
          const value = counts.data?.[entity]
          return (
            <Link
              key={entity}
              to={`/admin/${ADMIN_ENTITY_SLUG[entity]}`}
              className="rounded-xl border border-black/10 bg-white p-5 shadow-sm transition hover:border-black/20 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-white/20"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="font-semibold">{label.many.ar}</span>
                <span className="text-2xl font-bold tabular-nums" dir="ltr">
                  {counts.isLoading ? '…' : (value ?? 0)}
                </span>
              </div>
              <span className="text-xs text-zinc-400">{label.many.en}</span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
