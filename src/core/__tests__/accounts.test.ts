import { describe, expect, it } from 'vitest'

import { ACCOUNT_TYPES, CASH_LIKE_ACCOUNTS, GlAccount, SEEDED_ACCOUNT_TYPE } from '../accounts'

describe('GlAccount', () => {
  it('every id is a unique, non-empty string', () => {
    const ids = Object.values(GlAccount)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(id.length).toBeGreaterThan(0)
  })

  it('every account has a seeded type from the fixed ACCOUNT_TYPES set', () => {
    for (const id of Object.values(GlAccount)) {
      expect(SEEDED_ACCOUNT_TYPE[id]).toBeDefined()
      expect(ACCOUNT_TYPES).toContain(SEEDED_ACCOUNT_TYPE[id])
    }
  })

  it('cash-like accounts are all asset-typed', () => {
    for (const id of CASH_LIKE_ACCOUNTS) {
      expect(SEEDED_ACCOUNT_TYPE[id]).toBe('asset')
    }
  })
})
