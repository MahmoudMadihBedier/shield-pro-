import { describe, expect, it } from 'vitest'

import { RETURN_STATUSES } from '../schemas'
import { canReturnTransition, RETURN_TRANSITIONS } from '../status-flow'

describe('canReturnTransition', () => {
  it('allows pending → approved and pending → rejected', () => {
    expect(canReturnTransition('pending', 'approved')).toBe(true)
    expect(canReturnTransition('pending', 'rejected')).toBe(true)
  })

  it('rejects any other hop', () => {
    expect(canReturnTransition('approved', 'pending')).toBe(false)
    expect(canReturnTransition('approved', 'rejected')).toBe(false)
    expect(canReturnTransition('rejected', 'approved')).toBe(false)
    expect(canReturnTransition('pending', 'pending')).toBe(false)
  })

  it('has no transition out of a terminal state', () => {
    for (const to of RETURN_STATUSES) {
      expect(canReturnTransition('approved', to)).toBe(false)
      expect(canReturnTransition('rejected', to)).toBe(false)
    }
  })

  it('RETURN_TRANSITIONS is the source of truth', () => {
    expect(RETURN_TRANSITIONS).toHaveLength(2)
  })
})
