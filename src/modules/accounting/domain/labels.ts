/**
 * Arabic-first (AR + EN gloss) labels for the `accounting` enums and option
 * lists. Pure data — presentation imports these so no strings are inlined in
 * components.
 */
import { AGING_BUCKETS, type AgingBucket } from './aging'
import {
  RECEIPT_METHODS,
  VOUCHER_DIRECTIONS,
  type ReceiptMethod,
  type VoucherDirection,
} from './schemas'

export interface BilingualLabel {
  ar: string
  en: string
}

export const RECEIPT_METHOD_LABELS: Record<ReceiptMethod, BilingualLabel> = {
  cash: { ar: 'نقدًا', en: 'Cash' },
  bank_transfer: { ar: 'تحويل بنكي', en: 'Bank transfer' },
  post_dated_cheque: { ar: 'شيك آجل', en: 'Post-dated cheque' },
}

export const VOUCHER_DIRECTION_LABELS: Record<VoucherDirection, BilingualLabel> = {
  receipt: { ar: 'سند قبض', en: 'Receipt (in)' },
  payment: { ar: 'سند صرف', en: 'Payment (out)' },
}

export const AGING_BUCKET_LABELS: Record<AgingBucket, BilingualLabel> = {
  '0-30': { ar: '0–30 يومًا', en: '0–30 days' },
  '31-60': { ar: '31–60 يومًا', en: '31–60 days' },
  '61-90': { ar: '61–90 يومًا', en: '61–90 days' },
  '90+': { ar: '+90 يومًا', en: '90+ days' },
}

/** `{ value, label }` option list for a `<SelectField>`. */
export const RECEIPT_METHOD_OPTIONS = RECEIPT_METHODS.map((value) => ({
  value,
  label: `${RECEIPT_METHOD_LABELS[value].ar} / ${RECEIPT_METHOD_LABELS[value].en}`,
}))

export const VOUCHER_DIRECTION_OPTIONS = VOUCHER_DIRECTIONS.map((value) => ({
  value,
  label: `${VOUCHER_DIRECTION_LABELS[value].ar} / ${VOUCHER_DIRECTION_LABELS[value].en}`,
}))

export const AGING_BUCKET_ORDER: readonly AgingBucket[] = AGING_BUCKETS
