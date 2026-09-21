import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockGetRow,
  mockCreateRow,
  mockUpdateRow,
  mockEvaluateApproval,
  mockSubmitDocument,
  mockCancelDocument,
  mockAllocateReferenceId,
  mockPostGl,
  mockReverseGl,
  mockNavigate,
} = vi.hoisted(() => ({
  mockGetRow: vi.fn(),
  mockCreateRow: vi.fn(),
  mockUpdateRow: vi.fn(),
  mockEvaluateApproval: vi.fn(),
  mockSubmitDocument: vi.fn(),
  mockCancelDocument: vi.fn(),
  mockAllocateReferenceId: vi.fn(),
  mockPostGl: vi.fn(),
  mockReverseGl: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('@/infrastructure/appwrite/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/appwrite/functions')>()
  return {
    ...actual,
    evaluateApproval: mockEvaluateApproval,
    submitDocument: mockSubmitDocument,
    cancelDocument: mockCancelDocument,
    allocateReferenceId: mockAllocateReferenceId,
    postGl: mockPostGl,
    reverseGl: mockReverseGl,
  }
})

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query, ID } = await import('@/infrastructure/appwrite/testing')
  return {
    tablesDB: { getRow: mockGetRow, createRow: mockCreateRow, updateRow: mockUpdateRow },
    Query,
    ID,
  }
})

import { AuthContext, type AuthContextValue } from '@/application/auth/context'
import { DocStatus } from '@/core/doc-status'
import { Role } from '@/core/rbac'
import { ok } from '@/core/result'

import { CapitalContributionDetailPage } from '../CapitalContributionDetailPage'

const PRINCIPAL: AuthContextValue['principal'] = {
  userId: 'acct-1',
  roles: [Role.ChiefAccountant],
  branchId: null,
}

function contributionRow() {
  return {
    $id: 'c1',
    $createdAt: 't',
    $updatedAt: 't',
    reference_id: 'CAP-2026-00001',
    doc_status: DocStatus.Draft,
    branch_id: null,
    created_by: 'acct-1',
    amended_from: null,
    posting_datetime: '2026-09-21T00:00:00.000Z',
    remarks: null,
    contributor: 'المالك',
    asset_type: 'cash' as const,
    description: 'رأس مال أولي',
    amount: 5000,
    asset_account: 'cash',
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
      <MemoryRouter initialEntries={['/accounting/capital/c1']}>
        <AuthContext.Provider value={authValue}>
          <Routes>
            <Route path="/accounting/capital/:id" element={<CapitalContributionDetailPage />} />
          </Routes>
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockGetRow.mockReset()
  mockCreateRow.mockReset()
  mockUpdateRow.mockReset()
  mockEvaluateApproval.mockReset()
  mockSubmitDocument.mockReset()
  mockCancelDocument.mockReset()
  mockAllocateReferenceId.mockReset()
  mockPostGl.mockReset()
  mockReverseGl.mockReset()
  mockNavigate.mockReset()
})

describe('CapitalContributionDetailPage', () => {
  it('shows an Edit button for a Draft and updates it in place via updateDraft', async () => {
    mockGetRow.mockResolvedValue(contributionRow())
    mockUpdateRow.mockResolvedValue({ ...contributionRow(), amount: 9000 })

    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'تعديل' }))

    const amountField = await screen.findByLabelText(/القيمة/)
    expect(amountField).toHaveValue(5000)

    await userEvent.clear(amountField)
    await userEvent.type(amountField, '9000')
    await userEvent.click(screen.getByRole('button', { name: 'حفظ' }))

    await vi.waitFor(() => expect(mockUpdateRow).toHaveBeenCalledTimes(1))
    const call = mockUpdateRow.mock.calls[0]![0] as { rowId: string; data: Record<string, unknown> }
    expect(call.rowId).toBe('c1')
    expect(call.data).toMatchObject({ amount: 9000 })
  })

  it('amending CAP-2026-00001 reverses its posted GL entries, cancels it, and creates a linked corrected draft', async () => {
    mockGetRow.mockResolvedValue({ ...contributionRow(), doc_status: DocStatus.Submitted })
    mockReverseGl.mockResolvedValue(ok({ voucherNo: 'CAP-2026-00001', reversed: 2 }))
    mockCancelDocument.mockResolvedValue(
      ok({ referenceId: 'CAP-2026-00001', docStatus: DocStatus.Cancelled }),
    )
    mockAllocateReferenceId.mockResolvedValue(
      ok({ referenceId: 'CAP-2026-00002', prefix: 'CAP', year: 2026, sequence: 2 }),
    )
    mockCreateRow.mockResolvedValue({
      ...contributionRow(),
      $id: 'c2',
      reference_id: 'CAP-2026-00002',
      doc_status: DocStatus.Draft,
      amended_from: 'CAP-2026-00001',
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Amend/ }))
    await userEvent.type(screen.getByLabelText(/سبب التعديل/), 'المبلغ كان خاطئًا')
    await userEvent.click(screen.getByRole('button', { name: 'تأكيد التعديل' }))

    await vi.waitFor(() =>
      expect(mockReverseGl).toHaveBeenCalledWith('CAP-2026-00001', 'المبلغ كان خاطئًا'),
    )
    await vi.waitFor(() =>
      expect(mockCancelDocument).toHaveBeenCalledWith(
        'capital_contributions',
        'c1',
        'المبلغ كان خاطئًا',
      ),
    )
    await vi.waitFor(() => expect(mockAllocateReferenceId).toHaveBeenCalled())
    await vi.waitFor(() => expect(mockCreateRow).toHaveBeenCalledTimes(1))
    const created = mockCreateRow.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(created.data).toMatchObject({
      amended_from: 'CAP-2026-00001',
      amount: 5000,
      asset_type: 'cash',
      asset_account: 'cash',
    })
    await vi.waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/accounting/capital/c2'))
  })

  it('a Cancelled contribution can still be amended without re-reversing an already-neutral GL', async () => {
    mockGetRow.mockResolvedValue({ ...contributionRow(), doc_status: DocStatus.Cancelled })
    mockReverseGl.mockResolvedValue(ok({ voucherNo: 'CAP-2026-00001', reversed: 0 }))
    mockAllocateReferenceId.mockResolvedValue(
      ok({ referenceId: 'CAP-2026-00002', prefix: 'CAP', year: 2026, sequence: 2 }),
    )
    mockCreateRow.mockResolvedValue({
      ...contributionRow(),
      $id: 'c2',
      reference_id: 'CAP-2026-00002',
      amended_from: 'CAP-2026-00001',
    })

    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: /Amend/ }))
    await userEvent.type(screen.getByLabelText(/سبب التعديل/), 'تصحيح لاحق')
    await userEvent.click(screen.getByRole('button', { name: 'تأكيد التعديل' }))

    await vi.waitFor(() => expect(mockReverseGl).toHaveBeenCalledTimes(1))
    // already Cancelled — cancel_document must NOT be called again
    expect(mockCancelDocument).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(mockCreateRow).toHaveBeenCalledTimes(1))
  })
})
