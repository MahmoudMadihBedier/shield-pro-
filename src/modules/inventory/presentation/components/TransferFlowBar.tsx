/**
 * The transfer "quadruple step" progress bar plus the single next-action button.
 *
 * The workflow model lives in `domain/transfer-flow`; this only renders it and
 * gates the action button by role (`hasRole`). Real segregation-of-duties
 * enforcement (the approver ≠ requester, the sender is the source keeper, the
 * receiver is the destination keeper) happens server-side in Functions.
 */
import { Role, hasRole, type Principal } from '@/core/rbac'
import { Badge, Button } from '@/shared/ui'

import { nextActor, type TransferActor } from '../../domain/transfer-flow'
import type { TransferStatus } from '../../domain/schemas'

interface Step {
  key: TransferActor | 'requester'
  labelAr: string
  labelEn: string
  /** `status` values that mean this step is done. */
  doneAt: readonly TransferStatus[]
}

const STEPS: readonly Step[] = [
  { key: 'requester', labelAr: 'طلب', labelEn: 'Request', doneAt: ['pending', 'approved', 'executed', 'received'] },
  { key: 'approver', labelAr: 'اعتماد', labelEn: 'Approve', doneAt: ['approved', 'executed', 'received'] },
  { key: 'sender', labelAr: 'إرسال', labelEn: 'Send', doneAt: ['executed', 'received'] },
  { key: 'receiver', labelAr: 'تأكيد الاستلام', labelEn: 'Confirm receipt', doneAt: ['received'] },
]

/** Roles allowed to drive each step in the UI. */
const ACTOR_ROLES: Record<TransferActor, readonly Role[]> = {
  approver: [Role.MainWarehouseManager, Role.SubWarehouseManager, Role.SystemAdmin],
  sender: [Role.MainWarehouseManager, Role.SubWarehouseManager, Role.SystemAdmin],
  receiver: [Role.MainWarehouseManager, Role.SubWarehouseManager, Role.SystemAdmin],
}

const ACTOR_LABEL: Record<TransferActor, string> = {
  approver: 'مدير المخزن (اعتماد)',
  sender: 'أمين المخزن المصدر (إرسال)',
  receiver: 'أمين مخزن الوجهة (تأكيد الاستلام)',
}

function principalCanAct(principal: Principal | null, actor: TransferActor): boolean {
  if (!principal) return false
  return ACTOR_ROLES[actor].some((role) => hasRole(principal, role))
}

export interface TransferFlowBarProps {
  status: TransferStatus
  principal: Principal | null
  pending?: boolean
  /** Advance (or reject) the workflow. The caller persists the new `status`. */
  onAdvance: (to: TransferStatus) => void
}

export function TransferFlowBar({ status, principal, pending = false, onAdvance }: TransferFlowBarProps) {
  const actor = nextActor(status)
  const canAct = actor ? principalCanAct(principal, actor) : false

  return (
    <div className="space-y-3 rounded-xl border border-black/10 p-4 dark:border-white/10">
      <ol className="flex flex-wrap items-center gap-2">
        {STEPS.map((step, index) => {
          const done = step.doneAt.includes(status)
          const current = actor === step.key || (step.key === 'requester' && status === 'pending')
          return (
            <li key={step.key} className="flex items-center gap-2">
              <span
                className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-semibold ${
                  done
                    ? 'bg-emerald-600 text-white'
                    : current
                      ? 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900'
                      : 'bg-black/10 text-zinc-500 dark:bg-white/10'
                }`}
              >
                {done ? '✓' : index + 1}
              </span>
              <span className="text-sm">
                {step.labelAr}
                <span className="text-zinc-400"> / {step.labelEn}</span>
              </span>
              {index < STEPS.length - 1 ? (
                <span aria-hidden className="mx-1 text-zinc-300 dark:text-zinc-600">
                  ←
                </span>
              ) : null}
            </li>
          )
        })}
      </ol>

      {status === 'rejected' ? (
        <Badge tone="danger">مرفوض</Badge>
      ) : status === 'received' ? (
        <Badge tone="success">مكتمل — تم تحديث الأرصدة</Badge>
      ) : actor == null ? null : canAct ? (
        <div className="flex flex-wrap gap-2">
          {actor === 'approver' ? (
            <>
              <Button disabled={pending} onClick={() => onAdvance('approved')}>
                اعتماد
              </Button>
              <Button variant="danger" disabled={pending} onClick={() => onAdvance('rejected')}>
                رفض
              </Button>
            </>
          ) : actor === 'sender' ? (
            <Button disabled={pending} onClick={() => onAdvance('executed')}>
              إرسال الشحنة
            </Button>
          ) : (
            <Button disabled={pending} onClick={() => onAdvance('received')}>
              تأكيد الاستلام
            </Button>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-500">
          بانتظار إجراء: <span className="font-medium">{ACTOR_LABEL[actor]}</span>
        </p>
      )}
    </div>
  )
}
