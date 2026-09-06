/**
 * System-Admin-only panel on a document detail page: force `doc_status` /
 * `status` / `qc_status` regardless of creator, role or workflow gate. Every
 * change carries a mandatory reason and is audited server-side
 * (`admin_set_status`). This is the "owner" role's operational authority
 * (`src/core/rbac.ts` — "god-mode").
 */
import { useMemo, useState } from 'react'
import { useMutation } from '@tanstack/react-query'

import type { AppError } from '@/core/errors'
import { Role } from '@/core/rbac'
import { adminSetStatus } from '@/infrastructure/appwrite/functions'
import { RequireRole } from '@/presentation/components/RequireRole'
import { Button, Card } from '@/shared/ui'

const DOC_STATUS_OPTIONS = [
  { value: '0', label: 'مسودة / Draft' },
  { value: '1', label: 'معتمد / Submitted' },
  { value: '2', label: 'ملغى / Cancelled' },
]

export interface AdminOverridePanelProps {
  /** The document's table id (e.g. `'purchase_orders'`). */
  table: string
  /** The current row — needs `$id`; `doc_status` / `status` / `qc_status` are read if present. */
  row: {
    $id: string
    doc_status?: number
    status?: string | null
    qc_status?: string | null
  }
  /** Called after a successful override so the page can refetch. */
  onDone?: () => void
}

export function AdminOverridePanel({ table, row, onDone }: AdminOverridePanelProps) {
  const hasStatus = typeof row.status === 'string'
  const hasQc = typeof row.qc_status === 'string'

  const [docStatus, setDocStatus] = useState(String(row.doc_status ?? ''))
  const [status, setStatus] = useState(row.status ?? '')
  const [qcStatus, setQcStatus] = useState(row.qc_status ?? '')
  const [reason, setReason] = useState('')

  const patch = useMemo(() => {
    const p: Record<string, string | number> = {}
    if (row.doc_status !== undefined && docStatus !== String(row.doc_status)) {
      p.doc_status = Number(docStatus)
    }
    if (hasStatus && status !== (row.status ?? '')) p.status = status
    if (hasQc && qcStatus !== (row.qc_status ?? '')) p.qc_status = qcStatus
    return p
  }, [row, docStatus, status, qcStatus, hasStatus, hasQc])

  const mutation = useMutation<unknown, AppError, void>({
    mutationFn: async () => {
      const res = await adminSetStatus(table, row.$id, patch, reason.trim())
      if (!res.ok) throw res.error
      return res.value
    },
    onSuccess: () => {
      setReason('')
      onDone?.()
    },
  })

  const dirty = Object.keys(patch).length > 0
  const ready = dirty && reason.trim().length > 0

  return (
    <RequireRole anyOf={[Role.SystemAdmin]}>
      <Card className="space-y-3 border-violet-300 dark:border-violet-500/40">
        <h3 className="text-sm font-semibold">تجاوز إداري / Admin override</h3>
        <p className="text-xs text-zinc-500">
          فرض حالة المستند بصلاحية مدير النظام — يتخطى قواعد الأدوار وفصل المهام وسير العمل،
          ويُسجَّل في سجل التدقيق.
        </p>

        <div className="grid gap-3 sm:grid-cols-2">
          {row.doc_status !== undefined ? (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600 dark:text-zinc-400">حالة المستند</span>
              <select
                value={docStatus}
                onChange={(e) => setDocStatus(e.target.value)}
                className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              >
                {DOC_STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {hasStatus ? (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600 dark:text-zinc-400">status</span>
              <input
                dir="ltr"
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 font-mono text-sm dark:border-white/15"
              />
            </label>
          ) : null}

          {hasQc ? (
            <label className="block text-sm">
              <span className="mb-1 block text-zinc-600 dark:text-zinc-400">qc_status</span>
              <select
                value={qcStatus}
                onChange={(e) => setQcStatus(e.target.value)}
                className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm dark:border-white/15"
              >
                {['pending_qc', 'released', 'rejected'].map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">السبب (إلزامي)</span>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        </label>

        {mutation.isError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {mutation.error.message}
          </p>
        ) : null}
        {mutation.isSuccess ? (
          <p className="text-xs text-emerald-700 dark:text-emerald-400">تم تطبيق التغيير.</p>
        ) : null}

        <Button
          variant="secondary"
          size="sm"
          disabled={!ready || mutation.isPending}
          onClick={() => mutation.mutate()}
        >
          {mutation.isPending ? 'جارٍ التطبيق…' : 'تطبيق التجاوز'}
        </Button>
      </Card>
    </RequireRole>
  )
}
