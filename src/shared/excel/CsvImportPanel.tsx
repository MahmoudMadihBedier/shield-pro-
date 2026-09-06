/**
 * Reusable CSV import step (Plan §4.1): pick or paste a CSV, validate every
 * row against a Zod schema, preview the valid rows + per-row errors, then
 * Apply. The actual write is the caller's `onCommit` (a repo call / RPC).
 */
import { useMemo, useState } from 'react'
import type { ZodType } from 'zod'

import { Button, Card } from '@/shared/ui'

import { parseCsv } from '@/core/csv'
import { readFileText } from './download'

export interface CsvImportResult {
  applied: number
  skipped: number
  message?: string
}

export interface CsvImportPanelProps<T> {
  title: string
  /** The header row the CSV must carry, e.g. `['code', 'purchase_price']`. */
  templateHeaders: readonly string[]
  /** Validates one parsed row (string cells in, typed row out). */
  rowSchema: ZodType<T>
  /** Writes the validated rows; returns a per-run summary. */
  onCommit: (rows: T[]) => Promise<CsvImportResult>
}

interface ParsedRow<T> {
  line: number
  raw: Record<string, string>
  value: T | null
  error: string | null
}

export function CsvImportPanel<T>({
  title,
  templateHeaders,
  rowSchema,
  onCommit,
}: CsvImportPanelProps<T>) {
  const [text, setText] = useState('')
  const [committing, setCommitting] = useState(false)
  const [result, setResult] = useState<CsvImportResult | null>(null)
  const [commitError, setCommitError] = useState<string | null>(null)

  const parsed = useMemo<ParsedRow<T>[]>(() => {
    if (text.trim() === '') return []
    return parseCsv(text).map((raw, i) => {
      const check = rowSchema.safeParse(raw)
      return {
        line: i + 2, // +1 header, +1 to 1-index
        raw,
        value: check.success ? check.data : null,
        error: check.success ? null : check.error.issues.map((x) => x.message).join('; '),
      }
    })
  }, [text, rowSchema])

  const valid = parsed.filter((r) => r.value !== null)
  const invalid = parsed.filter((r) => r.error !== null)

  async function apply() {
    setCommitError(null)
    setResult(null)
    setCommitting(true)
    try {
      setResult(await onCommit(valid.map((r) => r.value as T)))
    } catch (e) {
      setCommitError(e instanceof Error ? e.message : String(e))
    } finally {
      setCommitting(false)
    }
  }

  return (
    <Card className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="text-xs text-zinc-500">
        الأعمدة المطلوبة / required columns:{' '}
        <code dir="ltr" className="font-mono">
          {templateHeaders.join(',')}
        </code>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded-lg border border-black/15 px-3 py-1.5 text-sm hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10">
          اختيار ملف CSV
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              if (file) setText(await readFileText(file))
              e.target.value = ''
            }}
          />
        </label>
        <span className="text-xs text-zinc-500">أو الصق المحتوى أدناه</span>
      </div>

      <textarea
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={templateHeaders.join(',')}
        className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 font-mono text-xs outline-none focus:border-zinc-500 dark:border-white/15"
        dir="ltr"
      />

      {parsed.length > 0 ? (
        <div className="space-y-2 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            صالح: <strong>{valid.length}</strong> — غير صالح: <strong>{invalid.length}</strong>
          </p>
          {invalid.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-red-50 p-2 text-xs text-red-700 dark:bg-red-950/30 dark:text-red-300">
              {invalid.map((r) => (
                <li key={r.line}>
                  سطر {r.line}: {r.error}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {commitError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {commitError}
        </p>
      ) : null}
      {result ? (
        <p className="text-xs text-emerald-700 dark:text-emerald-400">
          تم تطبيق {result.applied} — تخطّي {result.skipped}
          {result.message ? ` — ${result.message}` : ''}
        </p>
      ) : null}

      <Button size="sm" onClick={() => void apply()} disabled={committing || valid.length === 0}>
        {committing ? 'جارٍ التطبيق…' : `تطبيق (${valid.length})`}
      </Button>
    </Card>
  )
}
