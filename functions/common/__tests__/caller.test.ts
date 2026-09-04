import type { TablesDB } from 'node-appwrite'
import { describe, expect, it, vi } from 'vitest'

import { Role } from '@/core/rbac'
import { loadCallerContext } from '../caller'

function fakeDb(listRows: unknown): TablesDB {
  return { listRows: vi.fn().mockResolvedValue(listRows) } as unknown as TablesDB
}

describe('loadCallerContext', () => {
  it('parses roles and branch from a found profile row', async () => {
    const db = fakeDb({
      total: 1,
      rows: [{ auth_user_id: 'auth-1', roles: 'branch_accountant, sales_rep', branch_id: 'cairo' }],
    })

    const ctx = await loadCallerContext(db, 'auth-1')

    expect(ctx).toEqual({
      userId: 'auth-1',
      roles: [Role.BranchAccountant, Role.SalesRep],
      branchId: 'cairo',
    })
    expect(db.listRows).toHaveBeenCalledWith(
      expect.objectContaining({ databaseId: 'shield_pro', tableId: 'users' }),
    )
  })

  it('returns empty roles + null branch when no profile row exists', async () => {
    const ctx = await loadCallerContext(fakeDb({ total: 0, rows: [] }), 'ghost')
    expect(ctx).toEqual({ userId: 'ghost', roles: [], branchId: null })
  })

  it('tolerates a malformed / whitespace roles string and unknown slugs', async () => {
    const db = fakeDb({
      rows: [{ auth_user_id: 'auth-2', roles: '  ,, not_a_role   system_admin , ', branch_id: '' }],
    })
    const ctx = await loadCallerContext(db, 'auth-2')
    expect(ctx.roles).toEqual([Role.SystemAdmin])
    expect(ctx.branchId).toBeNull()
  })

  it('treats a missing roles column as no roles', async () => {
    const db = fakeDb({ rows: [{ auth_user_id: 'auth-3', branch_id: 'giza' }] })
    const ctx = await loadCallerContext(db, 'auth-3')
    expect(ctx).toEqual({ userId: 'auth-3', roles: [], branchId: 'giza' })
  })
})
