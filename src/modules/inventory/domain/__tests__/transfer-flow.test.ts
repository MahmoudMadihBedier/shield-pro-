import { describe, expect, it } from 'vitest'

import { TRANSFER_STATUSES, type TransferStatus } from '../schemas'
import { canTransferTransition, nextActor, TRANSFER_TRANSITIONS } from '../transfer-flow'

describe('canTransferTransition', () => {
  it('allows exactly the four workflow hops', () => {
    expect(canTransferTransition('pending', 'approved')).toBe(true)
    expect(canTransferTransition('pending', 'rejected')).toBe(true)
    expect(canTransferTransition('approved', 'executed')).toBe(true)
    expect(canTransferTransition('executed', 'received')).toBe(true)
  })

  it('rejects skips, reversals and no-ops', () => {
    expect(canTransferTransition('pending', 'executed')).toBe(false)
    expect(canTransferTransition('pending', 'received')).toBe(false)
    expect(canTransferTransition('approved', 'pending')).toBe(false)
    expect(canTransferTransition('approved', 'rejected')).toBe(false)
    expect(canTransferTransition('executed', 'approved')).toBe(false)
    expect(canTransferTransition('received', 'received')).toBe(false)
    expect(canTransferTransition('rejected', 'approved')).toBe(false)
  })

  it('has no transition out of a terminal state', () => {
    for (const to of TRANSFER_STATUSES) {
      expect(canTransferTransition('received', to)).toBe(false)
      expect(canTransferTransition('rejected', to)).toBe(false)
    }
  })

  it('TRANSFER_TRANSITIONS is the source of truth', () => {
    expect(TRANSFER_TRANSITIONS).toHaveLength(4)
  })
})

describe('nextActor', () => {
  const expected: Record<TransferStatus, ReturnType<typeof nextActor>> = {
    pending: 'approver',
    approved: 'sender',
    executed: 'receiver',
    received: null,
    rejected: null,
  }

  for (const status of TRANSFER_STATUSES) {
    it(`maps ${status} → ${String(expected[status])}`, () => {
      expect(nextActor(status)).toBe(expected[status])
    })
  }
})
