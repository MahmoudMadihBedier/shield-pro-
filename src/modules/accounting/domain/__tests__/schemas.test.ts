import { describe, expect, it } from 'vitest'

import {
  glEntryRowSchema,
  invoiceForAgingSchema,
  paymentVoucherFormSchema,
  paymentVoucherRowSchema,
  receiptFormSchema,
  receiptRowSchema,
} from '../schemas'

const receiptRow = {
  $id: 'r1',
  $createdAt: 't',
  $updatedAt: 't',
  reference_id: 'REC-2026-00001',
  doc_status: 0,
  branch_id: null,
  created_by: 'u1',
  amended_from: null,
  posting_datetime: '2026-08-01T00:00:00.000Z',
  remarks: null,
  invoice_ref: 'INV-2026-00009',
  customer_id: 'c1',
  amount: 250,
  method: 'cash',
  evidence_file_id: null,
  collected_by: 'u1',
}

describe('receiptRowSchema', () => {
  it('accepts a well-formed row and defaults a missing amount to 0', () => {
    expect(receiptRowSchema.parse(receiptRow).amount).toBe(250)
    expect(receiptRowSchema.parse({ ...receiptRow, amount: null }).amount).toBe(0)
  })

  it('rejects an unknown payment method', () => {
    expect(receiptRowSchema.safeParse({ ...receiptRow, method: 'crypto' }).success).toBe(false)
  })
})

describe('receiptFormSchema', () => {
  it('rejects a non-positive amount and a missing invoice', () => {
    expect(
      receiptFormSchema.safeParse({ invoice_ref: '', customer_id: 'c1', amount: 0, method: 'cash' })
        .success,
    ).toBe(false)
  })

  it('accepts a valid submission', () => {
    expect(
      receiptFormSchema.safeParse({
        invoice_ref: 'INV-1',
        customer_id: 'c1',
        amount: 10,
        method: 'bank_transfer',
      }).success,
    ).toBe(true)
  })
})

describe('paymentVoucherFormSchema', () => {
  it('requires a reason', () => {
    const res = paymentVoucherFormSchema.safeParse({
      direction: 'payment',
      amount: 100,
      reason: '   ',
    })
    expect(res.success).toBe(false)
  })

  it('accepts a valid payment voucher', () => {
    expect(
      paymentVoucherFormSchema.safeParse({
        direction: 'receipt',
        amount: 100,
        reason: 'إيداع نقدية',
      }).success,
    ).toBe(true)
  })
})

describe('paymentVoucherRowSchema', () => {
  it('rejects an unknown direction', () => {
    const base = {
      $id: 'v1',
      $createdAt: 't',
      $updatedAt: 't',
      reference_id: 'PV-2026-00001',
      doc_status: 1,
      created_by: 'u1',
      posting_datetime: '2026-08-01T00:00:00.000Z',
      direction: 'sideways',
      amount: 5,
      reason: 'x',
    }
    expect(paymentVoucherRowSchema.safeParse(base).success).toBe(false)
  })
})

describe('glEntryRowSchema', () => {
  it('defaults debit/credit/is_cancelled and accepts a row', () => {
    const parsed = glEntryRowSchema.parse({
      $id: 'g1',
      $createdAt: 't',
      $updatedAt: 't',
      voucher_type: 'Receipt',
      voucher_no: 'REC-2026-00001',
      account: 'cash',
      posting_datetime: '2026-08-01T00:00:00.000Z',
      debit: 250,
      credit: null,
      is_cancelled: null,
    })
    expect(parsed).toMatchObject({ debit: 250, credit: 0, is_cancelled: false })
  })
})

describe('invoiceForAgingSchema', () => {
  it('accepts the minimal projection and rejects a bad payment_method', () => {
    const row = {
      $id: 'i1',
      $createdAt: 't',
      $updatedAt: 't',
      reference_id: 'INV-2026-00001',
      customer_id: 'c1',
      net_total: 500,
      payment_method: 'credit',
      posting_datetime: '2026-08-01T00:00:00.000Z',
      doc_status: 1,
    }
    expect(invoiceForAgingSchema.safeParse(row).success).toBe(true)
    expect(invoiceForAgingSchema.safeParse({ ...row, payment_method: 'barter' }).success).toBe(
      false,
    )
  })
})
