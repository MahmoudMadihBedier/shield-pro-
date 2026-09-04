/**
 * Arabic-first (AR primary + EN gloss) display labels for the `sales` module.
 * Presentation-layer data (it references the shared UI `BadgeTone`).
 */
import type { BadgeTone } from '@/shared/ui'

import type { CloseoutStatus, PaymentMethod, RepIssueStatus } from '../domain/schemas'

export interface Label {
  ar: string
  en: string
}

export const SALES_LABELS = {
  invoice: {
    one: { ar: 'فاتورة مبيعات', en: 'Sales invoice' },
    many: { ar: 'فواتير المبيعات', en: 'Sales invoices' },
  },
  repIssue: {
    one: { ar: 'صرف عهدة مندوب', en: 'Rep stock issue' },
    many: { ar: 'صرف عُهد المندوبين', en: 'Rep stock issues' },
  },
  closeout: {
    one: { ar: 'تقفيل يومي للمندوب', en: 'Rep daily close-out' },
    many: { ar: 'تقفيلات المندوبين', en: 'Rep close-outs' },
  },
} as const satisfies Record<string, { one: Label; many: Label }>

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  cash: 'نقدًا / Cash',
  credit: 'آجل / Credit',
  bank_transfer: 'تحويل بنكي / Bank transfer',
  partial: 'جزئي / Partial',
  post_dated_cheque: 'شيك آجل / Post-dated cheque',
}

export const REP_ISSUE_STATUS_LABEL: Record<RepIssueStatus, string> = {
  pending: 'قيد المراجعة / Pending',
  approved: 'معتمد / Approved',
  rejected: 'مرفوض / Rejected',
  issued: 'تم الصرف / Issued',
}

export const REP_ISSUE_STATUS_TONE: Record<RepIssueStatus, BadgeTone> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  issued: 'success',
}

export const CLOSEOUT_STATUS_LABEL: Record<CloseoutStatus, string> = {
  open: 'مفتوح / Open',
  submitted: 'مُرسَل / Submitted',
  confirmed: 'مؤكَّد / Confirmed',
  flagged: 'به فروقات / Flagged',
}

export const CLOSEOUT_STATUS_TONE: Record<CloseoutStatus, BadgeTone> = {
  open: 'neutral',
  submitted: 'warning',
  confirmed: 'success',
  flagged: 'danger',
}
