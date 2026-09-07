/**
 * Full-database export (System Admin only, route-gated by `AdminRoute`).
 * One click reads every table and downloads a single `.xlsx` workbook with one
 * sheet per table plus a `_manifest` sheet. Long-running, so it shows live
 * per-table progress and can be cancelled (`claude.md` B.6).
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { downloadXlsx, recordsToSheet, type XlsxSheet } from '@/shared/excel'
import { Button, Card, PageHeader } from '@/shared/ui'

import { exportAllData, type ExportProgress, type FullExport } from '../../data/export-all'

function manifestSheet(data: FullExport): XlsxSheet {
  const rows = [
    ...data.dumps.map((d) => ({
      table: d.table,
      rows: d.rows.length,
      status: d.truncated ? `partial (capped)` : 'ok',
    })),
    ...data.skipped.map((s) => ({ table: s.table, rows: 0, status: `skipped: ${s.reason}` })),
  ]
  return recordsToSheet('_manifest', [{ exported_at: data.takenAt, tables: rows.length }, ...rows])
}

async function buildAndDownload(data: FullExport): Promise<void> {
  const sheets: XlsxSheet[] = [
    manifestSheet(data),
    ...data.dumps.map((d) => recordsToSheet(d.table, d.rows)),
  ]
  await downloadXlsx(`shield-pro-export-${data.takenAt.slice(0, 10)}`, sheets)
}

export function DataExportPage() {
  const [progress, setProgress] = useState<ExportProgress | null>(null)
  const [building, setBuilding] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Abandon an in-flight export if the admin navigates away.
  useEffect(() => () => abortRef.current?.abort(), [])

  const run = useMutation<FullExport, AppError>({
    mutationFn: async () => {
      const ctrl = new AbortController()
      abortRef.current = ctrl
      const res = await exportAllData({ signal: ctrl.signal, onProgress: setProgress })
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: async (data) => {
      setBuilding(true)
      try {
        await buildAndDownload(data)
      } finally {
        setBuilding(false)
      }
    },
    onSettled: () => {
      abortRef.current = null
      setProgress(null)
    },
  })

  const busy = run.isPending || building
  const totalRows = run.data ? run.data.dumps.reduce((sum, d) => sum + d.rows.length, 0) : 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="تصدير كل البيانات"
        titleEn="Export all data"
        description="تنزيل كل بيانات المنشأة في ملف Excel واحد — ورقة لكل جدول."
      />

      <Card className="space-y-4">
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          يشمل الملف كل الجداول: العملاء والموردين والأصناف والمخازن والفواتير وأوامر الشراء
          والإنتاج والتحويلات ودفاتر المخزون ودفتر الأستاذ وسجل التدقيق وكل شيء آخر. قد تستغرق
          العملية بعض الوقت حسب حجم البيانات.
        </p>

        {!busy ? (
          <Button onClick={() => run.mutate()}>
            {run.isSuccess ? 'تصدير مرة أخرى' : 'تنزيل كل البيانات (Excel)'}
          </Button>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-zinc-400 border-t-transparent" />
              <span className="text-sm">
                {building ? (
                  'جارٍ إنشاء ملف Excel…'
                ) : (
                  <>
                    جارٍ القراءة… جدول {progress?.index ?? 0} من {progress?.total ?? 0}
                    {progress ? (
                      <>
                        {' — '}
                        <code dir="ltr" className="font-mono text-xs">
                          {progress.table}
                        </code>
                        {progress.rows > 0 ? ` (${progress.rows})` : null}
                      </>
                    ) : null}
                  </>
                )}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full bg-zinc-500 transition-[width]"
                style={{
                  width: building
                    ? '100%'
                    : progress
                      ? `${Math.round((progress.index / progress.total) * 100)}%`
                      : '0%',
                }}
              />
            </div>
            {!building ? (
              <Button variant="ghost" size="sm" onClick={() => abortRef.current?.abort()}>
                إلغاء
              </Button>
            ) : null}
          </div>
        )}

        {run.isError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {run.error.message}
          </p>
        ) : null}

        {run.isSuccess && run.data && !building ? (
          <div className="space-y-2 rounded-lg border border-black/10 p-3 text-sm dark:border-white/10">
            <p className="text-emerald-700 dark:text-emerald-400">
              تم التصدير: {run.data.dumps.length} جدول، {totalRows} صف إجمالًا. تم تنزيل الملف.
            </p>
            {run.data.dumps.some((d) => d.truncated) ? (
              <p className="text-amber-700 dark:text-amber-400">
                بعض الجداول كبيرة جدًا وتم اقتصاصها — راجع ورقة <code>_manifest</code>.
              </p>
            ) : null}
            {run.data.skipped.length > 0 ? (
              <div className="text-amber-700 dark:text-amber-400">
                <p>تعذّر تصدير {run.data.skipped.length} جدول:</p>
                <ul className="mt-1 list-inside list-disc text-xs">
                  {run.data.skipped.map((s) => (
                    <li key={s.table}>
                      <code dir="ltr">{s.table}</code> — {s.reason}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                if (run.data) void buildAndDownload(run.data)
              }}
            >
              تنزيل الملف مرة أخرى
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  )
}
