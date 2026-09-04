import { describe, expect, it, vi } from 'vitest'

const { mockEvaluateApproval, mockDecideApprovalRequest } = vi.hoisted(() => ({
  mockEvaluateApproval: vi.fn(),
  mockDecideApprovalRequest: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/functions', () => ({
  evaluateApproval: mockEvaluateApproval,
  decideApprovalRequest: mockDecideApprovalRequest,
}))

import { decideApprovalRequest, evaluateApproval } from '../decisions'

describe('evaluateApproval', () => {
  it('forwards the payload to the infrastructure client', async () => {
    mockEvaluateApproval.mockResolvedValueOnce({
      ok: true,
      value: { action: 'auto_approve', ruleId: 'rule-1', approvalRequestId: 'req-1' },
    })

    const payload = { movementType: 'sales_invoices', entityRef: 'INV-1', context: {} }
    const result = await evaluateApproval(payload)

    expect(mockEvaluateApproval).toHaveBeenCalledWith(payload)
    expect(result.ok).toBe(true)
  })
})

describe('decideApprovalRequest', () => {
  it('forwards the payload to the infrastructure client', async () => {
    mockDecideApprovalRequest.mockResolvedValueOnce({
      ok: true,
      value: {
        $id: 'req-1',
        entityType: 'sales_invoices',
        entityRef: 'INV-1',
        branchId: null,
        requestedBy: 'user-1',
        state: 'approved',
        decidedBy: 'user-2',
        decisionReason: null,
      },
    })

    const payload = { approvalRequestId: 'req-1', decision: 'approved' as const }
    const result = await decideApprovalRequest(payload)

    expect(mockDecideApprovalRequest).toHaveBeenCalledWith(payload)
    expect(result.ok).toBe(true)
  })
})
