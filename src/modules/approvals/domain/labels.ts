/**
 * Arabic-first display labels for the `approvals` module. Movement types are
 * the submittable-document tables (`@/core/document`); the two extra maps
 * cover the rule action and the request-decision state.
 *
 * `domain` has ZERO framework imports — plain TypeScript only.
 */
import { SUBMITTABLE_DOC_TABLES, type SubmittableDocTable } from '@/core/document'

import type { ApprovalRequestState, ApprovalRuleAction } from './schemas'

export interface Label {
  ar: string
  en: string
}

export function bilingual(label: Label): string {
  return `${label.ar} / ${label.en}`
}

/** Movement-type labels — one per submittable document table (Story 2.2's
 *  `approval_rules.movement_type` is one of these). */
export const MOVEMENT_TYPE_LABELS: Record<SubmittableDocTable, Label> = {
  purchase_orders: { ar: 'أمر شراء', en: 'Purchase order' },
  stock_receipts: { ar: 'إذن استلام خامات', en: 'Raw-material receipt' },
  production_requests: { ar: 'طلب إنتاج', en: 'Production request' },
  production_batches: { ar: 'تشغيلة إنتاج', en: 'Production batch' },
  warehouse_transfers: { ar: 'تحويل مخزني', en: 'Warehouse transfer' },
  rep_stock_issues: { ar: 'صرف بضاعة لمندوب', en: 'Rep stock issue' },
  sales_invoices: { ar: 'فاتورة مبيعات', en: 'Sales invoice' },
  receipts: { ar: 'سند تحصيل', en: 'Collection / receipt' },
  payment_vouchers: { ar: 'سند صرف', en: 'Payment voucher' },
  return_requests: { ar: 'طلب مرتجع', en: 'Return request' },
  write_offs: { ar: 'إذن إعدام / هالك', en: 'Write-off / damage' },
  stock_count_sessions: { ar: 'جلسة جرد', en: 'Stock count session' },
  rep_closeouts: { ar: 'تقفيل يومي لمندوب', en: 'Rep daily close-out' },
}

export function movementTypeLabel(movementType: string): Label {
  return (
    MOVEMENT_TYPE_LABELS[movementType as SubmittableDocTable] ?? { ar: movementType, en: movementType }
  )
}

export const MOVEMENT_TYPE_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  SUBMITTABLE_DOC_TABLES.map((table) => ({ value: table, label: bilingual(MOVEMENT_TYPE_LABELS[table]) }))

export const APPROVAL_ACTION_LABELS: Record<ApprovalRuleAction, Label> = {
  auto_approve: { ar: 'موافقة تلقائية', en: 'Auto-approve' },
  force_manual: { ar: 'مراجعة يدوية إلزامية', en: 'Force manual review' },
}

export const APPROVAL_ACTION_OPTIONS: ReadonlyArray<{ value: ApprovalRuleAction; label: string }> = (
  Object.keys(APPROVAL_ACTION_LABELS) as ApprovalRuleAction[]
).map((action) => ({ value: action, label: bilingual(APPROVAL_ACTION_LABELS[action]) }))

export const APPROVAL_STATE_LABELS: Record<ApprovalRequestState, Label> = {
  pending: { ar: 'قيد المراجعة', en: 'Pending' },
  auto_approved: { ar: 'موافقة تلقائية', en: 'Auto-approved' },
  approved: { ar: 'مقبول', en: 'Approved' },
  rejected: { ar: 'مرفوض', en: 'Rejected' },
}

export function approvalStateLabel(state: string): Label {
  return (
    APPROVAL_STATE_LABELS[state as ApprovalRequestState] ?? { ar: state, en: state }
  )
}
