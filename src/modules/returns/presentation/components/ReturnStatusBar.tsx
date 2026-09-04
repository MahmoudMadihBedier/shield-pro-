/**
 * The return-request approval step: pending → Approve / Reject, gated by
 * `hasRole` (`RETURNS_MANAGER_ROLES`). Real segregation-of-duties enforcement
 * (the approver must not be the requester) happens server-side in Functions —
 * this only warns the approver client-side before they act, per
 * `IMPLEMENTATION_PLAN.md` Phase 2 Story 2.8 ("own approval — SoD").
 */
import { hasRole, type Principal, type Role } from '@/core/rbac'
import { Badge, Button, Card } from '@/shared/ui'

import type { ReturnStatus } from '../../domain/schemas'

export interface ReturnStatusBarProps {
  status: ReturnStatus
  requestedBy?: string | null
  principal: Principal | null
  managerRoles: readonly Role[]
  pending?: boolean
  onApprove: () => void
  onReject: () => void
}

export function ReturnStatusBar({
  status,
  requestedBy,
  principal,
  managerRoles,
  pending = false,
  onApprove,
  onReject,
}: ReturnStatusBarProps) {
  if (status === 'approved') return <Badge tone="success">مقبول / Approved</Badge>
  if (status === 'rejected') return <Badge tone="danger">مرفوض / Rejected</Badge>

  // pending
  const canAct = principal != null && managerRoles.some((role) => hasRole(principal, role))
  const isSelfApproval =
    principal != null && requestedBy != null && requestedBy !== '' && principal.userId === requestedBy

  if (!canAct) {
    return <p className="text-sm text-zinc-500">قيد الانتظار — بانتظار اعتماد محاسب الفرع.</p>
  }

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning">قيد الانتظار / Pending</Badge>
      </div>
      {isSelfApproval ? (
        <p role="alert" className="text-xs text-amber-700 dark:text-amber-300">
          أنت من قدّم هذا الطلب — الفصل بين المهام يمنع اعتماد طلبك الخاص عادة. سيتحقق الخادم من ذلك عند
          الاعتماد الفعلي.
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button disabled={pending} onClick={onApprove}>
          اعتماد / Approve
        </Button>
        <Button variant="danger" disabled={pending} onClick={onReject}>
          رفض / Reject
        </Button>
      </div>
    </Card>
  )
}
