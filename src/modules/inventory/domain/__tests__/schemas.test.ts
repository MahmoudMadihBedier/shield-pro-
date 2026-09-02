import { describe, expect, it } from 'vitest'

import {
  binBalanceRowSchema,
  countLineSchema,
  stockCountSessionRowSchema,
  transferLineSchema,
  varianceLineSchema,
  warehouseTransferDraftSchema,
  warehouseTransferRowSchema,
  writeOffDraftSchema,
  writeOffLineSchema,
  writeOffRowSchema,
  TRANSFER_STATUSES,
  COUNT_SESSION_STATUSES,
  WRITE_OFF_KINDS,
} from '../schemas'

const envelope = {
  $id: 'row-1',
  $createdAt: '2026-08-30T10:00:00.000Z',
  $updatedAt: '2026-08-30T10:00:00.000Z',
  reference_id: 'TRF-2026-00001',
  doc_status: 0,
  created_by: 'user-1',
  posting_datetime: '2026-08-30T10:00:00.000Z',
}

describe('line schemas', () => {
  it('transferLineSchema accepts a positive qty with an optional lot', () => {
    expect(transferLineSchema.parse({ product_id: 'p1', qty: 3 })).toEqual({
      product_id: 'p1',
      qty: 3,
    })
    expect(
      transferLineSchema.parse({ product_id: 'p1', qty: 3, lot_number: 'L-9' }).lot_number,
    ).toBe('L-9')
  })

  it('transferLineSchema rejects a zero / negative qty', () => {
    expect(transferLineSchema.safeParse({ product_id: 'p1', qty: 0 }).success).toBe(false)
    expect(transferLineSchema.safeParse({ product_id: 'p1', qty: -1 }).success).toBe(false)
  })

  it('countLineSchema accepts zero but rejects a negative counted qty', () => {
    expect(countLineSchema.safeParse({ product_id: 'p1', counted_qty: 0 }).success).toBe(true)
    expect(countLineSchema.safeParse({ product_id: 'p1', counted_qty: -2 }).success).toBe(false)
  })

  it('varianceLineSchema accepts a signed variance', () => {
    expect(
      varianceLineSchema.parse({
        product_id: 'p1',
        recorded_qty: 10,
        counted_qty: 7,
        variance: -3,
      }).variance,
    ).toBe(-3)
  })

  it('writeOffLineSchema has the same shape as a transfer line', () => {
    expect(writeOffLineSchema.safeParse({ product_id: 'p1', qty: 2 }).success).toBe(true)
    expect(writeOffLineSchema.safeParse({ product_id: 'p1', qty: 0 }).success).toBe(false)
  })
})

describe('status / kind enums', () => {
  it('expose the schema tuples', () => {
    expect(TRANSFER_STATUSES).toEqual(['pending', 'approved', 'rejected', 'executed', 'received'])
    expect(COUNT_SESSION_STATUSES).toEqual(['open', 'submitted', 'signed_off'])
    expect(WRITE_OFF_KINDS).toEqual(['damage', 'loss', 'scrap'])
  })
})

describe('warehouseTransferRowSchema', () => {
  it('parses a full row and keeps `lines` as a raw string', () => {
    const row = warehouseTransferRowSchema.parse({
      ...envelope,
      from_warehouse_id: 'wh-a',
      to_warehouse_id: 'wh-b',
      lines: '[{"product_id":"p1","qty":2}]',
      status: 'pending',
      requested_by: 'user-1',
      approved_by: null,
      sent_by: null,
      confirmed_received_by: null,
    })
    expect(row.status).toBe('pending')
    expect(typeof row.lines).toBe('string')
  })

  it('rejects an unknown status', () => {
    expect(
      warehouseTransferRowSchema.safeParse({
        ...envelope,
        from_warehouse_id: 'wh-a',
        to_warehouse_id: 'wh-b',
        lines: '[]',
        status: 'shipped',
      }).success,
    ).toBe(false)
  })

  it('rejects an out-of-range doc_status', () => {
    expect(
      warehouseTransferRowSchema.safeParse({
        ...envelope,
        doc_status: 5,
        from_warehouse_id: 'wh-a',
        to_warehouse_id: 'wh-b',
        lines: '[]',
        status: 'pending',
      }).success,
    ).toBe(false)
  })
})

describe('warehouseTransferDraftSchema', () => {
  it('accepts a two-warehouse transfer with at least one line', () => {
    expect(
      warehouseTransferDraftSchema.safeParse({
        from_warehouse_id: 'wh-a',
        to_warehouse_id: 'wh-b',
        lines: [{ product_id: 'p1', qty: 4 }],
      }).success,
    ).toBe(true)
  })

  it('rejects an empty line list', () => {
    expect(
      warehouseTransferDraftSchema.safeParse({
        from_warehouse_id: 'wh-a',
        to_warehouse_id: 'wh-b',
        lines: [],
      }).success,
    ).toBe(false)
  })

  it('rejects a missing source warehouse', () => {
    expect(
      warehouseTransferDraftSchema.safeParse({
        from_warehouse_id: '',
        to_warehouse_id: 'wh-b',
        lines: [{ product_id: 'p1', qty: 4 }],
      }).success,
    ).toBe(false)
  })
})

describe('stockCountSessionRowSchema', () => {
  it('accepts a fresh open session with no counts yet', () => {
    const row = stockCountSessionRowSchema.parse({
      ...envelope,
      reference_id: 'CNT-2026-00001',
      warehouse_id: 'wh-a',
      counts: null,
      variances: null,
      status: 'open',
      signed_off_by: null,
    })
    expect(row.status).toBe('open')
    expect(row.counts).toBeNull()
  })
})

describe('writeOffRowSchema / writeOffDraftSchema', () => {
  it('parses a write-off row', () => {
    const row = writeOffRowSchema.parse({
      ...envelope,
      reference_id: 'WO-2026-00001',
      warehouse_id: 'wh-a',
      lines: '[]',
      kind: 'damage',
      reason: 'water damage',
    })
    expect(row.kind).toBe('damage')
  })

  it('requires a non-empty reason on the draft', () => {
    expect(
      writeOffDraftSchema.safeParse({
        warehouse_id: 'wh-a',
        kind: 'loss',
        reason: '   ',
        lines: [{ product_id: 'p1', qty: 1 }],
      }).success,
    ).toBe(false)
  })

  it('rejects an unknown kind', () => {
    expect(
      writeOffDraftSchema.safeParse({
        warehouse_id: 'wh-a',
        kind: 'expired',
        reason: 'past shelf life',
        lines: [{ product_id: 'p1', qty: 1 }],
      }).success,
    ).toBe(false)
  })
})

describe('binBalanceRowSchema', () => {
  it('parses a projection row', () => {
    const row = binBalanceRowSchema.parse({
      $id: 'bin-1',
      product_id: 'p1',
      warehouse_id: 'wh-a',
      qty: 42,
      updated_datetime: '2026-08-30T10:00:00.000Z',
    })
    expect(row.qty).toBe(42)
  })

  it('rejects a non-numeric qty', () => {
    expect(
      binBalanceRowSchema.safeParse({
        $id: 'bin-1',
        product_id: 'p1',
        warehouse_id: 'wh-a',
        qty: 'lots',
        updated_datetime: '2026-08-30T10:00:00.000Z',
      }).success,
    ).toBe(false)
  })
})
