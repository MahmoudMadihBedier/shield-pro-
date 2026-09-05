import type { TablesDB } from 'node-appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockCreateNotification, mockListSystemAdminUserIds } = vi.hoisted(() => ({
  mockCreateNotification: vi.fn(),
  mockListSystemAdminUserIds: vi.fn(),
}))
vi.mock('../../common/notifications', () => ({
  createNotification: mockCreateNotification,
  listSystemAdminUserIds: mockListSystemAdminUserIds,
}))

import { fraudScan } from '../fraud-scan'

const CALLER = 'user-7'
const ADMINS = ['admin-1', 'admin-2']
/** A `users` profile lookup result for `requireStaffCaller` — always call #1. */
const STAFF_PROFILE = {
  total: 1,
  rows: [{ auth_user_id: CALLER, roles: 'chief_accountant', branch_id: '' }],
}
const EMPTY = { total: 0, rows: [] }

function fakeDb(over: Partial<Record<keyof TablesDB, unknown>>): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(STAFF_PROFILE), ...over } as unknown as TablesDB
}

/** `listRows` mock returning, in call order: staff profile, moves, audit events, open flags. */
function fakeDbSequence(
  moves: unknown[],
  auditEvents: unknown[],
  openFlags: unknown[],
  createRow = vi.fn().mockResolvedValue({}),
) {
  const listRows = vi
    .fn()
    .mockResolvedValueOnce(STAFF_PROFILE)
    .mockResolvedValueOnce({ total: moves.length, rows: moves })
    .mockResolvedValueOnce({ total: auditEvents.length, rows: auditEvents })
    .mockResolvedValueOnce({ total: openFlags.length, rows: openFlags })
  return fakeDb({ listRows, createRow })
}

function slEntry(over: Record<string, unknown>) {
  return {
    voucher_type: 'WarehouseTransfer',
    voucher_no: 'WT-1',
    product_id: 'p1',
    warehouse_id: 'w1',
    qty_change: 10,
    posting_datetime: '2026-09-01T09:00:00.000Z',
    is_cancelled: false,
    ...over,
  }
}

