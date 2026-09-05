/**
 * Raw materials below their reorder point. A severity `Badge` marks how deep
 * the shortfall is — status color ships with a label, never alone.
 */
import { formatQuantity } from '@/shared/formatters'
import { Badge, type BadgeTone } from '@/shared/ui'

import type { ReorderAlert } from '../../domain/reorder-alerts'

export interface ReorderAlertListProps {
  rows: readonly ReorderAlert[]
  /** `rawMaterialId -> "code — name"`; falls back to the raw id when unresolved. */
  materialLabel: ReadonlyMap<string, string>
  emptyMessage: string
}

/** Out of stock entirely is "critical"; any other shortfall is "serious". */
function severityTone(onHand: number): BadgeTone {
  return onHand <= 0 ? 'danger' : 'warning'
}

export function ReorderAlertList({ rows, materialLabel, emptyMessage }: ReorderAlertListProps) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-500">{emptyMessage}</p>
  }

  return (
    <ul className="divide-y divide-black/5 dark:divide-white/5">
      {rows.map((row) => (
        <li key={row.rawMaterialId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span className="truncate">{materialLabel.get(row.rawMaterialId) ?? row.rawMaterialId}</span>
          <span className="flex items-center gap-2" dir="ltr">
            <span className="text-zinc-500 dark:text-zinc-400">
              {formatQuantity(row.onHand)} / {formatQuantity(row.reorderPoint)}
            </span>
            <Badge tone={severityTone(row.onHand)}>
              {row.onHand <= 0 ? 'نفدت الكمية' : `نقص ${formatQuantity(row.shortfall)}`}
            </Badge>
          </span>
        </li>
      ))}
    </ul>
  )
}
