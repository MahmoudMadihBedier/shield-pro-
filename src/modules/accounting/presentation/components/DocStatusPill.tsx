import { DocStatus } from '@/core/doc-status'
import { StatusPill, type BadgeTone } from '@/shared/ui'

const STYLES: Record<number, { ar: string; en: string; tone: BadgeTone }> = {
  [DocStatus.Draft]: { ar: 'مسودة', en: 'Draft', tone: 'warning' },
  [DocStatus.Submitted]: { ar: 'معتمد', en: 'Submitted', tone: 'success' },
  [DocStatus.Cancelled]: { ar: 'ملغى', en: 'Cancelled', tone: 'danger' },
}

/** Arabic-first lifecycle chip for a submittable document. */
export function DocStatusPill({ status }: { status: number | null | undefined }) {
  if (status == null) return null
  const style = STYLES[status]
  if (!style) return null
  return <StatusPill tone={style.tone}>{style.ar}</StatusPill>
}
