import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ok, err } from '@/core/result'
import { appError } from '@/core/errors'

const { check, override } = vi.hoisted(() => ({ check: vi.fn(), override: vi.fn() }))

vi.mock('@/infrastructure/appwrite/functions', () => ({
  checkCustomerCredit: (...a: unknown[]) => check(...a),
  recordCreditOverride: (...a: unknown[]) => override(...a),
}))

const { checkCustomerCredit, recordCreditOverride } = await import('../credit-ops')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('checkCustomerCredit', () => {
  it('passes the customer + amount through', async () => {
    check.mockResolvedValue(
      ok({ ok: false, creditLimit: 1000, outstanding: 0, available: 1000, overBy: 500 }),
    )
    const res = await checkCustomerCredit('c1', 1500)
    expect(check).toHaveBeenCalledWith('c1', 1500)
    expect(res.ok).toBe(true)
    if (res.ok) expect(res.value.overBy).toBe(500)
  })

  it('defaults the amount to 0', async () => {
    check.mockResolvedValue(
      ok({ ok: true, creditLimit: 1000, outstanding: 0, available: 1000, overBy: 0 }),
    )
    await checkCustomerCredit('c1')
    expect(check).toHaveBeenCalledWith('c1', 0)
  })
})

describe('recordCreditOverride', () => {
  it('forwards the invoice ref + reason', async () => {
    override.mockResolvedValue(ok({ ok: true, invoiceRef: 'INV-2026-1' }))
    const res = await recordCreditOverride('INV-2026-1', 'approved by finance')
    expect(override).toHaveBeenCalledWith('INV-2026-1', 'approved by finance')
    expect(res.ok).toBe(true)
  })

  it('propagates a SoD rejection untouched', async () => {
    override.mockResolvedValue(err(appError('forbidden', 'segregation of duties violated')))
    const res = await recordCreditOverride('INV-2026-1', 'x')
    expect(res).toEqual(err(appError('forbidden', 'segregation of duties violated')))
  })
})
