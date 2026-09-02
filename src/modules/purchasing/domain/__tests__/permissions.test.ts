import { describe, expect, it } from 'vitest'

import { Role } from '@/core/rbac'

import { canActOnPurchasing } from '../permissions'

const principal = (roles: Role[]) => ({ userId: 'u1', roles })

describe('canActOnPurchasing', () => {
  it('allows the purchasing accountant, raw-store keeper and system admin', () => {
    expect(canActOnPurchasing(principal([Role.PurchasingAccountant]))).toBe(true)
    expect(canActOnPurchasing(principal([Role.RawStoreKeeper]))).toBe(true)
    expect(canActOnPurchasing(principal([Role.SystemAdmin]))).toBe(true)
  })

  it('denies an unrelated role and a signed-out caller', () => {
    expect(canActOnPurchasing(principal([Role.SalesRep]))).toBe(false)
    expect(canActOnPurchasing(null)).toBe(false)
    expect(canActOnPurchasing(undefined)).toBe(false)
  })
})
