/**
 * Data layer for the `accounting` submittable documents. Both `receipts` and
 * `payment_vouchers` are ERPNext-style documents, so they are built from the
 * shared `makeDocumentRepo` factory (`@/shared/documents`) — which routes
 * `createDraft` through `/allocate-reference-id` and `submit` / `cancel`
 * through `shield-server`. This module adds no bespoke lifecycle.
 */
import { makeDocumentRepo } from '@/shared/documents'

import {
  capitalContributionRowSchema,
  capitalWithdrawalRowSchema,
  paymentVoucherRowSchema,
  receiptRowSchema,
  type CapitalContribution,
  type CapitalContributionDraft,
  type CapitalWithdrawal,
  type CapitalWithdrawalDraft,
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

export const capitalContributionsRepo = makeDocumentRepo<
  CapitalContribution,
  CapitalContributionDraft
>({
  entity: 'CapitalContribution',
  rowSchema: capitalContributionRowSchema,
})

export const capitalWithdrawalsRepo = makeDocumentRepo<CapitalWithdrawal, CapitalWithdrawalDraft>({
  entity: 'CapitalWithdrawal',
  rowSchema: capitalWithdrawalRowSchema,
})
