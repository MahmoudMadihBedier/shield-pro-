import { describe, expect, it } from 'vitest'

import { buildPrincipal, rolesFromTeamIds } from '../principal'
import { Role } from '../rbac'

describe('rolesFromTeamIds', () => {
  it('keeps only known role slugs and dedupes', () => {
    expect(rolesFromTeamIds(['sales_rep', 'not_a_role', 'sales_rep', 'system_admin'])).toEqual([
      Role.SalesRep,
      Role.SystemAdmin,
    ])
  })

  it('returns an empty list when no team maps to a role', () => {
    expect(rolesFromTeamIds(['random', 'other'])).toEqual([])
  })
})

describe('buildPrincipal', () => {
  it('maps identity facts into a Principal', () => {
    expect(
      buildPrincipal({
        userId: 'u1',
        teamIds: ['branch_accountant', 'ignored'],
        branchId: 'cairo',
      }),
    ).toEqual({
      userId: 'u1',
      roles: [Role.BranchAccountant],
      branchId: 'cairo',
    })
  })

  it('normalises a missing branch to null', () => {
    expect(buildPrincipal({ userId: 'u2', teamIds: [] }).branchId).toBeNull()
  })
})
