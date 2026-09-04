/**
 * Given a product's BOM lines and a planned quantity, show the exploded
 * raw-material demand (`requiredMaterialsFor`). Presentation only — the maths is
 * in `domain/planning.ts`.
 */
import { useMemo } from 'react'

import type { AppError } from '@/core/errors'
import type { ProductBomLine } from '@/modules/admin'
import { formatQuantity } from '@/shared/formatters'
import { Card } from '@/shared/ui'

import { requiredMaterialsFor } from '../../domain/planning'
import type { RequiredMaterialLine } from '../../domain/schemas'

export interface BomExplosionPanelProps {
  bomLines: ProductBomLine[]
  plannedQty: number
  /** Resolve a raw-material id to a display name; falls back to the id. */
  rawMaterialName?: (rawMaterialId: string) => string
  isLoading?: boolean
  error?: AppError | null
}

export function BomExplosionPanel({
  bomLines,
  plannedQty,
  rawMaterialName,
  isLoading = false,
  error = null,
}: BomExplosionPanelProps) {
  const qtyIsValid = Number.isFinite(plannedQty) && plannedQty > 0

  const demand = useMemo<RequiredMaterialLine[]>(
    () => (qtyIsValid ? requiredMaterialsFor(bomLines, plannedQty) : []),
    [bomLines, plannedQty, qtyIsValid],
  )

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">الاحتياج من الخامات / Required materials</h3>
      </div>

      {isLoading ? (
        <p className="text-sm text-zinc-500">جارٍ تحميل قائمة المواد…</p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error.message}</p>
      ) : !qtyIsValid ? (
        <p className="text-sm text-zinc-500">أدخل كمية مخططة أكبر من صفر لعرض الاحتياج.</p>
      ) : bomLines.length === 0 ? (
        <p className="text-sm text-amber-700 dark:text-amber-300">
          لا توجد قائمة مواد لهذا المنتج. أضِفها من شاشة المنتجات أولًا.
        </p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
          {demand.map((line) => (
            <li key={line.raw_material_id} className="flex items-center justify-between py-1.5">
              <span>{rawMaterialName?.(line.raw_material_id) ?? line.raw_material_id}</span>
              <span dir="ltr" className="tabular-nums text-zinc-600 dark:text-zinc-300">
                {formatQuantity(line.qty)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
