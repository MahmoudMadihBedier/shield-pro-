/**
 * Thin bindings of the shared submittable-document hooks
 * (`src/shared/documents`) to the two accounting doc repos. Presentation code
 * calls these instead of passing a repo around.
 */
import {
  useDocument,
  useDocumentActions,
  useDocumentList,
  type DocumentListParams,
} from '@/shared/documents'

import { paymentVouchersRepo, receiptsRepo } from '../../data/repos'

// --- receipts (collections) ---------------------------------------------

export const useReceiptList = (params: DocumentListParams = {}) =>
  useDocumentList(receiptsRepo, params)

export const useReceipt = (id: string | undefined) => useDocument(receiptsRepo, id)

export const useReceiptActions = () => useDocumentActions(receiptsRepo)

// --- payment vouchers ---------------------------------------------------

export const usePaymentVoucherList = (params: DocumentListParams = {}) =>
  useDocumentList(paymentVouchersRepo, params)

export const usePaymentVoucher = (id: string | undefined) => useDocument(paymentVouchersRepo, id)

export const usePaymentVoucherActions = () => useDocumentActions(paymentVouchersRepo)
