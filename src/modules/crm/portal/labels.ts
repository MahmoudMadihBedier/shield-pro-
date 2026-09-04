import { DocStatus } from '@/core/doc-status'
import type { BadgeTone } from '@/shared/ui'

/** Arabic-first payment-method labels for the customer-facing portal. */
export const PORTAL_PAYMENT_METHOD_LABEL: Record<string, string> = {
  cash: 'نقدًا',
  credit: 'آجل',
  bank_transfer: 'حوالة بنكية',
  partial: 'جزئي',
  post_dated_cheque: 'شيك مؤجل',
}

export function portalPaymentMethodLabel(method: string): string {
  return PORTAL_PAYMENT_METHOD_LABEL[method] ?? method
}

const DOC_STATUS_LABEL: Record<number, string> = {
  [DocStatus.Draft]: 'مسودة',
  [DocStatus.Submitted]: 'معتمدة',
  [DocStatus.Cancelled]: 'ملغاة',
}

const DOC_STATUS_TONE: Record<number, BadgeTone> = {
  [DocStatus.Draft]: 'neutral',
  [DocStatus.Submitted]: 'success',
  [DocStatus.Cancelled]: 'danger',
}

export function docStatusLabelAr(status: number): string {
  return DOC_STATUS_LABEL[status] ?? 'غير معروف'
}

export function docStatusTone(status: number): BadgeTone {
  return DOC_STATUS_TONE[status] ?? 'neutral'
}
