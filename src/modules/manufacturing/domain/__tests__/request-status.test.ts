import { describe, expect, it } from 'vitest'

import { canRequestTransition, REQUEST_TRANSITIONS } from '../request-status'

describe('REQUEST_TRANSITIONS', () => {
  it('is the approve/reject/issue edge set', () => {
    expect(REQUEST_TRANSITIONS).toEqual([
      ['pending', 'approved'],
      ['pending', 'rejected'],
      ['approved', 'issued'],
    ])
  })
})

describe('canRequestTransition', () => {
  it('allows pending → approved', () => {
    expect(canRequestTransition('pending', 'approved')).toBe(true)
  })

  it('allows pending → rejected', () => {
    expect(canRequestTransition('pending', 'rejected')).toBe(true)
  })

  it('allows approved → issued', () => {
    expect(canRequestTransition('approved', 'issued')).toBe(true)
  })

  it('rejects pending → issued (must be approved first)', () => {
    expect(canRequestTransition('pending', 'issued')).toBe(false)
  })

  it('rejects approved → rejected', () => {
    expect(canRequestTransition('approved', 'rejected')).toBe(false)
  })

  it('rejects issued → approved', () => {
    expect(canRequestTransition('issued', 'approved')).toBe(false)
  })
})
