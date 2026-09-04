import { describe, expect, it, vi } from 'vitest'

import type { FnContext } from '../../common/handler'
import main from '../src/main'

function ctx(path: string | undefined, over: Partial<FnContext> = {}): FnContext {
  const json = vi.fn((data: unknown, status = 200) => ({ data, status }))
  return {
    req: { headers: {}, path, bodyRaw: '{}' },
    res: { json },
    log: vi.fn(),
    error: vi.fn(),
    ...over,
  }
}

describe('shield-server router', () => {
  it('returns a 404 not_found envelope for an unknown path', async () => {
    const c = ctx('/nope')
    await main(c)
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'not_found' }) }),
      404,
    )
  })

  it('treats a missing path as unknown rather than crashing', async () => {
    const c = ctx(undefined)
    await main(c)
    expect(c.res.json).toHaveBeenCalledWith(
      expect.objectContaining({ ok: false, error: expect.objectContaining({ code: 'not_found' }) }),
      404,
    )
  })

  it('normalises a trailing slash and query string before matching', async () => {
    // `/submit-document/` routes to the handler, which then fails building a
    // client (no x-appwrite-key in the fake request) — a 500, not a 404.
    const c = ctx('/submit-document/?foo=1')
    await main(c)
    const [payload, status] = (c.res.json as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
    expect(status).toBe(500)
    expect(payload).toMatchObject({ ok: false, error: { code: 'server' } })
  })

  it.each([
    '/post-stock-ledger',
    '/post-gl',
    '/segregation-guard',
    '/fraud-scan',
    '/review-fraud-flag',
    '/evaluate-approval',
    '/decide-approval',
  ])(
    'has %s wired to a handler',
    async (path) => {
      // Registered routes reach their handler and fail building a client (no
      // x-appwrite-key) → a 500 server envelope, never a 404 not_found.
      const c = ctx(path)
      await main(c)
      const [payload, status] = (c.res.json as ReturnType<typeof vi.fn>).mock.calls[0] ?? []
      expect(status).toBe(500)
      expect(payload).toMatchObject({ ok: false, error: { code: 'server' } })
    },
  )
})
