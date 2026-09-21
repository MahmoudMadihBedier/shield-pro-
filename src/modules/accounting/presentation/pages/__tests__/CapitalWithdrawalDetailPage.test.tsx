import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockGetRow, mockEvaluateApproval, mockSubmitDocument, mockPostGl } = vi.hoisted(() => ({
  mockGetRow: vi.fn(),
  mockEvaluateApproval: vi.fn(),
  mockSubmitDocument: vi.fn(),
  mockPostGl: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/appwrite/functions')>()
  return {
    ...actual,
    evaluateApproval: mockEvaluateApproval,
    submitDocument: mockSubmitDocument,
    postGl: mockPostGl,
  }
})

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query, ID } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { getRow: mockGetRow }, Query, ID }
})

import { AuthContext, type AuthContextValue } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import { Role } from '@/core/rbac'
import { ok } from '@/core/result'

import { CapitalWithdrawalDetailPage } from '../CapitalWithdrawalDetailPage'

const PRINCIPAL: AuthContextValue['principal'] = {
  userId: 'acct-1',
  roles: [Role.ChiefAccountant],
  branchId: null,
}

function draftRow() {
  return {
    $id: 'w1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'CAPW-2026-00001',
    doc_status: DocStatus.Draft,
    branch_id: null,
    created_by: 'acct-1',
    amended_from: null,
    posting_datetime: '2026-09-21T00:00:00.000Z',
    remarks: null,
    withdrawn_by: 'المالك',
    method: 'cash',
    reason: 'سحب شخصي',
    amount: 1000,
    source_account: 'cash',
  }
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const authValue: AuthContextValue = {
    principal: PRINCIPAL,
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/accounting/capital-withdrawals/w1']}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route
              path="/accounting/capital-withdrawals/:id"
              element={<CapitalWithdrawalDetailPage />}
            />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockGetRow.mockReset()
  mockEvaluateApproval.mockReset()
  mockSubmitDocument.mockReset()
  mockPostGl.mockReset()
})

describe('CapitalWithdrawalDetailPage', () => {
  it('shows the withdrawal envelope and a Submit button for a draft', async () => {
    mockGetRow.mockResolvedValue(draftRow())
    renderPage()

    expect(await screen.findByText('المالك')).toBeInTheDocument()
    expect(screen.getByText('cash')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /اعتماد المستند/ })).toBeInTheDocument()
  })

  it('submitting a draft calls evaluate_approval then submit_document with this table/id', async () => {
    mockGetRow.mockResolvedValue(draftRow())
    mockEvaluateApproval.mockResolvedValue(ok({ action: 'auto_approve', ruleId: null }))
    mockSubmitDocument.mockResolvedValue(
      ok({ referenceId: 'CAPW-2026-00001', docStatus: DocStatus.Submitted }),
    )

    renderPage()
    await screen.findByRole('button', { name: /اعتماد المستند/ })

    await userEvent.click(screen.getByRole('button', { name: /اعتماد المستند/ }))

    await vi.waitFor(() =>
      expect(mockEvaluateApproval).toHaveBeenCalledWith(
        expect.objectContaining({
          movementType: 'capital_withdrawals',
          entityRef: 'CAPW-2026-00001',
        }),
      ),
    )
    await vi.waitFor(() =>
      expect(mockSubmitDocument).toHaveBeenCalledWith('capital_withdrawals', 'w1'),
    )
  })

  it('posts a submitted withdrawal to the GL with Dr owners_drawings / Cr the source account', async () => {
    mockGetRow.mockResolvedValue({ ...draftRow(), doc_status: DocStatus.Submitted })
    mockPostGl.mockResolvedValue(ok({ voucherNo: 'CAPW-2026-00001', entries: 2 }))

    renderPage()

    const postButton = await screen.findByRole('button', { name: /ترحيل إلى دفتر الأستاذ/ })
    await userEvent.click(postButton)

    await vi.waitFor(() =>
      expect(mockPostGl).toHaveBeenCalledWith(
        expect.objectContaining({
          voucherType: 'CapitalWithdrawal',
          voucherNo: 'CAPW-2026-00001',
          lines: [
            { account: 'owners_drawings', debit: 1000, credit: 0 },
            { account: 'cash', debit: 0, credit: 1000 },
          ],
        }),
      ),
    )
    expect(await screen.findByText(/تم ترحيل 2 قيد/)).toBeInTheDocument()
  })
})
