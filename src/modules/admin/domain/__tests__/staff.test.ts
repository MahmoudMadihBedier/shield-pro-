import { describe, expect, it } from 'vitest'

import { parseRoles, serializeRoles } from '@/core/rbac'

import { staffCreateSchema, staffUpdateSchema } from '../staff'

const validCreate = {
  full_name: 'أحمد علي',
  email: 'Ahmed@Shieldpro.local',
  password: 'secret12',
  roles: ['sales_rep'],
  branch_id: 'br-1',
}

describe('staffCreateSchema', () => {
  it('accepts a valid account and lower-cases the email', () => {
    const parsed = staffCreateSchema.parse(validCreate)
    expect(parsed.email).toBe('ahmed@shieldpro.local')
    expect(parsed.roles).toEqual(['sales_rep'])
  })

  it('rejects a short password, a bad email and an empty role list', () => {
    expect(staffCreateSchema.safeParse({ ...validCreate, password: 'short' }).success).toBe(false)
    expect(staffCreateSchema.safeParse({ ...validCreate, email: 'not-an-email' }).success).toBe(
      false,
    )
    expect(staffCreateSchema.safeParse({ ...validCreate, roles: [] }).success).toBe(false)
    expect(staffCreateSchema.safeParse({ ...validCreate, roles: ['wizard'] }).success).toBe(false)
  })

  it('allows multiple roles', () => {
    expect(
      staffCreateSchema.parse({ ...validCreate, roles: ['sales_rep', 'branch_accountant'] }).roles,
    ).toHaveLength(2)
  })
})

describe('staffUpdateSchema', () => {
  it('accepts a blank email (keep current) or a valid one', () => {
    const base = { full_name: 'x', roles: ['chief_accountant'], is_active: true }
    expect(staffUpdateSchema.safeParse({ ...base, email: '' }).success).toBe(true)
    expect(staffUpdateSchema.safeParse({ ...base, email: 'new@example.com' }).success).toBe(true)
    expect(staffUpdateSchema.safeParse({ ...base, email: 'bad' }).success).toBe(false)
  })

  it('requires is_active and keeps at least one role', () => {
    expect(
      staffUpdateSchema.safeParse({
        full_name: 'x',
        email: 'x@example.com',
        roles: ['chief_accountant'],
        is_active: true,
      }).success,
    ).toBe(true)
    expect(
      staffUpdateSchema.safeParse({
        full_name: 'x',
        email: 'x@example.com',
        roles: [],
        is_active: true,
      }).success,
    ).toBe(false)
  })
})

describe('role slug string round-trip', () => {
  it('parses / serialises and drops unknown slugs', () => {
    expect(parseRoles('sales_rep  branch_accountant, wizard')).toEqual([
      'sales_rep',
      'branch_accountant',
    ])
    expect(serializeRoles(['sales_rep', 'sales_rep', 'chief_accountant'])).toBe(
      'sales_rep chief_accountant',
    )
    expect(parseRoles(null)).toEqual([])
  })
})
