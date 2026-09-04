import { describe, expect, it } from 'vitest'

import {
  PRODUCTION_REQUEST_STATUSES,
  QC_STATUSES,
  productionBatchRowSchema,
  productionRequestRowSchema,
  rawMaterialLotSchema,
  requiredMaterialLineSchema,
} from '../schemas'

const requestRow = {
  $id: 'row-1',
  $createdAt: '2026-01-01T00:00:00.000Z',
  $updatedAt: '2026-01-01T00:00:00.000Z',
  reference_id: 'PR-2026-00001',
  doc_status: 0,
  branch_id: null,
  created_by: 'user-1',
  amended_from: null,
  posting_datetime: '2026-01-01T00:00:00.000Z',
  remarks: null,
  product_id: 'prod-1',
  planned_qty: 100,
  required_materials: '[]',
  status: 'pending',
}

const batchRow = {
  ...requestRow,
  reference_id: 'BATCH-2026-00001',
  production_request_ref: 'PR-2026-00001',
  product_id: 'prod-1',
  lot_number: 'LOT-A',
  produced_qty: 95,
  waste_qty: 5,
  raw_material_lots: '[]',
  expected_cost: 500,
  expected_profit: 200,
  qc_status: 'pending_qc',
  qc_by: null,
  expiry_date: '2027-01-01',
}

describe('enum tuples', () => {
  it('lists the production request statuses in schema order', () => {
    expect(PRODUCTION_REQUEST_STATUSES).toEqual(['pending', 'approved', 'rejected', 'issued'])
  })

  it('lists the QC statuses in schema order', () => {
    expect(QC_STATUSES).toEqual(['pending_qc', 'released', 'rejected'])
  })
})

describe('productionRequestRowSchema', () => {
  it('accepts a well-formed row', () => {
    expect(productionRequestRowSchema.parse(requestRow).status).toBe('pending')
  })

  it('defaults a null required_materials column to an empty JSON array', () => {
    expect(productionRequestRowSchema.parse({ ...requestRow, required_materials: null }).required_materials).toBe('[]')
  })

  it('rejects a row whose status is not an enum member', () => {
    expect(productionRequestRowSchema.safeParse({ ...requestRow, status: 'draft' }).success).toBe(false)
  })

  it('rejects a row missing product_id', () => {
    const rest: Record<string, unknown> = { ...requestRow }
    delete rest.product_id
    expect(productionRequestRowSchema.safeParse(rest).success).toBe(false)
  })
})

describe('productionBatchRowSchema', () => {
  it('accepts a well-formed row', () => {
    expect(productionBatchRowSchema.parse(batchRow).lot_number).toBe('LOT-A')
  })

  it('defaults null numeric columns to 0', () => {
    const parsed = productionBatchRowSchema.parse({ ...batchRow, waste_qty: null, expected_cost: null })
    expect(parsed.waste_qty).toBe(0)
    expect(parsed.expected_cost).toBe(0)
  })

  it('rejects a row whose qc_status is not an enum member', () => {
    expect(productionBatchRowSchema.safeParse({ ...batchRow, qc_status: 'hold' }).success).toBe(false)
  })
})

describe('JSON line schemas', () => {
  it('accepts a required-material line', () => {
    expect(requiredMaterialLineSchema.safeParse({ raw_material_id: 'rm-1', qty: 0 }).success).toBe(true)
  })

  it('rejects a required-material line with a negative qty', () => {
    expect(requiredMaterialLineSchema.safeParse({ raw_material_id: 'rm-1', qty: -1 }).success).toBe(false)
  })

  it('accepts a raw-material lot with a positive qty_consumed', () => {
    expect(rawMaterialLotSchema.safeParse({ purchase_order_ref: 'PO-1', qty_consumed: 2 }).success).toBe(true)
  })

  it('rejects a raw-material lot whose qty_consumed is zero', () => {
    expect(rawMaterialLotSchema.safeParse({ purchase_order_ref: 'PO-1', qty_consumed: 0 }).success).toBe(false)
  })
})