describe('fraudScan', () => {
  beforeEach(() => {
    mockCreateNotification.mockReset().mockResolvedValue(undefined)
    mockListSystemAdminUserIds.mockReset().mockResolvedValue(ADMINS)
  })

  it('rejects an anonymous caller', async () => {
    await expect(fraudScan(fakeDb({}), {}, null)).rejects.toMatchObject({ code: 'unauthorized' })
  })

  it('rejects a caller with no staff profile', async () => {
    const listRows = vi.fn().mockResolvedValue(EMPTY)
    await expect(fraudScan(fakeDb({ listRows }), {}, CALLER)).rejects.toMatchObject({
      code: 'forbidden',
    })
  })

  it('rejects a lookbackHours beyond the 7-day cap', async () => {
    await expect(fraudScan(fakeDb({}), { lookbackHours: 169 }, CALLER)).rejects.toMatchObject({
      code: 'validation',
    })
  })

  it('creates 0 flags but still writes the scan audit row when nothing is found', async () => {
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDbSequence([], [], [], createRow)

    const out = await fraudScan(db, {}, CALLER)

    expect(out).toEqual({ scanned: { moves: 0, auditEvents: 0 }, flagsCreated: 0, flags: [] })
    expect(createRow).toHaveBeenCalledTimes(1)
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({ action: 'fraud_scan', entity_type: 'fraud_flags' }),
      }),
    )
  })

  it('flags a round-trip and a high-reversal-ratio actor, writing one row each plus the scan audit row', async () => {
    const moves = [
      slEntry({
        voucher_no: 'WT-1',
        qty_change: -50,
        posting_datetime: '2026-09-01T09:00:00.000Z',
      }),
      slEntry({ voucher_no: 'WT-2', qty_change: 50, posting_datetime: '2026-09-01T11:00:00.000Z' }),
    ]
    const auditEvents = [
      ...Array.from({ length: 6 }, (_, i) => ({
        actor_id: 'user-9',
        action: 'submit',
        entity_type: 'sales_invoices',
        entity_ref: `SI-${i}`,
        created_at: '2026-09-01T10:00:00.000Z',
      })),
      ...Array.from({ length: 2 }, (_, i) => ({
        actor_id: 'user-9',
        action: 'cancel',
        entity_type: 'sales_invoices',
        entity_ref: `SI-${i}`,
        created_at: '2026-09-01T10:30:00.000Z',
      })),
    ]
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDbSequence(moves, auditEvents, [], createRow)

    const out = await fraudScan(db, {}, CALLER)

    expect(out.scanned).toEqual({ moves: 2, auditEvents: 8 })
    expect(out.flagsCreated).toBe(2)
    expect(createRow).toHaveBeenCalledTimes(3) // 2 flags + 1 scan audit row

    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'fraud_flags',
        data: expect.objectContaining({
          kind: 'round_tripping',
          subject_type: 'product_warehouse',
          subject_id: 'p1:w1',
          status: 'open',
        }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'fraud_flags',
        data: expect.objectContaining({
          kind: 'high_reversal_ratio',
          subject_type: 'actor',
          subject_id: 'user-9',
          status: 'open',
        }),
      }),
    )
    expect(createRow).toHaveBeenCalledWith(
      expect.objectContaining({
        tableId: 'audit_log',
        data: expect.objectContaining({
          action: 'fraud_scan',
          after: JSON.stringify({ created: 2 }),
        }),
      }),
    )

    // The admin roster is fetched once for the whole batch, not once per flag.
    expect(mockListSystemAdminUserIds).toHaveBeenCalledTimes(1)
    expect(mockListSystemAdminUserIds).toHaveBeenCalledWith(db)

    // One notification per (created flag × admin) pair: 2 flags × 2 admins.
    expect(mockCreateNotification).toHaveBeenCalledTimes(4)
    expect(mockCreateNotification).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        recipientUserId: 'admin-1',
        kind: 'fraud_flag',
        entityRef: 'p1:w1',
        body: expect.stringContaining('p1:w1'),
      }),
    )
    expect(mockCreateNotification).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        recipientUserId: 'admin-2',
        kind: 'fraud_flag',
        entityRef: 'p1:w1',
      }),
    )
    expect(mockCreateNotification).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        recipientUserId: 'admin-1',
        kind: 'fraud_flag',
        entityRef: 'user-9',
      }),
    )
    expect(mockCreateNotification).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        recipientUserId: 'admin-2',
        kind: 'fraud_flag',
        entityRef: 'user-9',
      }),
    )
  })

  it('does not notify when no new fraud flag is created', async () => {
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDbSequence([], [], [], createRow)

    await fraudScan(db, {}, CALLER)

    expect(mockListSystemAdminUserIds).not.toHaveBeenCalled()
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('skips creating a fraud_flags row for a subject that already has an open flag', async () => {
    const moves = [
      slEntry({
        voucher_no: 'WT-1',
        qty_change: -50,
        posting_datetime: '2026-09-01T09:00:00.000Z',
      }),
      slEntry({ voucher_no: 'WT-2', qty_change: 50, posting_datetime: '2026-09-01T11:00:00.000Z' }),
    ]
    const openFlags = [{ kind: 'round_tripping', subject_id: 'p1:w1' }]
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDbSequence(moves, [], openFlags, createRow)

    const out = await fraudScan(db, {}, CALLER)

    expect(out.flagsCreated).toBe(0)
    expect(createRow).toHaveBeenCalledTimes(1) // only the scan audit row
    expect(createRow).not.toHaveBeenCalledWith(expect.objectContaining({ tableId: 'fraud_flags' }))
    expect(mockListSystemAdminUserIds).not.toHaveBeenCalled()
    expect(mockCreateNotification).not.toHaveBeenCalled()
  })

  it('does not let a notification failure fail the scan (would otherwise roll back the whole transaction)', async () => {
    const moves = [
      slEntry({
        voucher_no: 'WT-1',
        qty_change: -50,
        posting_datetime: '2026-09-01T09:00:00.000Z',
      }),
      slEntry({ voucher_no: 'WT-2', qty_change: 50, posting_datetime: '2026-09-01T11:00:00.000Z' }),
    ]
    const createRow = vi.fn().mockResolvedValue({})
    const db = fakeDbSequence(moves, [], [], createRow)
    mockCreateNotification.mockRejectedValueOnce(new Error('network blip'))

    const out = await fraudScan(db, {}, CALLER)

    expect(out.flagsCreated).toBe(1)
    expect(createRow).toHaveBeenCalledWith(expect.objectContaining({ tableId: 'fraud_flags' }))
    // The failed admin-1 call and the still-successful admin-2 call both happen.
    expect(mockCreateNotification).toHaveBeenCalledTimes(2)
  })
})
