import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockGetRow, mockCreateRow, mockUpdateRow, mockAllocateReferenceId } = vi.hoisted(
  () => ({
    mockListRows: vi.fn(),
    mockGetRow: vi.fn(),
    mockCreateRow: vi.fn(),
    mockUpdateRow: vi.fn(),
    mockAllocateReferenceId: vi.fn(),
  }),
)

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
vi.mock('@/infrastructure/appwrite/functions', () => ({
  allocateReferenceId: mockAllocateReferenceId,
  submitDocument: vi.fn(),
  cancelDocument: vi.fn(),
}))

import { ok } from '@/core/result'

import { payrollRunsRepo } from '../payroll-repo'

function payrollRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'pay-1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'PAY-2026-00001',
    doc_status: 0,
    branch_id: null,
    created_by: 'u1',
    amended_from: null,
    posting_datetime: '2026-08-01T00:00:00.000Z',
    remarks: null,
    pay_period_start: '2026-08-01',
    pay_period_end: '2026-08-31',
    lines: '[]',
    total_net_pay: 0,
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockGetRow.mockReset()
  mockCreateRow.mockReset()
  mockUpdateRow.mockReset()
  mockAllocateReferenceId.mockReset()
})

describe('payrollRunsRepo', () => {
  it('is wired to the payroll_runs table and PayrollRun entity', () => {
    expect(payrollRunsRepo.entity).toBe('PayrollRun')
    expect(payrollRunsRepo.table).toBe('payroll_runs')
  })

  it('createDraft allocates a reference id and writes the envelope + fields', async () => {
    mockAllocateReferenceId.mockResolvedValueOnce(
      ok({ referenceId: 'PAY-2026-00001', prefix: 'PAY', year: 2026, sequence: 1 }),
    )
    mockCreateRow.mockResolvedValueOnce(payrollRow())

    const result = await payrollRunsRepo.createDraft(
      {
        pay_period_start: '2026-08-01',
        pay_period_end: '2026-08-31',
        lines: '[]',
        total_net_pay: 0,
      },
      { userId: 'u1', branchId: null },
    )

    expect(result.ok).toBe(true)
    expect(mockCreateRow).toHaveBeenCalledTimes(1)
    const payload = mockCreateRow.mock.calls[0]?.[0]?.data as Record<string, unknown>
    expect(payload.reference_id).toBe('PAY-2026-00001')
    expect(payload.doc_status).toBe(0)
    expect(payload.created_by).toBe('u1')
    expect(payload.pay_period_start).toBe('2026-08-01')
  })

  it('list parses payroll rows and returns the total', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [payrollRow()], total: 1 })
    const result = await payrollRunsRepo.list({ page: 0, pageSize: 25 })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.rows).toHaveLength(1)
    expect(result.value.total).toBe(1)
  })

  it('fails with a server AppError when a row does not match the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const result = await payrollRunsRepo.list()
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})
