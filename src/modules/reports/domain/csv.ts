/**
 * Plain-string CSV serialisation (RFC 4180-ish). Pure, no DOM/Blob here — this
 * is `domain/`, which per `claude.md` B.4 stays framework-free; the actual
 * file-download trigger lives in `presentation/components/ExportCsvButton.tsx`.
 */

export interface CsvColumn {
  key: string
  header: string
}

const NEEDS_QUOTING = /[",\r\n]/

/** Quote a field if it contains a comma, quote or newline; double up embedded quotes. */
function csvField(value: string | number): string {
  const text = String(value)
  if (!NEEDS_QUOTING.test(text)) return text
  return `"${text.replace(/"/g, '""')}"`
}

/**
 * Render `rows` as a CSV string: a header row from `columns[].header`, then
 * one row per record reading `columns[].key`. Missing keys render as an empty
 * field. Lines are CRLF-terminated (RFC 4180 §2.2), including after the last
 * row's terminator-less content — no trailing blank line is appended.
 */
export function toCsv(rows: readonly Record<string, string | number>[], columns: readonly CsvColumn[]): string {
  const lines: string[] = []
  lines.push(columns.map((c) => csvField(c.header)).join(','))
  for (const row of rows) {
    lines.push(columns.map((c) => csvField(row[c.key] ?? '')).join(','))
  }
  return lines.join('\r\n')
}
