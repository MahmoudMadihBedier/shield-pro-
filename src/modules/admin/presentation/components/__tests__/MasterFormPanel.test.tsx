import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const { mockListRows, mockCreateRow, mockUpdateRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockCreateRow: vi.fn(),
  mockUpdateRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query, ID } = await import('@/infrastructure/appwrite/testing')
  return {
    tablesDB: {
      listRows: mockListRows,
      createRow: mockCreateRow,
      updateRow: mockUpdateRow,
      deleteRow: vi.fn(),
    },
    Query,
    ID,
  }
})

import { AuthContext, type AuthContextValue } from '@/application/auth/context'
import { Role } from '@/core/rbac'

import { MasterFormPanel } from '../MasterFormPanel'

const PRINCIPAL: AuthContextValue['principal'] = {
  userId: 'admin-1',
  roles: [Role.SystemAdmin],
  branchId: null,
}

function renderPanel(props: Omit<Parameters<typeof MasterFormPanel<'supplier'>>[0], 'entity'>) {
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
      <AuthContext.Provider value={authValue}>
        <MasterFormPanel entity="supplier" {...props} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  )
}

describe('MasterFormPanel — supplier', () => {
  it('renders description/notes as real <textarea> fields, not single-line inputs', () => {
    renderPanel({ mode: 'create', onDone: vi.fn() })

    const description = screen.getByLabelText(/الوصف/)
    const notes = screen.getByLabelText(/ملاحظات/)
    expect(description.tagName).toBe('TEXTAREA')
    expect(notes.tagName).toBe('TEXTAREA')
  })

  it('hints to save the supplier first instead of showing contacts when creating', () => {
    renderPanel({ mode: 'create', onDone: vi.fn() })

    expect(screen.getByText(/يمكنك إضافة جهات اتصال متعددة بعد حفظ المورد/)).toBeInTheDocument()
    expect(screen.queryByText('جهات الاتصال / Contacts')).not.toBeInTheDocument()
  })

  it('embeds the supplier contacts editor once a row exists (edit mode)', async () => {
    mockListRows.mockResolvedValue({ total: 0, rows: [] })
    const row = {
      $id: 'sup-1',
      $createdAt: 't',
      $updatedAt: 't',
      name: 'مورد الخامات',
      contact: null,
      phone: null,
      tax_id: null,
      description: null,
      notes: null,
    }

    renderPanel({ mode: 'edit', row, onDone: vi.fn() })

    expect(await screen.findByText('جهات الاتصال / Contacts')).toBeInTheDocument()
    // it queries supplier_contacts scoped to this exact supplier
    expect(mockListRows).toHaveBeenCalledWith(
      expect.objectContaining({ tableId: 'supplier_contacts' }),
    )
  })
})
