import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows } = vi.hoisted(() => ({ mockListRows: vi.fn() }))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows }, Query }
})

import { getAuditTrail, resolveNode } from '../traceability-repo'

function docRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'row-1',
    $createdAt: '2026-08-30T10:00:00.000Z',
    reference_id: 'PO-2026-00001',
    doc_status: 1,
    created_by: 'user-1',
    posting_datetime: '2026-08-30T10:00:00.000Z',
    ...overrides,
  }
}

function auditRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'audit-1',
    actor_id: 'user-1',
    action: 'submit',
    entity_type: 'sales_invoices',
    entity_ref: 'INV-2026-00001',
    before: '{"doc_status":0}',
    after: '{"doc_status":1}',
    created_at: '2026-08-30T10:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
})

describe('resolveNode', () => {
  it('returns ok(null) for an unparseable reference id without touching the network', async () => {
    const result = await resolveNode('not-an-id')
    expect(result).toEqual({ ok: true, value: null })
    expect(mockListRows).not.toHaveBeenCalled()
  })

  it('returns ok(null) for a known prefix that is not a walkable document (ledger)', async () => {
    const result = await resolveNode('SLE-2026-00001')
    expect(result).toEqual({ ok: true, value: null })
    expect(mockListRows).not.toHaveBeenCalled()
  })

  it('returns ok(null) when no row carries the reference id', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    const result = await resolveNode('PO-2026-09999')
    expect(result).toEqual({ ok: true, value: null })
  })

  it('assembles parents from the link columns + amended_from', async () => {
    // A receipt (REC) links back to its invoice via invoice_ref, and is an
    // amendment of an earlier receipt via amended_from.
    mockListRows.mockResolvedValueOnce({
      rows: [
        docRow({
          reference_id: 'REC-2026-00051',
          invoice_ref: 'INV-2026-00044',
          amended_from: 'REC-2026-00050',
        }),
      ],
      total: 1,
    })
    // Every reverse-lookup query (children) returns nothing.
    mockListRows.mockResolvedValue({ rows: [], total: 0 })

    const result = await resolveNode('REC-2026-00051')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value).not.toBeNull()
    expect(result.value?.entityType).toBe('receipts')
    expect(result.value?.docStatus).toBe(1)
    expect(result.value?.parents.sort()).toEqual(['INV-2026-00044', 'REC-2026-00050'])
    expect(result.value?.children).toEqual([])
    expect(result.value?.createdAt).toBe('2026-08-30T10:00:00.000Z')
  })

  it('collects children via the reverse lookups and excludes self', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [docRow({ reference_id: 'PO-2026-00001' })],
      total: 1,
    })
    // Every reverse-lookup table reports the same downstream doc.
    mockListRows.mockResolvedValue({ rows: [{ reference_id: 'SR-2026-00001' }], total: 1 })

    const result = await resolveNode('PO-2026-00001')

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value?.children).toEqual(['SR-2026-00001'])
    expect(result.value?.parents).toEqual([])
  })

  it('issues one row read plus one query per reverse-lookup table (bounded reads)', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [docRow()], total: 1 })
    mockListRows.mockResolvedValue({ rows: [], total: 0 })

    await resolveNode('PO-2026-00001')

    // 14 submittable doc tables carry a reverse-lookup column → 1 + 14 = 15.
    expect(mockListRows).toHaveBeenCalledTimes(15)
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 404, 'not_found'))
    const result = await resolveNode('INV-2026-00001')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not_found')
  })

  it('rejects a row that fails envelope validation', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [docRow({ doc_status: 7 })],
      total: 1,
    })
    const result = await resolveNode('PO-2026-00001')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})

describe('getAuditTrail', () => {
  it('parses rows and reports no cursor when the page is not full', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [auditRow(), auditRow({ $id: 'audit-2' })],
      total: 2,
    })

    const result = await getAuditTrail()

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(2)
    expect(result.value.rows[0]?.action).toBe('submit')
    expect(result.value.nextCursor).toBeUndefined()
  })

  it('returns the last row id as the next cursor when the page is full', async () => {
    mockListRows.mockResolvedValueOnce({
      rows: [auditRow({ $id: 'a1' }), auditRow({ $id: 'a2' })],
      total: 99,
    })

    const result = await getAuditTrail({ limit: 2 })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.nextCursor).toBe('a2')
  })

  it('forwards entity-ref and actor filters as queries', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })

    await getAuditTrail({ entityRef: 'INV-2026-00001', actorId: 'user-9', cursor: 'a2' })

    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/entity_ref/)
    expect(queries.join(' ')).toMatch(/INV-2026-00001/)
    expect(queries.join(' ')).toMatch(/actor_id/)
    expect(queries.join(' ')).toMatch(/user-9/)
    expect(queries.join(' ')).toMatch(/cursorAfter|a2/)
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('boom', 503, 'server_error'))
    const result = await getAuditTrail()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})
