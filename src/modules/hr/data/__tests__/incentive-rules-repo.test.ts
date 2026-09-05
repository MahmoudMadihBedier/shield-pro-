import { AppwriteException } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockCreateRow, mockUpdateRow, mockDeleteRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockCreateRow: vi.fn(),
  mockUpdateRow: vi.fn(),
  mockDeleteRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return {
    Query,
    ID: { unique: () => 'generated-id' },
    tablesDB: {
      listRows: mockListRows,
      createRow: mockCreateRow,
      updateRow: mockUpdateRow,
      deleteRow: mockDeleteRow,
    },
  }
})

import { incentiveRulesRepo } from '../incentive-rules-repo'

function ruleRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'r1',
    $createdAt: 't',
    $updatedAt: 't',
    name: 'مكافأة حضور',
    kind: 'attendance_bonus',
    predicate: '{"minAttendanceDays":20,"flatAmount":300}',
    amount_or_pct: 300,
    is_active: true,
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockCreateRow.mockReset()
  mockUpdateRow.mockReset()
  mockDeleteRow.mockReset()
})

describe('incentiveRulesRepo.list', () => {
  it('parses rows and returns the total', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [ruleRow()], total: 1 })
    const result = await incentiveRulesRepo.list({ page: 0, pageSize: 25 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(1)
    expect(result.value.total).toBe(1)
  })
})

describe('incentiveRulesRepo.create', () => {
  it('writes the validated input payload', async () => {
    mockCreateRow.mockResolvedValueOnce(ruleRow())
    const result = await incentiveRulesRepo.create({
      name: 'مكافأة حضور',
      kind: 'attendance_bonus',
      predicate: '{"minAttendanceDays":20,"flatAmount":300}',
      amount_or_pct: 300,
      is_active: true,
    })
    expect(result.ok).toBe(true)
    expect(mockCreateRow).toHaveBeenCalledTimes(1)
    const payload = mockCreateRow.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(payload.kind).toBe('attendance_bonus')
    expect(payload.amount_or_pct).toBe(300)
  })

  it('rejects an invalid payload before calling Appwrite', async () => {
    const result = await incentiveRulesRepo.create({
      name: '',
      kind: 'attendance_bonus',
      amount_or_pct: -1,
      is_active: true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
    expect(mockCreateRow).not.toHaveBeenCalled()
  })
})

describe('incentiveRulesRepo.update', () => {
  it('writes a partial patch', async () => {
    mockUpdateRow.mockResolvedValueOnce(ruleRow({ is_active: false }))
    const result = await incentiveRulesRepo.update('r1', { is_active: false })
    expect(result.ok).toBe(true)
    expect(mockUpdateRow.mock.calls[0]?.[0]?.data).toEqual({ is_active: false })
  })
})

describe('incentiveRulesRepo.remove', () => {
  it('deletes the row', async () => {
    mockDeleteRow.mockResolvedValueOnce(undefined)
    const result = await incentiveRulesRepo.remove('r1')
    expect(result.ok).toBe(true)
    expect(mockDeleteRow).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 'incentive_rules', rowId: 'r1' }),
    )
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockDeleteRow.mockRejectedValueOnce(new AppwriteException('nope', 403, 'forbidden'))
    const result = await incentiveRulesRepo.remove('r1')
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('forbidden')
  })
})
