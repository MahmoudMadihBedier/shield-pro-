import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockFetchTrialBalance } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockFetchTrialBalance: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { listRows: mockListRows }, Query }
})
vi.mock('@/infrastructure/appwrite/functions', () => ({
  fetchTrialBalance: (...a: unknown[]) => mockFetchTrialBalance(...a),
}))

import { ok } from '@/core/result'

import { accountBalance, listGlEntries, trialBalanceRows } from '../gl-repo'

function glRow(over: Record<string, unknown> = {}) {
  return {
    $id: 'g1',
    $createdAt: 't',
    $updatedAt: 't',
    voucher_type: 'Receipt',
    voucher_no: 'REC-2026-00001',
    account: 'cash',
    branch_id: null,
    debit: 100,
    credit: 0,
    posting_datetime: '2026-08-01T00:00:00.000Z',
    is_cancelled: false,
    ...over,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockFetchTrialBalance.mockReset()
})

describe('listGlEntries', () => {
  it('builds a filtered, paged, date-bounded query and parses rows', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [glRow(), glRow({ $id: 'g2' })], total: 2 })

    const res = await listGlEntries({
      account: 'cash',
      voucherNo: 'REC-2026-00001',
      branchId: 'br-1',
      from: '2026-08-01T00:00:00.000Z',
      to: '2026-08-31T00:00:00.000Z',
      page: 2,
      pageSize: 10,
    })

    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.rows).toHaveLength(2)

    const queries = ((mockListRows.mock.calls[0]?.[0]?.queries ?? []) as string[]).join(' ')
    expect(queries).toMatch(/account/)
    expect(queries).toMatch(/voucher_no/)
    expect(queries).toMatch(/branch_id/)
    expect(queries).toMatch(/posting_datetime/)
    expect(queries).toMatch(/limit.*10/)
    expect(queries).toMatch(/offset.*20/)
  })

  it('returns a server AppError when a row fails the schema', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [{ $id: 'bad' }], total: 1 })
    const res = await listGlEntries()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('server')
  })

  it('maps an Appwrite failure to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('nope', 403, 'forbidden'))
    const res = await listGlEntries()
    expect(res.ok).toBe(false)
    if (res.ok) return
    expect(res.error.code).toBe('forbidden')
  })
})

describe('trialBalanceRows', () => {
  it('passes the range to the RPC and marks a matched total as balanced', async () => {
    mockFetchTrialBalance.mockResolvedValueOnce(
      ok({
        rows: [
          { account: 'accounts_receivable', debit: 0, credit: 250, balance: -250 },
          { account: 'cash', debit: 250, credit: 0, balance: 250 },
        ],
        totalDebit: 250,
        totalCredit: 250,
      }),
    )
    const res = await trialBalanceRows({ from: '2026-08-01T00:00:00.000Z' })
    expect(mockFetchTrialBalance).toHaveBeenCalledWith('2026-08-01T00:00:00.000Z', null)
    expect(res.ok).toBe(true)
    if (!res.ok) return
    expect(res.value.balanced).toBe(true)
    expect(res.value.totalDebit).toBe(250)
    expect(res.value.rows.map((r) => r.account)).toEqual(['accounts_receivable', 'cash'])
  })

  it('marks an unbalanced total', async () => {
    mockFetchTrialBalance.mockResolvedValueOnce(ok({ rows: [], totalDebit: 100, totalCredit: 90 }))
    const res = await trialBalanceRows()
    expect(res.ok && res.value.balanced).toBe(false)
  })
})

describe('accountBalance', () => {
  it('returns the account balance from the trial balance', async () => {
    mockFetchTrialBalance.mockResolvedValueOnce(
      ok({
        rows: [{ account: 'cash', debit: 250, credit: 90, balance: 160 }],
        totalDebit: 250,
        totalCredit: 90,
      }),
    )
    expect(await accountBalance('cash')).toEqual({ ok: true, value: 160 })
  })

  it('returns ok(0) for an account with no entries', async () => {
    mockFetchTrialBalance.mockResolvedValueOnce(ok({ rows: [], totalDebit: 0, totalCredit: 0 }))
    expect(await accountBalance('bank')).toEqual({ ok: true, value: 0 })
  })
})
