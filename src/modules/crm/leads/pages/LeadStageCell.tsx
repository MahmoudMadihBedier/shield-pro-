/**
 * The stage-change control for one lead row. Offers only the transitions the
 * pipeline allows (`nextLeadStages` — mirrors the server-side guard in
 * migration 0033, so a rejected transition here would also be rejected
 * server-side). Picking "lost" asks for a reason inline instead of a raw
 * `window.prompt` (untestable, not RTL-aware, and easy to dismiss blank).
 */
import { useState } from 'react'

import { Button } from '@/shared/ui'

import { leadStageLabel, nextLeadStages, type LeadRow, type LeadStage } from '../../domain/lead'

export interface LeadStageCellProps {
  lead: LeadRow
  pending: boolean
  onChange: (stage: LeadStage, lostReason?: string) => void
}

export function LeadStageCell({ lead, pending, onChange }: LeadStageCellProps) {
  const [confirmingLost, setConfirmingLost] = useState(false)
  const [lostReason, setLostReason] = useState('')

  if (confirmingLost) {
    return (
      <div className="flex flex-col gap-1">
        <input
          type="text"
          autoFocus
          value={lostReason}
          onChange={(e) => setLostReason(e.target.value)}
          placeholder="سبب الخسارة (اختياري)"
          className="w-40 rounded-lg border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="danger"
            disabled={pending}
            onClick={() => {
              onChange('lost', lostReason)
              setConfirmingLost(false)
              setLostReason('')
            }}
          >
            تأكيد الخسارة
          </Button>
          <button
            type="button"
            className="text-xs text-zinc-500 underline"
            onClick={() => setConfirmingLost(false)}
          >
            إلغاء
          </button>
        </div>
      </div>
    )
  }

  return (
    <select
      value={lead.stage}
      disabled={pending}
      onChange={(e) => {
        const next = e.target.value as LeadStage
        if (next === lead.stage) return
        if (next === 'lost') {
          setConfirmingLost(true)
          return
        }
        onChange(next)
      }}
      className="rounded-lg border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
    >
      {nextLeadStages(lead.stage).map((s) => (
        <option key={s} value={s}>
          {leadStageLabel(s)}
        </option>
      ))}
    </select>
  )
}
