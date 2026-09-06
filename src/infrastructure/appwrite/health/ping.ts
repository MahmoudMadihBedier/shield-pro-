/**
 * Supabase connectivity check. Hits the GoTrue `/auth/v1/health` endpoint — it
 * needs no user session, only the publishable key, and proves the project URL
 * and key are reachable and correct. Used at startup and by the on-screen
 * status indicator.
 */
import { config } from '@/shared/config'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'

import { mapAppwriteError } from '../errors'

export interface PingSuccess {
  latencyMs: number
  checkedAt: string
}

/** Kept the name for import stability during the migration. */
export async function pingAppwrite(): Promise<Result<PingSuccess>> {
  const start = performance.now()
  try {
    const res = await fetch(`${config.supabaseUrl}/auth/v1/health`, {
      headers: { apikey: config.supabasePublishableKey },
    })
    if (!res.ok) {
      return err(
        appError('server', 'The service is temporarily unavailable. Please try again shortly.', {
          detail: `health ${res.status}`,
        }),
      )
    }
    return ok({
      latencyMs: performance.now() - start,
      checkedAt: new Date().toISOString(),
    })
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}
