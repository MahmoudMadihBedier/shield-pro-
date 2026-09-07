/**
 * XLSX writer — the browser half. Zips the pure XML parts from `@/core/xlsx`
 * into a real `.xlsx` file (OPC = a ZIP archive) and triggers a download.
 *
 * `fflate` is the only third-party piece: a tiny, dependency-free, widely-used
 * DEFLATE/ZIP implementation. A hand-rolled ZIP writer would be more code to
 * own for no benefit; a full spreadsheet library (exceljs / SheetJS) is far
 * heavier than this one focused need.
 */
import { strToU8, zip } from 'fflate'

import { xlsxParts, type XlsxSheet } from '@/core/xlsx'

import { downloadBlob } from './download'

const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

// Fixed mtime so the same input yields the same bytes. Must sit inside the ZIP
// epoch (1980–2099) in *local* time — fflate reads the year with a local
// `getFullYear()` — so a mid-decade date is safe in every timezone.
const STABLE_MTIME = new Date(1985, 0, 1)

/**
 * Serialise `sheets` to the bytes of an `.xlsx` workbook. Async: the DEFLATE
 * pass runs off the main thread (fflate spins a worker) so a large export never
 * freezes the tab.
 */
export function buildXlsx(sheets: readonly XlsxSheet[]): Promise<Uint8Array> {
  const parts = xlsxParts(sheets)
  const zipInput: Record<string, [Uint8Array, { level: 6; mtime: Date }]> = {}
  for (const [path, text] of Object.entries(parts)) {
    zipInput[path] = [strToU8(text), { level: 6, mtime: STABLE_MTIME }]
  }
  return new Promise((resolve, reject) => {
    zip(zipInput, (error, data) => (error ? reject(error) : resolve(data)))
  })
}

/** Build the workbook and download it as `<fileName>.xlsx`. */
export async function downloadXlsx(fileName: string, sheets: readonly XlsxSheet[]): Promise<void> {
  const bytes = await buildXlsx(sheets)
  downloadBlob(`${fileName}.xlsx`, bytes, XLSX_MIME)
}
