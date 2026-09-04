import { describe, expect, it } from 'vitest'

import { canQcTransition, isTransferable, QC_TRANSITIONS } from '../qc'

describe('QC_TRANSITIONS', () => {
  it('is exactly the two release/reject edges out of pending_qc', () => {
    expect(QC_TRANSITIONS).toEqual([
      ['pending_qc', 'released'],
      ['pending_qc', 'rejected'],
    ])
  })
})

describe('canQcTransition', () => {
  it('allows pending_qc → released', () => {
    expect(canQcTransition('pending_qc', 'released')).toBe(true)
  })

  it('allows pending_qc → rejected', () => {
    expect(canQcTransition('pending_qc', 'rejected')).toBe(true)
  })

  it('rejects released → pending_qc', () => {
    expect(canQcTransition('released', 'pending_qc')).toBe(false)
  })

  it('rejects released → rejected', () => {
    expect(canQcTransition('released', 'rejected')).toBe(false)
  })

  it('rejects a no-op pending_qc → pending_qc', () => {
    expect(canQcTransition('pending_qc', 'pending_qc')).toBe(false)
  })
})

describe('isTransferable', () => {
  it('is true only for released', () => {
    expect(isTransferable('released')).toBe(true)
  })

  it('is false for pending_qc', () => {
    expect(isTransferable('pending_qc')).toBe(false)
  })

  it('is false for rejected', () => {
    expect(isTransferable('rejected')).toBe(false)
  })
})
