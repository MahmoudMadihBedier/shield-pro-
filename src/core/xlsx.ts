/**
 * Minimal XLSX (SpreadsheetML / OOXML) writer — the *pure* half. Builds the set
 * of XML parts that make up an `.xlsx` package (which is really a ZIP of these
 * files). The ZIP container + the browser download live in `src/shared/excel/`
 * so `core` stays framework- and DOM-free (mirrors `csv.ts` ↔ `download.ts`).
 *
 * Scope: one worksheet per {@link XlsxSheet}, a header row, then data rows.
 * Every cell is written as an inline string except finite numbers and booleans,
 * so there is no shared-string table and no styling — plain, robust, and Excel
 * / LibreOffice / Google Sheets all open it without a format warning.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export type XlsxCell = string | number | boolean | null | undefined

export interface XlsxSheet {
  /** Worksheet tab name. Sanitised + de-duplicated by {@link xlsxParts}. */
  name: string
  /** Column keys, in display order. */
  columns: readonly string[]
  /** One record per row; missing keys render blank. */
  rows: ReadonlyArray<Record<string, XlsxCell>>
}

// ---------------------------------------------------------------------------
// Small pure helpers
// ---------------------------------------------------------------------------

/** 0 → "A", 25 → "Z", 26 → "AA", … (spreadsheet column labels). */
export function columnLetter(index: number): string {
  let n = index
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

const XML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
}

const TAB = 9
const LF = 10
const CR = 13

/**
 * A code point XML 1.0 allows: tab / LF / CR, then U+0020–U+D7FF,
 * U+E000–U+FFFD, U+10000–U+10FFFF. Excludes the C0 controls, the surrogate
 * block (a lone surrogate from truncated text) and U+FFFE / U+FFFF — any of
 * which makes Excel reject the whole workbook as corrupt.
 */
function isXmlChar(code: number): boolean {
  if (code === TAB || code === LF || code === CR) return true
  if (code < 0x20) return false
  if (code <= 0xd7ff) return true
  if (code >= 0xe000 && code <= 0xfffd) return true
  return code >= 0x10000 && code <= 0x10ffff
}

/**
 * XML-escape `& < > " '` and drop every character XML 1.0 forbids. Written as a
 * code-point scan so the source carries no literal control characters.
 */
export function escapeXml(value: string): string {
  let out = ''
  for (const ch of value) {
    const code = ch.codePointAt(0)!
    if (!isXmlChar(code)) continue
    out += XML_ESCAPES[ch] ?? ch
  }
  return out
}

/**
 * Excel worksheet-name rules: 1–31 chars, none of `[ ] : * ? / \`, not blank,
 * unique within the workbook. `taken` is mutated with the returned name.
 */
export function sanitizeSheetName(raw: string, taken: Set<string>): string {
  let base =
    (raw || 'sheet')
      .replace(/[[\]:*?/\\]/g, '_')
      .slice(0, 31)
      .trim() || 'sheet'
  let name = base
  let i = 2
  while (taken.has(name.toLowerCase())) {
    const suffix = `_${i++}`
    base = base.slice(0, 31 - suffix.length)
    name = base + suffix
  }
  taken.add(name.toLowerCase())
  return name
}

const isFiniteNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v)

// ---------------------------------------------------------------------------
// Record → sheet shaping
// ---------------------------------------------------------------------------

export interface RecordsToSheetOptions {
  /** Keys to keep, in this order. Default: union of all keys, first-seen order. */
  columns?: readonly string[]
  /** Drop keys for which this returns true (e.g. the `$`-prefixed shim extras). */
  omitKey?: (key: string) => boolean
}

/**
 * Turn an arbitrary list of records into an {@link XlsxSheet}: derive the column
 * set, and coerce each value to a cell — objects / arrays become JSON text,
 * `null` / `undefined` become blank, everything else passes through.
 */
export function recordsToSheet(
  name: string,
  records: ReadonlyArray<Record<string, unknown>>,
  options: RecordsToSheetOptions = {},
): XlsxSheet {
  const omit = options.omitKey ?? (() => false)

  let columns: string[]
  if (options.columns) {
    columns = options.columns.filter((c) => !omit(c))
  } else {
    const seen = new Set<string>()
    for (const rec of records) {
      for (const key of Object.keys(rec)) {
        if (!seen.has(key) && !omit(key)) seen.add(key)
      }
    }
    columns = [...seen]
  }

  const rows = records.map((rec) => {
    const row: Record<string, XlsxCell> = {}
    for (const key of columns) {
      row[key] = toCell(rec[key])
    }
    return row
  })

  return { name, columns, rows }
}

function toCell(value: unknown): XlsxCell {
  if (value == null) return ''
  if (typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isFinite(value) ? value : String(value)
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

// ---------------------------------------------------------------------------
// XML part builders
// ---------------------------------------------------------------------------

function cellXml(ref: string, value: XlsxCell): string {
  if (value === '' || value == null) return `<c r="${ref}"/>`
  if (typeof value === 'boolean') return `<c r="${ref}" t="b"><v>${value ? 1 : 0}</v></c>`
  if (isFiniteNumber(value)) return `<c r="${ref}"><v>${value}</v></c>`
  return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`
}

function sheetXml(sheet: XlsxSheet): string {
  const header = sheet.columns.map((label, c) => cellXml(`${columnLetter(c)}1`, label)).join('')
  const body = sheet.rows
    .map((row, r) => {
      const cells = sheet.columns
        .map((key, c) => cellXml(`${columnLetter(c)}${r + 2}`, row[key]))
        .join('')
      return `<row r="${r + 2}">${cells}</row>`
    })
    .join('')
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData><row r="1">${header}</row>${body}</sheetData></worksheet>`
  )
}

/**
 * Build every file in the `.xlsx` package as `path → text`. Feed this map to a
 * ZIP writer (see `src/shared/excel/xlsx.ts`) to get the final workbook.
 * Sheet names are sanitised + de-duplicated here.
 */
export function xlsxParts(sheets: readonly XlsxSheet[]): Record<string, string> {
  const taken = new Set<string>()
  const named = sheets.map((s) => ({ ...s, name: sanitizeSheetName(s.name, taken) }))
  if (named.length === 0) named.push({ name: 'empty', columns: [], rows: [] })

  const sheetIds = named.map((_, i) => i + 1)

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    sheetIds
      .map(
        (id) =>
          `<Override PartName="/xl/worksheets/sheet${id}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
      )
      .join('') +
    `</Types>`

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>` +
    named
      .map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('') +
    `</sheets></workbook>`

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    sheetIds
      .map(
        (id) =>
          `<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${id}.xml"/>`,
      )
      .join('') +
    `</Relationships>`

  const parts: Record<string, string> = {
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'xl/workbook.xml': workbook,
    'xl/_rels/workbook.xml.rels': workbookRels,
  }
  named.forEach((s, i) => {
    parts[`xl/worksheets/sheet${i + 1}.xml`] = sheetXml(s)
  })
  return parts
}
