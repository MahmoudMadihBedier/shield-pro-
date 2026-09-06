import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * A chainable PostgREST-builder stand-in. Every filter/order/range method
 * records its call and returns `this`; awaiting it resolves to `resolveWith`.
 */
function makeBuilder(resolveWith: { data: unknown; error: unknown; count?: number }) {
  const calls: Array<[string, unknown[]]> = []
  const builder: Record<string, unknown> = {}
  const chain =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push([name, args])
      return builder
    }
  for (const m of [
    'select',
    'eq',
    'in',
    'neq',
    'lt',
    'lte',
    'gt',
    'gte',
    'is',
    'not',
    'ilike',
    'or',
    'order',
    'range',
    'limit',
    'update',
    'insert',
    'delete',
  ]) {
    builder[m] = chain(m)
  }
  builder.maybeSingle = () => Promise.resolve(resolveWith)
  builder.single = () => Promise.resolve(resolveWith)
  builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(resolveWith).then(onFulfilled)
  return { builder, calls }
}

const { fromMock, current } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  current: { value: null as ReturnType<typeof makeBuilder> | null },
}))

vi.mock('../client', () => ({
  supabase: { from: (...a: unknown[]) => fromMock(...a) },
}))

const { tablesDB } = await import('../tables')

function stub(resolveWith: { data: unknown; error: unknown; count?: number }) {
  const made = makeBuilder(resolveWith)
  current.value = made
  fromMock.mockReturnValue(made.builder)
  return made
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('tablesDB.listRows', () => {
  it('translates Appwrite $-system fields in queries to Postgres columns', async () => {
    const made = stub({ data: [], error: null, count: 0 })

    await tablesDB.listRows({
      tableId: 'purchase_orders',
      queries: [
        JSON.stringify({ method: 'orderDesc', attribute: '$createdAt' }),
        JSON.stringify({ method: 'equal', attribute: '$id', values: ['row-1'] }),
        JSON.stringify({ method: 'limit', values: [25] }),
        JSON.stringify({ method: 'offset', values: [0] }),
      ],
    })

    const order = made.calls.find(([n]) => n === 'order')
    expect(order?.[1][0]).toBe('created_at')
    const eq = made.calls.find(([n]) => n === 'eq')
    expect(eq?.[1][0]).toBe('id')
  })

  it('maps rows so both $id and id (and the timestamps) are present', async () => {
    stub({
      data: [{ id: 'r1', created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-02T00:00:00Z', name: 'x' }],
      error: null,
      count: 1,
    })

    const res = await tablesDB.listRows({ tableId: 'branches' })

    expect(res.total).toBe(1)
    expect(res.rows[0]).toMatchObject({
      $id: 'r1',
      id: 'r1',
      $createdAt: '2026-01-01T00:00:00Z',
      $updatedAt: '2026-01-02T00:00:00Z',
      name: 'x',
    })
  })
})

describe('tablesDB.getRow', () => {
  it('throws a 404-coded error when the row is missing', async () => {
    stub({ data: null, error: null })
    await expect(
      tablesDB.getRow({ tableId: 'branches', rowId: 'nope' }),
    ).rejects.toMatchObject({ code: 404 })
  })

  it('maps a unique violation to a 409-coded error on create', async () => {
    stub({ data: null, error: { code: '23505', message: 'duplicate key' } })
    await expect(
      tablesDB.createRow({ tableId: 'branches', rowId: 'unique()', data: { name: 'dup' } }),
    ).rejects.toMatchObject({ code: 409 })
  })
})
