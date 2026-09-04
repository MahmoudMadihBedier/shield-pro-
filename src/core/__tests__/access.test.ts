import { describe, expect, it } from 'vitest'

import { SUBMIT_ROLE_BY_TABLE, canActOnBranch, canSubmitTable } from '../access'
import { Role, type Principal } from '../rbac'

function principal(over: Partial<Principal> = {}): Principal {
  return { userId: 'u1', roles: [Role.SalesRep], branchId: 'cairo', ...over }
}

describe('canActOnBranch', () => {
  it('allows when the principal is bound to the same branch', () => {
    expect(canActOnBranch(principal({ branchId: 'cairo' }), 'cairo')).toBe(true)
  })

  it('denies when the principal is bound to a different branch', () => {
    expect(canActOnBranch(principal({ branchId: 'cairo' }), 'giza')).toBe(false)
  })

  it('denies a branch-scoped principal with no branch binding', () => {
    expect(canActOnBranch(principal({ branchId: null }), 'cairo')).toBe(false)
  })

  it('allows any principal when the document has no branch', () => {
    expect(canActOnBranch(principal({ branchId: 'cairo' }), null)).toBe(true)
    expect(canActOnBranch(principal({ branchId: null }), undefined)).toBe(true)
    expect(canActOnBranch(principal({ branchId: 'cairo' }), '')).toBe(true)
  })

  it('allows a global-scope role on any branch', () => {
    const admin = principal({ roles: [Role.SystemAdmin], branchId: null })
    expect(canActOnBranch(admin, 'giza')).toBe(true)
    const chief = principal({ roles: [Role.ChiefAccountant], branchId: 'cairo' })
    expect(canActOnBranch(chief, 'giza')).toBe(true)
  })
})

describe('canSubmitTable', () => {
  it('allows a role listed for the table', () => {
    expect(canSubmitTable([Role.SalesRep], 'sales_invoices')).toBe(true)
    expect(canSubmitTable([Role.PurchasingAccountant], 'purchase_orders')).toBe(true)
  })

  it('denies a role not listed for the table', () => {
    expect(canSubmitTable([Role.SalesRep], 'purchase_orders')).toBe(false)
    expect(canSubmitTable([Role.RawStoreKeeper], 'sales_invoices')).toBe(false)
  })

  it('always allows System Admin, even for a table with no explicit entry', () => {
    expect(canSubmitTable([Role.SystemAdmin], 'sales_invoices')).toBe(true)
    expect(canSubmitTable([Role.SystemAdmin], 'purchase_orders')).toBe(true)
  })

  it('denies an unknown table', () => {
    expect(canSubmitTable([Role.SalesRep], 'branches')).toBe(false)
  })

  it('denies when the caller has no roles', () => {
    expect(canSubmitTable([], 'sales_invoices')).toBe(false)
  })

  it('covers every submittable table in the mapping', () => {
    for (const table of Object.keys(SUBMIT_ROLE_BY_TABLE)) {
      expect(SUBMIT_ROLE_BY_TABLE[table as keyof typeof SUBMIT_ROLE_BY_TABLE]).toBeDefined()
    }
  })
})
