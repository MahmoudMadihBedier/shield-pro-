/**
 * Draft → Submit and Submitted → Cancel-with-reason controls, shared by the
 * transfer / write-off / count detail screens. The lifecycle calls themselves
 * go through the shared document repo (Functions); this only collects intent.
 */
import { useState } from 'react'

import { DocStatus } from '@/core/doc-status'
import { Badge, Button } from '@/shared/ui'

export interface SubmitCancelBarProps {
  docStatus: number
  pending?: boolean
  /** Hidden entirely when false (e.g. the current role may not submit). */
  canSubmit?: boolean
  canCancel?: boolean
  onSubmit: () => void
  onCancel: (reason: string) => void
}

export function SubmitCancelBar({
  docStatus,
  pending = false,
  canSubmit = true,
  canCancel = true,
  onSubmit,
  onCancel,
}: SubmitCancelBarProps) {
  const [reason, setReason] = useState('')
  const [cancelling, setCancelling] = useState(false)

  if (docStatus === DocStatus.Cancelled) {
    return <Badge tone="danger">ملغى</Badge>
  }

  if (docStatus === DocStatus.Draft) {
    if (!canSubmit) {
      return <p className="text-sm text-zinc-500">مسودة — بانتظار الاعتماد.</p>
    }
    return (
      <div className="flex items-center gap-2">
        <Badge tone="neutral">مسودة</Badge>
        <Button disabled={pending} onClick={onSubmit}>
          اعتماد المستند / Submit
        </Button>
      </div>
    )
  }

  // Submitted
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Badge tone="success">معتمد</Badge>
        {canCancel && !cancelling ? (
          <Button variant="secondary" disabled={pending} onClick={() => setCancelling(true)}>
            إلغاء المستند
          </Button>
        ) : null}
      </div>

      {cancelling ? (
        <div className="space-y-2 rounded-lg border border-red-300 p-3 dark:border-red-500/30">
          <label className="block text-sm">
            سبب الإلغاء / Cancellation reason
            <textarea
              rows={2}
              className="mt-1 w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button
              variant="danger"
              disabled={pending || reason.trim().length === 0}
              onClick={() => onCancel(reason.trim())}
            >
              تأكيد الإلغاء
            </Button>
            <Button
              variant="ghost"
              disabled={pending}
              onClick={() => {
                setCancelling(false)
                setReason('')
              }}
            >
              تراجع
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
