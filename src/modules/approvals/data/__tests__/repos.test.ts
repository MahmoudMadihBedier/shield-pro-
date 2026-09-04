import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockGetRow, mockCreateRow, mockUpdateRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockGetRow: vi.fn(),
  mockCreateRow: vi.fn(),
  mockUpdateRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return {
    Query,
    ID: { unique: () => 'generated-id' },
    tablesDB: {
      listRows: mockListRows,
      getRow: mockGetRow,
      createRow: mockCreateRow,
      updateRow: mockUpdateRow,
    },
  }
})

import { approvalRequestsRepo, approvalRuleLogRepo, approvalRulesRepo } from '../repos'

function ruleRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'rule-1',
    $createdAt: 't',
    $updatedAt: 't',
    movement_type: 'sales_invoices',
    predicate: '{"maxQtyMultipleOfRepAverage":3}',
    action: 'auto_approve',
    priority: 10,
    is_active: true,
    ...overrides,
  }
}

function requestRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'req-1',
    $createdAt: 't',
    $updatedAt: 't',
    entity_type: 'sales_invoices',
    entity_ref: 'INV-2026-00042',
    branch_id: null,
    requested_by: 'user-1',
    state: 'pending',
    decided_by: null,
    decision_reason: null,
    created_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

function logRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'log-1',
    $createdAt: 't',
    $updatedAt: 't',
    movement_type: 'sales_invoices',
    entity_ref: 'INV-2026-00042',
    actor_id: 'user-1',
    rule_matched: 'rule-1',
    outcome: 'auto_approve',
    created_at: '2026-09-01T00:00:00.000Z',
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockGetRow.mockReset()
  mockCreateRow.mockReset()
  mockUpdateRow.mockReset()
})

describe('approvalRulesRepo', () => {
  it('encodes a structured predicate to a JSON string on create', async () => {
    mockCreateRow.mockResolvedValueOnce(ruleRow())

    const result = await approvalRulesRepo.create({
      movement_type: 'sales_invoices',
      predicate: { maxQtyMultipleOfRepAverage: 3 },
      action: 'auto_approve',
      priority: 10,
      is_active: true,
    })

    expect(result.ok).toBe(true)
    const payload = mockCreateRow.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(payload.data.predicate).toBe('{"maxQtyMultipleOfRepAverage":3}')
  })

  it('parses the wire predicate back out on list', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [ruleRow()], total: 1 })

    const result = await approvalRulesRepo.list({ page: 0, pageSize: 25, sort: null })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rows[0]?.predicate).toBe('{"maxQtyMultipleOfRepAverage":3}')
    }
  })

  it('only re-encodes predicate on update when it is part of the patch', async () => {
    mockUpdateRow.mockResolvedValueOnce(ruleRow({ priority: 20 }))

    const result = await approvalRulesRepo.update('rule-1', { priority: 20 })

    expect(result.ok).toBe(true)
    const payload = mockUpdateRow.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(payload.data).toEqual({ priority: 20 })
  })

  it('re-encodes predicate on update when it is part of the patch', async () => {
    mockUpdateRow.mockResolvedValueOnce(ruleRow())

    await approvalRulesRepo.update('rule-1', { predicate: { requireManualIfNewCustomer: true } })

    const payload = mockUpdateRow.mock.calls[0]?.[0] as { data: Record<string, unknown> }
    expect(payload.data.predicate).toBe('{"requireManualIfNewCustomer":true}')
  })

  it('maps a raw Appwrite failure to a typed AppError on create', async () => {
    mockCreateRow.mockRejectedValueOnce(new Error('network down'))
    const result = await approvalRulesRepo.create({
      movement_type: 'sales_invoices',
      predicate: {},
      action: 'auto_approve',
      priority: 10,
      is_active: true,
    })
    expect(result.ok).toBe(false)
  })
})

describe('approvalRequestsRepo', () => {
  it('lists requests filtered to one state', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [requestRow()], total: 1 })

    const result = await approvalRequestsRepo.list({ page: 0, pageSize: 25, state: 'pending' })

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.rows).toHaveLength(1)
      expect(result.value.total).toBe(1)
    }
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).toMatch(/"attribute":"state".*"values":\["pending"\]/)
  })

  it('gets one request by id', async () => {
    mockGetRow.mockResolvedValueOnce(requestRow())
    const result = await approvalRequestsRepo.get('req-1')
    expect(result.ok).toBe(true)
  })

  it('maps a malformed row to a server AppError instead of throwing', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const result = await approvalRequestsRepo.list({ page: 0, pageSize: 25 })
    expect(result.ok).toBe(false)
  })
})

describe('approvalRuleLogRepo', () => {
  it('lists log rows, optionally filtered by entityRef', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [logRow()], total: 1 })
    const result = await approvalRuleLogRepo.list({ page: 0, pageSize: 25, entityRef: 'INV-2026-00042' })
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value.rows).toHaveLength(1)
  })
})
