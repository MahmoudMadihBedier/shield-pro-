/**
 * Browser file-download / file-read helpers for the CSV import-export facade.
 * Kept out of `core` (DOM APIs) and out of `domain` (framework-free rule).
 */
import { toCsv, type CsvColumn } from '@/core/csv'

/** Prepended so Excel opens UTF-8 (Arabic) text correctly. */
const UTF8_BOM = '﻿'

/** Trigger a client-side download of an already-built `Blob` as `fileName`. */
export function downloadBlobObject(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Firefox / Safari process the download asynchronously after click(); revoking
  // immediately can truncate a large file, so defer it.
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

/** Trigger a client-side download of `content` as `fileName`. */
export function downloadText(
  fileName: string,
  content: string,
  mime = 'text/csv;charset=utf-8',
): void {
  downloadBlobObject(fileName, new Blob([content], { type: mime }))
}

/** Trigger a client-side download of raw `bytes` as `fileName`. */
export function downloadBlob(fileName: string, bytes: Uint8Array, mime: string): void {
  // `new Blob([view])` already copies exactly the view's byteOffset..byteLength
  // range, so no manual copy is needed.
  downloadBlobObject(fileName, new Blob([bytes], { type: mime }))
}

/** Build a CSV (BOM + `toCsv`) and download it as `<fileName>.csv`. */
export function downloadCsv(
  fileName: string,
  rows: readonly Record<string, string | number | boolean | null | undefined>[],
  columns: readonly CsvColumn[],
): void {
  downloadText(`${fileName}.csv`, UTF8_BOM + toCsv(rows, columns))
}

/** Read a picked `File` as text (for CSV import). */
export function readFileText(file: File): Promise<string> {
  return file.text()
}
