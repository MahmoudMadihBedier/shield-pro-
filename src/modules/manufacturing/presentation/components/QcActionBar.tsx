/**
 * QC hold/release controls for a production batch (`IMPLEMENTATION_PLAN.md`
 * Phase 2 Story 2.7).
 *
 * ORDERING — QC happens BEFORE submit. `qc_status` lives on a submittable
 * document, but a batch is quality-checked while it is still a **Draft**:
 *
 *   create Draft → RawLot/qty entry → QC release (updateDraft) → Submit → post ledger
 *
 * So this bar only acts while `doc_status === Draft` and `qc_status ===
 * pending_qc`, writing `qc_status` + `qc_by` through the repo's `updateDraft`
 * (Draft rows are client-writable by their creator). Once the batch is Submitted
 * its `qc_status` is frozen with the rest of the document. `SubmitCancelBar`
 * then refuses Submit unless `qc_status === 'released'`.
 *
 * Visible only to Factory Manager / System Admin (UX gate; the enforcing
 * Function is a later phase).
 */
import { useState } from 'react'

import { useAuth } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import { Role } from '@/core/rbac'
import { RequireRole } from '@/presentation/components/RequireRole'
import { Button, Card } from '@/shared/ui'

import { canQcTransition } from '../../domain/qc'
import type { QcStatus } from '../../domain/schemas'
import { useProductionBatchActions } from '../hooks/documents'

export interface QcActionBarProps {
  batchId: string
  qcStatus: QcStatus
  docStatus: number
  onDone?: () => void
}

export function QcActionBar({ batchId, qcStatus, docStatus, onDone }: QcActionBarProps) {
  const { principal } = useAuth()
  const { updateDraft } = useProductionBatchActions()
  const [reason, setReason] = useState('')

  const isDraft = docStatus === DocStatus.Draft
  const canRelease = isDraft && canQcTransition(qcStatus, 'released')
  const canReject = isDraft && canQcTransition(qcStatus, 'rejected')

  if (!isDraft || (!canRelease && !canReject)) return null

  const run = (next: QcStatus) => {
    updateDraft.mutate(
      {
        id: batchId,
        patch: {
          qc_status: next,
          qc_by: principal?.userId,
          ...(next === 'rejected' && reason.trim() ? { remarks: reason.trim() } : {}),
        },
      },
      { onSuccess: () => onDone?.() },
    )
  }

  return (
    <RequireRole anyOf={[Role.FactoryManager, Role.SystemAdmin]}>
      <Card className="space-y-3">
        <h3 className="text-sm font-semibold">فحص الجودة / Quality control</h3>
        <p className="text-sm text-zinc-500">
          الحالة الحالية: <span className="font-medium">{qcStatus}</span>
        </p>

        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">سبب الرفض (اختياري)</span>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
          />
        </label>

        {updateDraft.isError ? (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {updateDraft.error.message}
          </p>
        ) : null}

        <div className="flex items-center gap-2">
          <Button onClick={() => run('released')} disabled={!canRelease || updateDraft.isPending}>
            اعتماد / Release
          </Button>
          <Button
            variant="danger"
            onClick={() => run('rejected')}
            disabled={!canReject || updateDraft.isPending}
          >
            رفض / Reject
          </Button>
        </div>
      </Card>
    </RequireRole>
  )
}
