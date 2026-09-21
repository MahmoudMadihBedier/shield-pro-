/**
 * "Amend" a Submitted or Cancelled document: collects a mandatory reason,
 * then hands off to the caller, which (in order) reverses any posted GL
 * entries, cancels the original if still Submitted, and creates a linked
 * corrected Draft (`amended_from`). The ledger is never edited in place —
 * this is the UI for the "new offsetting entry" correction pattern.
 */
import { useState } from 'react'

import { Button, Card } from '@/shared/ui'

export interface AmendPanelProps {
  /** Hidden entirely when false (role can't amend, or nothing to amend). */
  canAmend: boolean
  pending?: boolean
  onAmend: (reason: string) => void
}

export function AmendPanel({ canAmend, pending = false, onAmend }: AmendPanelProps) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!canAmend) return null

  if (!open) {
    return (
      <Button variant="secondary" disabled={pending} onClick={() => setOpen(true)}>
        تعديل (بإنشاء إدخال مصحَّح) / Amend
      </Button>
    )
  }

  return (
    <Card className="space-y-2 border-amber-300 dark:border-amber-500/30">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        سيُلغى هذا الإدخال ويُنشأ إدخال جديد مرتبط به لتصحيحه — القيود المحاسبية السابقة لا تُعدَّل
        أبدًا، بل يُلغى أثرها ويُسجَّل تصحيح جديد.
      </p>
      <label className="block text-sm">
        سبب التعديل / Reason
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
          onClick={() => onAmend(reason.trim())}
        >
          تأكيد التعديل
        </Button>
        <Button
          variant="ghost"
          disabled={pending}
          onClick={() => {
            setOpen(false)
            setReason('')
          }}
        >
          تراجع
        </Button>
      </div>
    </Card>
  )
}
