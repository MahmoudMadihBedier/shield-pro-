/**
 * Pending approval requests that have breached their SLA window. A severity
 * `Badge` marks how far past the SLA the request is — status color ships with
 * a label, never alone (`dataviz` skill: status colors carry an icon/label).
 */
import { formatNumber } from '@/shared/formatters'
import { Badge, type BadgeTone } from '@/shared/ui'

import type { SlaBreach } from '../../domain/approvals-sla'

export interface SlaBreachListProps {
  rows: readonly SlaBreach[]
  slaHours: number
  emptyMessage: string
}

/** Past 2× the SLA is "danger"; anything breached at all is at least "warning". */
function severityTone(ageHours: number, slaHours: number): BadgeTone {
  return ageHours >= slaHours * 2 ? 'danger' : 'warning'
}

export function SlaBreachList({ rows, slaHours, emptyMessage }: SlaBreachListProps) {
  if (rows.length === 0) {
    return <p className="py-6 text-center text-sm text-zinc-500">{emptyMessage}</p>
  }

  return (
    <ul className="divide-y divide-black/5 dark:divide-white/5">
      {rows.map((row) => (
        <li key={row.approvalRequestId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
          <span dir="ltr" className="truncate">
            {row.entityRef}
          </span>
          <span className="flex items-center gap-2" dir="ltr">
            <span className="text-zinc-500 dark:text-zinc-400">
              {formatNumber(row.ageHours, { maximumFractionDigits: 1 })} ساعة
            </span>
            <Badge tone={severityTone(row.ageHours, slaHours)}>
              تجاوز {formatNumber(row.ageHours - slaHours, { maximumFractionDigits: 1 })} س
            </Badge>
          </span>
        </li>
      ))}
    </ul>
  )
}
