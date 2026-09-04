import { describe, expect, it } from 'vitest'

import { fraudFlagRowSchema } from '../schemas'

const VALID_ROW = {
  $id: 'flag-1',
  $createdAt: '2026-09-01T09:00:00.000Z',
  $updatedAt: '2026-09-01T09:00:00.000Z',
  kind: 'round_tripping',
  subject_type: 'product_warehouse',
  subject_id: 'p1:wh1',
  detail: 'round-tripped stock',
  status: 'open',
  created_at: '2026-09-01T09:00:00.000Z',
}

describe('fraudFlagRowSchema', () => {
  it('accepts a well-formed row', () => {
    expect(fraudFlagRowSchema.safeParse(VALID_ROW).success).toBe(true)
  })

  it('accepts a row with a null detail', () => {
    expect(fraudFlagRowSchema.safeParse({ ...VALID_ROW, detail: null }).success).toBe(true)
  })

  it('rejects an unknown kind', () => {
    const result = fraudFlagRowSchema.safeParse({ ...VALID_ROW, kind: 'made_up' })
    expect(result.success).toBe(false)
  })

  it('rejects an unknown status', () => {
    const result = fraudFlagRowSchema.safeParse({ ...VALID_ROW, status: 'made_up' })
    expect(result.success).toBe(false)
  })
})
