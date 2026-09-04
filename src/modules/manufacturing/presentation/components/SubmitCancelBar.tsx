/**
 * Draft → Submit / Submitted → Cancel controls shared by the request and batch
 * detail screens. The transition itself runs through the shared document repo
 * (`submit` / `cancel` call `shield-server`); this bar only gates the buttons
 * and collects the mandatory cancel reason.
 *
 * Submit rule: `doc_status === Draft` AND, when a `qcStatus` is supplied (batches
 * only), `qcStatus === 'released'`. Production requests pass no `qcStatus`, so
 * for them Submit is available as soon as the request is a Draft.
 */
import { useState } from 'react'

import { DocStatus } from '@/core/doc-status'
import { Badge, Button, Card } from '@/shared/ui'

import { isTransferable } from '../../domain/qc'
import type { QcStatus } from '../../domain/schemas'

export interface SubmitCancelBarProps {
  docStatus: number
  /** Batches only — when set, Submit needs `qc_status === 'released'`. */
  qcStatus?: QcStatus | null
  onSubmit: () => void
  onCancel: (reason: string) => void
  busy?: boolean
  error?: string | null
}

export function SubmitCancelBar({
  docStatus,
  qcStatus = null,
  onSubmit,
  onCancel,
  busy = false,
  error = null,
}: SubmitCancelBarProps) {
  const [reason, setReason] = useState('')

  const qcGateOk = qcStatus == null || isTransferable(qcStatus)

  return (
    <Card className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">حالة المستند / Document status</h3>
        <Badge
          tone={
            docStatus === DocStatus.Submitted
              ? 'success'
              : docStatus === DocStatus.Cancelled
                ? 'danger'
                : 'neutral'
          }
        >
          {docStatus === DocStatus.Submitted
            ? 'معتمد'
            : docStatus === DocStatus.Cancelled
              ? 'ملغى'
              : 'مسودة'}
        </Badge>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      ) : null}

      {docStatus === DocStatus.Draft ? (
        <div className="space-y-1">
          <Button onClick={onSubmit} disabled={busy || !qcGateOk}>
            اعتماد المستند / Submit
          </Button>
          {!qcGateOk ? (
            <p className="text-xs text-amber-700 dark:text-amber-300">
              لا يمكن الاعتماد قبل اجتياز فحص الجودة (released).
            </p>
          ) : null}
        </div>
      ) : null}

      {docStatus === DocStatus.Submitted ? (
        <div className="space-y-2">
          <label className="block text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">سبب الإلغاء (إلزامي)</span>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            />
          </label>
          <Button
            variant="danger"
            onClick={() => onCancel(reason.trim())}
            disabled={busy || reason.trim() === ''}
          >
            إلغاء المستند / Cancel
          </Button>
        </div>
      ) : null}

      {docStatus === DocStatus.Cancelled ? (
        <p className="text-sm text-zinc-500">هذا المستند ملغى. أنشئ مستندًا جديدًا للتصحيح.</p>
      ) : null}
    </Card>
  )
}
