import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok, err } from '@/core/result'
import { appError } from '@/core/errors'

const { buildExpected, confirm } = vi.hoisted(() => ({
  buildExpected: vi.fn(),
  confirm: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/functions', () => ({
  buildRepCloseoutExpected: (...a: unknown[]) => buildExpected(...a),
  confirmRepCloseout: (...a: unknown[]) => confirm(...a),
}))

const { buildCloseoutExpected, confirmCloseout } = await import('../closeout-ops')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('buildCloseoutExpected', () => {
  it('passes the rep + date through and returns the validated bag', async () => {
    const bag = {
      products: [{ product_id: 'p1', issued: 10, sold: 6, returned: 1, remaining: 3 }],
      cash: [{ method: 'cash', amount: 600 }],
    }
    buildExpected.mockResolvedValue(ok(bag))

    const res = await buildCloseoutExpected('rep-1', '2026-09-06')

    expect(buildExpected).toHaveBeenCalledWith('rep-1', '2026-09-06')
    expect(res).toEqual(ok(bag))
  })

  it('maps a malformed server bag to a server AppError', async () => {
    buildExpected.mockResolvedValue(ok({ products: 'nope' }))
    const res = await buildCloseoutExpected('rep-1', '2026-09-06')
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.error.code).toBe('server')
  })

  it('propagates an RPC failure untouched', async () => {
    buildExpected.mockResolvedValue(err(appError('forbidden', 'nope')))
    const res = await buildCloseoutExpected('rep-1', '2026-09-06')
    expect(res).toEqual(err(appError('forbidden', 'nope')))
  })
})

describe('confirmCloseout', () => {
  it('delegates to the confirm RPC with the row id', async () => {
    confirm.mockResolvedValue(
      ok({ status: 'flagged', stockVariance: -1, cashVariance: -50, flags: ['stock:p1:-1'] }),
    )
    const res = await confirmCloseout('co-1')
    expect(confirm).toHaveBeenCalledWith('co-1')
    expect(res.ok).toBe(true)
  })
})
