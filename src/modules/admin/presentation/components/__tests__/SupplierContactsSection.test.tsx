import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockCreateRow, mockDeleteRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockCreateRow: vi.fn(),
  mockDeleteRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query, ID } = await import('@/infrastructure/appwrite/testing')
  return {
    tablesDB: { listRows: mockListRows, createRow: mockCreateRow, deleteRow: mockDeleteRow },
    Query,
    ID,
  }
})

import { SupplierContactsSection } from '../SupplierContactsSection'

function contactRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'sc-1',
    $createdAt: 't',
    $updatedAt: 't',
    supplier_id: 'sup-1',
    contact_name: 'محمد علي',
    role_title: 'مدير المشتريات',
    phone: '01012345678',
    email: 'mohamed@example.com',
    is_primary: true,
    ...overrides,
  }
}

function renderSection() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <SupplierContactsSection supplierId="sup-1" />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockListRows.mockReset()
  mockCreateRow.mockReset()
  mockDeleteRow.mockReset()
})

describe('SupplierContactsSection', () => {
  it('shows an empty state when the supplier has no contacts yet', async () => {
    mockListRows.mockResolvedValue({ total: 0, rows: [] })
    renderSection()

    expect(await screen.findByText('لا توجد جهات اتصال بعد.')).toBeInTheDocument()
  })

  it('lists existing contacts with their details and a primary badge', async () => {
    mockListRows.mockResolvedValue({ total: 1, rows: [contactRow()] })
    renderSection()

    expect(await screen.findByText('محمد علي')).toBeInTheDocument()
    expect(screen.getByText('أساسي')).toBeInTheDocument()
    expect(
      screen.getByText('مدير المشتريات · 01012345678 · mohamed@example.com'),
    ).toBeInTheDocument()
  })

  it('blocks adding a contact with no name and never calls the repo', async () => {
    mockListRows.mockResolvedValue({ total: 0, rows: [] })
    renderSection()
    await screen.findByText('لا توجد جهات اتصال بعد.')

    await userEvent.click(screen.getByRole('button', { name: '+ إضافة جهة اتصال' }))

    expect(await screen.findByText('اسم جهة الاتصال مطلوب')).toBeInTheDocument()
    expect(mockCreateRow).not.toHaveBeenCalled()
  })

  it('adds a new contact scoped to the supplier and refreshes the list', async () => {
    mockListRows
      .mockResolvedValueOnce({ total: 0, rows: [] }) // initial load
      .mockResolvedValueOnce({ total: 1, rows: [contactRow({ contact_name: 'سارة أحمد' })] }) // after invalidate
    mockCreateRow.mockResolvedValue(contactRow({ contact_name: 'سارة أحمد' }))

    renderSection()
    await screen.findByText('لا توجد جهات اتصال بعد.')

    await userEvent.type(screen.getByLabelText(/اسم جهة الاتصال/), 'سارة أحمد')
    await userEvent.click(screen.getByRole('button', { name: '+ إضافة جهة اتصال' }))

    await waitFor(() => expect(mockCreateRow).toHaveBeenCalledTimes(1))
    const call = mockCreateRow.mock.calls[0]![0] as { data: Record<string, unknown> }
    expect(call.data).toMatchObject({ contact_name: 'سارة أحمد', supplier_id: 'sup-1' })

    expect(await screen.findByText('سارة أحمد')).toBeInTheDocument()
  })

  it('removes a contact when "حذف" is clicked', async () => {
    mockListRows
      .mockResolvedValueOnce({ total: 1, rows: [contactRow()] })
      .mockResolvedValueOnce({ total: 0, rows: [] })
    mockDeleteRow.mockResolvedValue(undefined)

    renderSection()
    await screen.findByText('محمد علي')

    await userEvent.click(screen.getByRole('button', { name: 'حذف' }))

    await waitFor(() =>
      expect(mockDeleteRow).toHaveBeenCalledWith(expect.objectContaining({ rowId: 'sc-1' })),
    )
    expect(await screen.findByText('لا توجد جهات اتصال بعد.')).toBeInTheDocument()
  })
})
