/**
 * The one export control for the whole app (Plan §4.1 — a facade, not
 * per-page buttons). Drop it into any list/report screen with the rows it
 * currently shows + a column map; it downloads a UTF-8 CSV Excel opens
 * cleanly.
 */
import { Button } from '@/shared/ui'
import type { CsvColumn } from '@/core/csv'

import { downloadCsv } from './download'

export interface ExportButtonProps {
  rows: readonly Record<string, string | number | boolean | null | undefined>[]
  columns: readonly CsvColumn[]
  /** File name without extension, e.g. `"customer-aging-2026-09"`. */
  fileName: string
  label?: string
  disabled?: boolean
}

export function ExportButton({
  rows,
  columns,
  fileName,
  label = 'تصدير Excel / Export',
  disabled,
}: ExportButtonProps) {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={() => downloadCsv(fileName, rows, columns)}
      disabled={disabled || rows.length === 0}
    >
      {label}
    </Button>
  )
}
