import { AppwriteException } from '@/infrastructure/appwrite/testing'
import { describe, expect, it } from 'vitest'

import { mapAppwriteError } from '../errors'

describe('mapAppwriteError', () => {
  it('maps HTTP status codes to typed AppError codes', () => {
    expect(mapAppwriteError(new AppwriteException('nope', 401, 'user_unauthorized')).code).toBe(
      'unauthorized',
    )
    expect(mapAppwriteError(new AppwriteException('nope', 403, 'forbidden')).code).toBe('forbidden')
    expect(mapAppwriteError(new AppwriteException('nope', 404, 'not_found')).code).toBe('not_found')
    expect(mapAppwriteError(new AppwriteException('nope', 409, 'conflict')).code).toBe('conflict')
    expect(mapAppwriteError(new AppwriteException('nope', 429, 'rate')).code).toBe('rate_limited')
    expect(mapAppwriteError(new AppwriteException('boom', 503, 'server')).code).toBe('server')
  })

  it('maps a fetch failure to a network error', () => {
    expect(mapAppwriteError(new TypeError('Failed to fetch')).code).toBe('network')
  })

  it('never leaks the raw message as the user-facing message for known codes', () => {
    const mapped = mapAppwriteError(new AppwriteException('internal detail', 403, 'forbidden'))
    expect(mapped.message).not.toContain('internal detail')
    expect(mapped.detail).toContain('internal detail')
  })

  it('falls back to unknown for anything unrecognised', () => {
    expect(mapAppwriteError('weird').code).toBe('unknown')
  })
})
