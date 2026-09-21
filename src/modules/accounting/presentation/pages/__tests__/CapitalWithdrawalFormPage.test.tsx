import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockAllocateReferenceId, mockCreateRow, mockNavigate } = vi.hoisted(() => ({
  mockAllocateReferenceId: vi.fn(),
  mockCreateRow: vi.fn(),
  mockNavigate: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/functions', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/infrastructure/appwrite/functions')>()
  return { ...actual, allocateReferenceId: mockAllocateReferenceId }
})

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query, ID } = await import('@/infrastructure/appwrite/testing')
  return { tablesDB: { createRow: mockCreateRow }, Query, ID }
})

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

import { AuthContext, type AuthContextValue } from '@/application/auth/context'
import { ok } from '@/core/result'
import { Role } from '@/core/rbac'

import { CapitalWithdrawalFormPage } from '../CapitalWithdrawalFormPage'

const PRINCIPAL: AuthContextValue['principal'] = {
  userId: 'acct-1',
  roles: [Role.ChiefAccountant],
  branchId: null,
}

function renderPage(principal: AuthContextValue['principal'] = PRINCIPAL) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const authValue: AuthContextValue = {
    principal,
    status: 'authenticated',
    error: null,
    login: vi.fn(),
    logout: vi.fn(),
  }
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <CapitalWithdrawalFormPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockAllocateReferenceId.mockReset()
  mockCreateRow.mockReset()
  mockNavigate.mockReset()
})

describe('CapitalWithdrawalFormPage', () => {
  it('hides the form and shows a permission notice for a role that cannot record', () => {
    renderPage({ userId: 'rep-1', roles: [Role.SalesRep], branchId: 'br-1' })

    expect(screen.getByText('لا تملك صلاحية تسجيل سحب رأس المال.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/المستفيد/)).not.toBeInTheDocument()
  })

  it('renders the method/amount/source-account fields with cash defaults', () => {
    renderPage()

    expect(screen.getByLabelText(/المستفيد/)).toBeInTheDocument()
    expect(screen.getByLabelText(/طريقة السحب/)).toHaveValue('cash')
    expect(screen.getByLabelText(/القيمة/)).toBeInTheDocument()
    expect(screen.getByLabelText(/حساب المصدر/)).toHaveValue('cash')
  })

  it('blocks submit on a non-positive amount and never allocates a reference id', async () => {
    renderPage()

    await userEvent.type(screen.getByLabelText(/المستفيد/), 'المالك')
    await userEvent.click(screen.getByRole('button', { name: 'إنشاء مسودة' }))

    expect(await screen.findByText('أدخل قيمة موجبة')).toBeInTheDocument()
    expect(mockAllocateReferenceId).not.toHaveBeenCalled()
  })

  it('submits a valid withdrawal, posts the right draft fields, and navigates to the new row', async () => {
    mockAllocateReferenceId.mockResolvedValue(
      ok({ referenceId: 'CAPW-2026-00001', prefix: 'CAPW', year: 2026, sequence: 1 }),
    )
    mockCreateRow.mockResolvedValue({
      $id: 'w1',
      $createdAt: 't',
      $updatedAt: 't',
      reference_id: 'CAPW-2026-00001',
      doc_status: 0,
      branch_id: null,
      created_by: 'acct-1',
      amended_from: null,
      posting_datetime: '2026-09-21T00:00:00.000Z',
      remarks: null,
      withdrawn_by: 'المالك',
      method: 'cash',
      reason: null,
      amount: 1000,
      source_account: 'cash',
    })

    renderPage()

    await userEvent.type(screen.getByLabelText(/المستفيد/), 'المالك')
    await userEvent.type(screen.getByLabelText(/القيمة/), '1000')
    await userEvent.click(screen.getByRole('button', { name: 'إنشاء مسودة' }))

    await vi.waitFor(() => expect(mockCreateRow).toHaveBeenCalledTimes(1))

    const created = mockCreateRow.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(created.data).toMatchObject({
      withdrawn_by: 'المالك',
      method: 'cash',
      amount: 1000,
      source_account: 'cash',
      doc_status: 0,
      created_by: 'acct-1',
    })

    await vi.waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/accounting/capital-withdrawals/w1'),
    )
  })
})
