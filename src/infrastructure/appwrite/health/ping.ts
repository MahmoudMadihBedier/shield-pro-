/**
 * Appwrite connectivity check. `client.ping()` hits the project's public
 * `/ping` endpoint — it needs no auth and proves the endpoint + project id are
 * reachable and correct. Used at startup and by the on-screen status indicator.
 */
import { err, ok, type Result } from '@/core/result'

import { client } from '../client'
import { mapAppwriteError } from '../errors'

export interface PingSuccess {
  latencyMs: number
  checkedAt: string
}

export async function pingAppwrite(): Promise<Result<PingSuccess>> {
  const start = performance.now()
  try {
    await client.ping()
    return ok({
      latencyMs: performance.now() - start,
      checkedAt: new Date().toISOString(),
    })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
