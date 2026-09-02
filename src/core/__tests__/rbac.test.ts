import { describe, expect, it } from 'vitest'

import { canSeeBranch, hasGlobalScope, Role, type Principal } from '../rbac'

const rep: Principal = {
  userId: 'u1',
  roles: [Role.SalesRep],
  branchId: 'cairo',
}

const admin: Principal = { userId: 'u2', roles: [Role.SystemAdmin] }

describe('branch-scoped visibility', () => {
  it('global-scope roles see every branch', () => {
    expect(hasGlobalScope(admin)).toBe(true)
    expect(canSeeBranch(admin, 'cairo')).toBe(true)
    expect(canSeeBranch(admin, 'alex')).toBe(true)
  })

  it('a branch-scoped rep sees only their own branch', () => {
    expect(hasGlobalScope(rep)).toBe(false)
    expect(canSeeBranch(rep, 'cairo')).toBe(true)
    expect(canSeeBranch(rep, 'alex')).toBe(false)
  })

  it('a scoped user with no branch sees nothing', () => {
    const unbound: Principal = { userId: 'u3', roles: [Role.BranchAccountant] }
    expect(canSeeBranch(unbound, 'cairo')).toBe(false)
  })
})
