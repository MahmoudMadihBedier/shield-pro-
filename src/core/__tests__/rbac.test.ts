import { describe, expect, it } from 'vitest'

import { canSeeBranch, hasGlobalScope, isOwnerOrAdmin, Role, type Principal } from '../rbac'

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

describe('isOwnerOrAdmin', () => {
  it('is true for the System Admin regardless of the ids given', () => {
    expect(isOwnerOrAdmin(admin, 'someone-else')).toBe(true)
    expect(isOwnerOrAdmin(admin)).toBe(true)
  })

  it('is true when the principal matches any of the given owner ids', () => {
    expect(isOwnerOrAdmin(rep, 'u1')).toBe(true)
    expect(isOwnerOrAdmin(rep, 'other', 'u1')).toBe(true)
  })

  it('is false when the principal matches none of the ids, or is null', () => {
    expect(isOwnerOrAdmin(rep, 'other')).toBe(false)
    expect(isOwnerOrAdmin(rep, null, undefined)).toBe(false)
    expect(isOwnerOrAdmin(null, 'u1')).toBe(false)
  })
})
