import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockUpdateRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockUpdateRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return { tablesDB: { listRows: mockListRows, updateRow: mockUpdateRow }, Query }
})

// Realtime would otherwise open a real WebSocket in jsdom — stub it to a
// never-resolving no-op so `useNotificationsRealtime` degrades harmlessly.
vi.mock('appwrite', async () => {
  const actual = await vi.importActual<typeof import('appwrite')>('appwrite')
  return {
    ...actual,
    Realtime: class {
      subscribe() {
        return Promise.resolve({
          unsubscribe: () => Promise.resolve(),
          update: () => Promise.resolve(),
          close: () => Promise.resolve(),
        })
      }
    },
  }
})

import { AuthContext, type AuthContextValue } from '@/application/auth/context'
import { Role } from '@/core/rbac'

import { NotificationBell } from '../NotificationBell'

const PRINCIPAL: AuthContextValue['principal'] = {
  userId: 'user-1',
  roles: [Role.SystemAdmin],
  branchId: null,
}

function notifRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'notif-1',
    $createdAt: '2026-09-01T09:00:00.000Z',
    $updatedAt: '2026-09-01T09:00:00.000Z',
    recipient_user_id: 'user-1',
    kind: 'fraud_flag',
    title: 'بلاغ احتيال جديد',
    body: 'تفاصيل البلاغ',
    entity_ref: 'p1:w1',
    is_read: false,
    created_at: '2026-09-01T09:00:00.000Z',
    ...overrides,
  }
}

function renderBell() {
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
      <MemoryRouter>
        <AuthContext.Provider value={authValue}>
          <NotificationBell />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  mockListRows.mockReset()
  mockUpdateRow.mockReset()
})

describe('NotificationBell', () => {
  it('renders the bell with no badge and an empty dropdown when there is nothing to show', async () => {
    mockListRows.mockResolvedValue({ total: 0, rows: [] })
    renderBell()

    const button = screen.getByRole('button', { name: /الإشعارات/ })
    expect(button).toBeInTheDocument()
    expect(screen.queryByText('99+')).not.toBeInTheDocument()

    await userEvent.click(button)
    expect(await screen.findByTestId('notif-bell-empty')).toBeInTheDocument()
  })

  it('shows a loading state in the dropdown while the list query is pending', async () => {
    mockListRows.mockReturnValue(new Promise(() => {})) // never resolves
    renderBell()

    await userEvent.click(screen.getByRole('button', { name: /الإشعارات/ }))
    expect(await screen.findByTestId('notif-bell-loading')).toBeInTheDocument()
  })

  it('shows the unread badge count and the recent notifications', async () => {
    mockListRows
      .mockResolvedValueOnce({ total: 2, rows: [] }) // useUnreadCount
      .mockResolvedValueOnce({ total: 2, rows: [notifRow(), notifRow({ $id: 'notif-2' })] }) // useNotificationList

    renderBell()

    expect(await screen.findByText('2')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /الإشعارات/ }))
    const list = await screen.findByTestId('notif-bell-list')
    expect(list).toBeInTheDocument()
    expect(screen.getAllByText('بلاغ احتيال جديد')).toHaveLength(2)
  })
})
