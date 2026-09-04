/**
 * Data layer for the `accounting` submittable documents. Both `receipts` and
 * `payment_vouchers` are ERPNext-style documents, so they are built from the
 * shared `makeDocumentRepo` factory (`@/shared/documents`) — which routes
 * `createDraft` through `/allocate-reference-id` and `submit` / `cancel`
 * through `shield-server`. This module adds no bespoke lifecycle.
 */
import { makeDocumentRepo } from '@/shared/documents'

import {
  paymentVoucherRowSchema,
  receiptRowSchema,
  type PaymentVoucher,
  type PaymentVoucherDraft,
  type Receipt,
  type ReceiptDraft,
} from '../domain/schemas'

export const receiptsRepo = makeDocumentRepo<Receipt, ReceiptDraft>({
  entity: 'Receipt',
  rowSchema: receiptRowSchema,
})

export const paymentVouchersRepo = makeDocumentRepo<PaymentVoucher, PaymentVoucherDraft>({
  entity: 'PaymentVoucher',
  rowSchema: paymentVoucherRowSchema,
})
