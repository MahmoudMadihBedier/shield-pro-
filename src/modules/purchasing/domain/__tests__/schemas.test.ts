import { describe, expect, it } from 'vitest'

import {
  poLineSchema,
  purchaseOrderDraftSchema,
  purchaseOrderFormSchema,
  purchaseOrderRowSchema,
  receiptLineSchema,
  stockReceiptDraftSchema,
  stockReceiptFormSchema,
  stockReceiptRowSchema,
} from '../schemas'

const poRow = {
  $id: 'row-1',
  $createdAt: 't',
  $updatedAt: 't',
  reference_id: 'PO-2026-00001',
  doc_status: 0,
  branch_id: null,
  created_by: 'user-1',
  amended_from: null,
  posting_datetime: '2026-08-31T00:00:00.000Z',
  remarks: null,
  supplier_id: 'sup-1',
  lines: '[]',
  total_value: 0,
}

const receiptRow = {
  $id: 'row-2',
  $createdAt: 't',
  $updatedAt: 't',
  reference_id: 'SR-2026-00001',
  doc_status: 1,
  branch_id: null,
  created_by: 'user-1',
  amended_from: null,
  posting_datetime: '2026-08-31T00:00:00.000Z',
  remarks: null,
  purchase_order_ref: 'PO-2026-00001',
  supplier_lot_number: 'LOT-9',
  lines: '[]',
}

describe('poLineSchema / receiptLineSchema', () => {
  it('accepts a well-formed line', () => {
    const line = { raw_material_id: 'rm-1', qty: 3, unit_price: 12.5 }
    expect(poLineSchema.parse(line)).toEqual(line)
    expect(receiptLineSchema.parse(line)).toEqual(line)
  })

  it('rejects a non-positive qty', () => {
    expect(poLineSchema.safeParse({ raw_material_id: 'rm-1', qty: 0, unit_price: 1 }).success).toBe(
      false,
    )
  })

  it('rejects a negative unit_price', () => {
    expect(
      poLineSchema.safeParse({ raw_material_id: 'rm-1', qty: 1, unit_price: -1 }).success,
    ).toBe(false)
  })
})

describe('purchaseOrderRowSchema', () => {
  it('accepts the Appwrite envelope + PO columns', () => {
    expect(purchaseOrderRowSchema.parse(poRow).reference_id).toBe('PO-2026-00001')
  })

  it('defaults a missing total_value to 0 and tolerates null lines', () => {
    const { total_value, lines, ...rest } = poRow
    void total_value
    void lines
    const parsed = purchaseOrderRowSchema.parse({ ...rest, lines: null })
    expect(parsed.total_value).toBe(0)
    expect(parsed.lines).toBeNull()
  })

  it('rejects a doc_status outside 0..2', () => {
    expect(purchaseOrderRowSchema.safeParse({ ...poRow, doc_status: 7 }).success).toBe(false)
  })

  it('rejects a row missing created_by', () => {
    const { created_by, ...rest } = poRow
    void created_by
    expect(purchaseOrderRowSchema.safeParse(rest).success).toBe(false)
  })
})

describe('stockReceiptRowSchema', () => {
  it('accepts the envelope + receipt columns', () => {
    expect(stockReceiptRowSchema.parse(receiptRow).purchase_order_ref).toBe('PO-2026-00001')
  })

  it('tolerates a null supplier_lot_number', () => {
    expect(
      stockReceiptRowSchema.parse({ ...receiptRow, supplier_lot_number: null }).supplier_lot_number,
    ).toBeNull()
  })
})

describe('draft schemas', () => {
  it('purchaseOrderDraftSchema requires a supplier and a string lines column', () => {
    expect(
      purchaseOrderDraftSchema.safeParse({ supplier_id: '', lines: '[]', total_value: 0 }).success,
    ).toBe(false)
    expect(
      purchaseOrderDraftSchema.safeParse({ supplier_id: 'sup-1', lines: '[]', total_value: 0 })
        .success,
    ).toBe(true)
    expect(
      purchaseOrderDraftSchema.safeParse({ supplier_id: 'sup-1', lines: '[]', total_value: -1 })
        .success,
    ).toBe(false)
  })

  it('stockReceiptDraftSchema requires a purchase_order_ref', () => {
    expect(stockReceiptDraftSchema.safeParse({ purchase_order_ref: '', lines: '[]' }).success).toBe(
      false,
    )
    expect(
      stockReceiptDraftSchema.safeParse({
        purchase_order_ref: 'PO-2026-00001',
        supplier_lot_number: 'LOT-1',
        lines: '[]',
      }).success,
    ).toBe(true)
  })
})

describe('form schemas', () => {
  it('purchaseOrderFormSchema needs a supplier and at least one line with a chosen material', () => {
    expect(purchaseOrderFormSchema.safeParse({ supplier_id: 'sup-1', lines: [] }).success).toBe(
      false,
    )
    expect(
      purchaseOrderFormSchema.safeParse({
        supplier_id: 'sup-1',
        lines: [{ raw_material_id: '', qty: 1, unit_price: 0 }],
      }).success,
    ).toBe(false)
    expect(
      purchaseOrderFormSchema.safeParse({
        supplier_id: 'sup-1',
        lines: [{ raw_material_id: 'rm-1', qty: 1, unit_price: 0 }],
      }).success,
    ).toBe(true)
  })

  it('stockReceiptFormSchema trims and requires the supplier lot number', () => {
    const parsed = stockReceiptFormSchema.safeParse({
      purchase_order_ref: 'PO-2026-00001',
      supplier_lot_number: '  LOT-7  ',
      lines: [{ raw_material_id: 'rm-1', qty: 2, unit_price: 5 }],
    })
    expect(parsed.success).toBe(true)
    if (parsed.success) expect(parsed.data.supplier_lot_number).toBe('LOT-7')

    expect(
      stockReceiptFormSchema.safeParse({
        purchase_order_ref: 'PO-2026-00001',
        supplier_lot_number: '   ',
        lines: [{ raw_material_id: 'rm-1', qty: 2, unit_price: 5 }],
      }).success,
    ).toBe(false)
  })
})
