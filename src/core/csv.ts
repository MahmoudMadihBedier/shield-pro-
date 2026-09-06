/**
 * CSV serialisation + parsing (RFC 4180-ish). Pure string work — no DOM, no
 * Blob, no file I/O. The browser download / upload wiring lives in
 * `src/shared/excel/`.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export interface CsvColumn {
  key: string
  header: string
}

const NEEDS_QUOTING = /[",\r\n]/

function csvField(value: string | number | boolean | null | undefined): string {
  const text = value == null ? '' : String(value)
  if (!NEEDS_QUOTING.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Render `rows` as a CSV string: a header row from `columns[].header`, then one
 * row per record reading `columns[].key`. Missing keys render as an empty
 * field. Lines are CRLF-terminated (RFC 4180 §2.2); no trailing blank line.
 */
export function toCsv(
  rows: readonly Record<string, string | number | boolean | null | undefined>[],
  columns: readonly CsvColumn[],
): string {
  const lines: string[] = [columns.map((c) => csvField(c.header)).join(',')]
  for (const row of rows) {
    lines.push(columns.map((c) => csvField(row[c.key])).join(','))
  }
  return lines.join('\r\n')
}

/**
 * Parse CSV text into an array of string-cell records keyed by the header row.
 * Handles quoted fields, embedded quotes (`""`), and CRLF / LF line endings. A
 * leading UTF-8 BOM is stripped. Blank trailing lines are ignored.
 *
 * Deliberately minimal — no type coercion, no streaming. Callers validate the
 * cells (a Zod schema per importer).
 */
export function parseCsv(text: string): Array<Record<string, string>> {
  const src = text.replace(/^﻿/, '')
  const rows: string[][] = []
  let field = ''
  let record: string[] = []
  let inQuotes = false

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"'
          i++
        } else {
          inQuotes = false
        }
      } else {
        field += ch
      }
      continue
    }
    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      record.push(field)
      field = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++
      record.push(field)
      rows.push(record)
      field = ''
      record = []
    } else {
      field += ch
    }
  }
  if (field !== '' || record.length > 0) {
    record.push(field)
    rows.push(record)
  }

  const nonEmpty = rows.filter((r) => r.some((c) => c.trim() !== ''))
  const header = nonEmpty.shift()
  if (!header) return []
  const keys = header.map((h) => h.trim())

  return nonEmpty.map((cells) => {
    const obj: Record<string, string> = {}
    keys.forEach((k, idx) => {
      obj[k] = (cells[idx] ?? '').trim()
    })
    return obj
  })
}
