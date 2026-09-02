import { AppwriteException } from 'appwrite'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockListRows, mockGetRow, mockCreateRow, mockUpdateRow, mockDeleteRow } = vi.hoisted(() => ({
  mockListRows: vi.fn(),
  mockGetRow: vi.fn(),
  mockCreateRow: vi.fn(),
  mockUpdateRow: vi.fn(),
  mockDeleteRow: vi.fn(),
}))

vi.mock('@/infrastructure/appwrite/services', async () => {
  const { Query } = await import('appwrite')
  return {
    Query,
    ID: { unique: () => 'generated-id' },
    tablesDB: {
      listRows: mockListRows,
      getRow: mockGetRow,
      createRow: mockCreateRow,
      updateRow: mockUpdateRow,
      deleteRow: mockDeleteRow,
    },
  }
})

import {
  branchInputSchema,
  branchRowSchema,
  customerInputSchema,
  customerRowSchema,
} from '../../domain/schemas'
import { makeMasterRepo, makeRemove } from '../master-repo'

const branchesRepo = makeMasterRepo({
  tableId: 'branches',
  rowSchema: branchRowSchema,
  inputSchema: branchInputSchema,
  searchField: 'name',
})

function branchRow(overrides: Record<string, unknown> = {}) {
  return {
    $id: 'b1',
    $createdAt: 't',
    $updatedAt: 't',
    name: 'الفرع الرئيسي',
    name_ar: null,
    location: null,
    sub_warehouse_id: null,
    branch_accountant_id: null,
    is_active: true,
    ...overrides,
  }
}

beforeEach(() => {
  mockListRows.mockReset()
  mockGetRow.mockReset()
  mockCreateRow.mockReset()
  mockUpdateRow.mockReset()
  mockDeleteRow.mockReset()
})

describe('list', () => {
  it('builds pagination, sort, filter and search queries', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [branchRow()], total: 1 })

    const result = await branchesRepo.list({
      search: 'الف',
      page: 2,
      pageSize: 25,
      sort: { field: 'name', dir: 'desc' },
      filters: [{ field: 'is_active', value: 'true' }],
    })

    expect(result.ok).toBe(true)
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    const joined = queries.join(' ')
    expect(joined).toMatch(/"method":"limit","values":\[25\]/)
    expect(joined).toMatch(/"method":"offset","values":\[50\]/)
    expect(joined).toMatch(/"method":"orderDesc","attribute":"name"/)
    expect(joined).toMatch(/"method":"equal","attribute":"is_active"/)
    expect(joined).toMatch(/"method":"startsWith","attribute":"name","values":\["الف"\]/)
  })

  it('omits the search query when the term is blank', async () => {
    mockListRows.mockResolvedValueOnce({ rows: [], total: 0 })
    await branchesRepo.list({ search: '   ', page: 0, pageSize: 10, sort: null })
    const queries = mockListRows.mock.calls[0]?.[0]?.queries as string[]
    expect(queries.join(' ')).not.toMatch(/startsWith/)
  })

  it('maps a raw Appwrite error to a typed AppError', async () => {
    mockListRows.mockRejectedValueOnce(new AppwriteException('boom', 503, 'server_error'))
    const result = await branchesRepo.list({ page: 0, pageSize: 10, sort: null })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })

  it("returns AppError('server') when a row fails Zod validation", async () => {
    mockListRows.mockResolvedValueOnce({ rows: [branchRow({ name: 123 })], total: 1 })
    const result = await branchesRepo.list({ page: 0, pageSize: 10, sort: null })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('server')
  })
})

describe('create', () => {
  it('generates an id, forwards a validated payload and parses the row back', async () => {
    mockCreateRow.mockResolvedValueOnce(branchRow({ name: 'فرع القاهرة' }))

    const result = await branchesRepo.create({
      name: '  فرع القاهرة  ',
      name_ar: '',
      location: '',
      sub_warehouse_id: '',
      branch_accountant_id: '',
      is_active: true,
    })

    expect(result.ok).toBe(true)
    const arg = mockCreateRow.mock.calls[0]?.[0]
    expect(arg.rowId).toBe('generated-id')
    expect(arg.tableId).toBe('branches')
    expect(arg.data.name).toBe('فرع القاهرة') // trimmed by the input schema
  })

  it('merges createDefaults and per-call overrides into the payload', async () => {
    const customersRepo = makeMasterRepo({
      tableId: 'customers',
      rowSchema: customerRowSchema,
      inputSchema: customerInputSchema,
      searchField: 'name',
      createDefaults: { approval_state: 'pending_approval' },
    })
    mockCreateRow.mockResolvedValueOnce({
      $id: 'c1',
      $createdAt: 't',
      $updatedAt: 't',
      code: 'C1',
      name: 'عميل',
      phone: null,
      branch_id: 'br-1',
      geo: '30,31',
      discount_pct: 0,
      credit_limit: 0,
      payment_terms_days: 0,
      approval_state: 'pending_approval',
      created_by: 'user-9',
    })

    const result = await customersRepo.create(
      {
        code: 'c1',
        name: 'عميل',
        phone: '',
        branch_id: 'br-1',
        geo: '30,31',
        discount_pct: 0,
        credit_limit: 0,
        payment_terms_days: 0,
      },
      { created_by: 'user-9' },
    )

    expect(result.ok).toBe(true)
    const data = mockCreateRow.mock.calls[0]?.[0]?.data
    expect(data.approval_state).toBe('pending_approval')
    expect(data.created_by).toBe('user-9')
    expect(data.code).toBe('C1')
  })

  it('rejects an invalid input before touching the network', async () => {
    const result = await branchesRepo.create({
      name: '',
      name_ar: '',
      location: '',
      sub_warehouse_id: '',
      branch_accountant_id: '',
      is_active: true,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('validation')
    expect(mockCreateRow).not.toHaveBeenCalled()
  })
})

describe('update', () => {
  it('accepts a partial patch and forwards only the given fields', async () => {
    mockUpdateRow.mockResolvedValueOnce(branchRow({ location: 'وسط البلد' }))
    const result = await branchesRepo.update('b1', { location: 'وسط البلد' })
    expect(result.ok).toBe(true)
    const arg = mockUpdateRow.mock.calls[0]?.[0]
    expect(arg.rowId).toBe('b1')
    expect(arg.data).toEqual({ location: 'وسط البلد' })
  })

  it('maps a 404 to a not_found AppError', async () => {
    mockUpdateRow.mockRejectedValueOnce(new AppwriteException('missing', 404, 'row_not_found'))
    const result = await branchesRepo.update('nope', { location: 'x' })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.error.code).toBe('not_found')
  })
})

describe('makeRemove', () => {
  it('deletes by id and returns ok(void)', async () => {
    mockDeleteRow.mockResolvedValueOnce(undefined)
    const remove = makeRemove('suppliers')
    const result = await remove('s1')
    expect(result).toEqual({ ok: true, value: undefined })
    expect(mockDeleteRow.mock.calls[0]?.[0]).toEqual({
      databaseId: 'shield_pro',
      tableId: 'suppliers',
      rowId: 's1',
    })
  })
})
