import { useEffect, useRef, useState } from 'react'

import { DocStatus } from '@/core/doc-status'
import { Button } from '@/shared/ui'

export interface SubmitCancelBarProps {
  docStatus: number
  /** Whether the current role may submit / cancel (gate with `hasRole`). */
  canAct: boolean
  isPending?: boolean
  onSubmit: () => void | Promise<unknown>
  onCancel: (reason: string) => void | Promise<unknown>
}

/**
 * Lifecycle action bar: **Submit** while the document is a Draft, **Cancel
 * (with reason)** once it is Submitted. Every control is hidden unless
 * `canAct` — a UX affordance only; the real gate is server-side.
 */
export function SubmitCancelBar({
  docStatus,
  canAct,
  isPending = false,
  onSubmit,
  onCancel,
}: SubmitCancelBarProps) {
  const [reasonOpen, setReasonOpen] = useState(false)
  const [reason, setReason] = useState('')
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (reasonOpen && !dialog.open) dialog.showModal()
    if (!reasonOpen && dialog.open) dialog.close()
  }, [reasonOpen])

  if (!canAct) {
    return <p className="text-xs text-zinc-500">لا تملك صلاحية تنفيذ إجراءات على هذا المستند.</p>
  }

  if (docStatus === DocStatus.Cancelled) {
    return <p className="text-xs text-zinc-500">تم إلغاء هذا المستند — لا إجراءات متاحة.</p>
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {docStatus === DocStatus.Draft ? (
        <Button onClick={() => void onSubmit()} disabled={isPending}>
          {isPending ? 'جارٍ الاعتماد…' : 'اعتماد / Submit'}
        </Button>
      ) : null}

      {docStatus === DocStatus.Submitted ? (
        <Button variant="danger" onClick={() => setReasonOpen(true)} disabled={isPending}>
          إلغاء / Cancel
        </Button>
      ) : null}

      <dialog
        ref={dialogRef}
        onClose={() => setReasonOpen(false)}
        onClick={(event) => {
          if (event.target === dialogRef.current) setReasonOpen(false)
        }}
        className="m-auto w-[min(28rem,92vw)] rounded-2xl border border-black/10 bg-white p-0 text-zinc-900 backdrop:bg-black/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
      >
        <form
          method="dialog"
          className="space-y-3 p-4"
          onSubmit={(event) => {
            event.preventDefault()
            const trimmed = reason.trim()
            if (!trimmed) return
            void onCancel(trimmed)
            setReason('')
            setReasonOpen(false)
          }}
        >
          <h3 className="text-base font-semibold">سبب الإلغاء / Cancellation reason</h3>
          <p className="text-xs text-zinc-500">
            لا يُحذف المستند — يُسجَّل الإلغاء بسبب مكتوب ويُصحَّح بمستند عكسي جديد.
          </p>
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            rows={3}
            required
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
            placeholder="اكتب سبب الإلغاء…"
          />
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setReason('')
                setReasonOpen(false)
              }}
            >
              تراجع
            </Button>
            <Button type="submit" variant="danger" disabled={isPending || reason.trim() === ''}>
              تأكيد الإلغاء
            </Button>
          </div>
        </form>
      </dialog>
    </div>
  )
}
