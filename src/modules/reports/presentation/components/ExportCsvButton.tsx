/**
 * Downloads `rows` as a CSV file via `toCsv` (pure string-building, no
 * library). This is a real end-user download in the deployed app — a
 * transient object URL + `<a download>` click, torn down immediately after.
 */
import { useCallback } from 'react'

import { Button } from '@/shared/ui'

import { toCsv, type CsvColumn } from '../../domain/csv'

export interface ExportCsvButtonProps {
  rows: readonly Record<string, string | number>[]
  columns: readonly CsvColumn[]
  /** File name without extension, e.g. `"branch-performance"`. */
  fileName: string
  label?: string
  disabled?: boolean
}

const BOM = '﻿' // keeps Arabic text intact when the CSV opens in Excel

export function ExportCsvButton({
  rows,
  columns,
  fileName,
  label = 'تصدير CSV / Export CSV',
  disabled,
}: ExportCsvButtonProps) {
  const handleClick = useCallback(() => {
    const csv = BOM + toCsv(rows, columns)
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${fileName}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }, [rows, columns, fileName])

  return (
    <Button variant="secondary" size="sm" onClick={handleClick} disabled={disabled || rows.length === 0}>
      {label}
    </Button>
  )
}
