import { DocStatus } from '@/core/doc-status'
import { StatusPill, type BadgeTone } from '@/shared/ui'

const STYLES: Record<number, { ar: string; tone: BadgeTone }> = {
  [DocStatus.Draft]: { ar: 'مسودة', tone: 'warning' },
  [DocStatus.Submitted]: { ar: 'معتمد', tone: 'success' },
  [DocStatus.Cancelled]: { ar: 'ملغي', tone: 'danger' },
}

/** Arabic-first lifecycle chip for a `payroll_runs` document. */
export function DocStatusPill({ status }: { status: number | null | undefined }) {
  if (status == null) return null
  const style = STYLES[status]
  if (!style) return null
  return <StatusPill tone={style.tone}>{style.ar}</StatusPill>
}
