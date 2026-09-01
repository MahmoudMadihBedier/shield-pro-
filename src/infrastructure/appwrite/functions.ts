/**
 * Data layer for `shield-server`, the single Appwrite Function that owns
 * document identity and lifecycle. The client never allocates a sequence or
 * flips `doc_status` itself — it calls a route on this Function and gets a
 * `Result` back.
 *
 * Each operation is a URL path on the one Function (see `functions/server`).
 * Wire envelope (`functions/common/handler.ts`):
 *   success → `{ ok: true,  data: <payload> }`
 *   failure → `{ ok: false, error: { code, message } }`
 */
import { ExecutionMethod } from 'appwrite'

import { appError, type AppError, type AppErrorCode } from '@/core/errors'
import type { ReferenceEntity } from '@/core/reference-id'
import { err, ok, type Result } from '@/core/result'

import { mapAppwriteError } from './errors'
import { functions } from './services'

export const SERVER_FUNCTION_ID = 'shield-server'

export const ServerRoute = {
  allocateReferenceId: '/allocate-reference-id',
  submitDocument: '/submit-document',
  cancelDocument: '/cancel-document',
} as const

export interface AllocatedReference {
  referenceId: string
  prefix: string
  year: number
  sequence: number
}

export interface DocumentTransition {
  table: string
  rowId: string
  referenceId: string
  docStatus: number
  postingDatetime?: string
}

const KNOWN_CODES: ReadonlySet<AppErrorCode> = new Set<AppErrorCode>([
  'network',
  'unauthorized',
  'forbidden',
  'not_found',
  'validation',
  'conflict',
  'rate_limited',
  'server',
  'unknown',
])

function toAppErrorCode(code: unknown): AppErrorCode {
  return typeof code === 'string' && KNOWN_CODES.has(code as AppErrorCode)
    ? (code as AppErrorCode)
    : 'unknown'
}

interface WireFailure {
  ok: false
  error: { code?: string; message?: string }
}
interface WireSuccess<T> {
  ok: true
  data: T
}

async function invoke<T>(path: string, payload: unknown): Promise<Result<T>> {
  let body: string
  try {
    const execution = await functions.createExecution({
      functionId: SERVER_FUNCTION_ID,
      body: JSON.stringify(payload),
      method: ExecutionMethod.POST,
      xpath: path,
      headers: { 'content-type': 'application/json' },
    })
    body = execution.responseBody
  } catch (e) {
    return err(mapAppwriteError(e))
  }

  let parsed: WireSuccess<T> | WireFailure
  try {
    parsed = JSON.parse(body || '{}') as WireSuccess<T> | WireFailure
  } catch {
    return err(
      appError('server', 'The server returned an unreadable response. Please try again.', {
        detail: body.slice(0, 500),
      }),
    )
  }

  if (!parsed || typeof parsed !== 'object' || !('ok' in parsed)) {
    return err(appError('server', 'The server returned an unexpected response. Please try again.'))
  }
  if (parsed.ok) return ok(parsed.data)

  const message =
    parsed.error?.message ?? 'The operation could not be completed. Please try again.'
  return err(appError(toAppErrorCode(parsed.error?.code), message))
}

/** Reserve the next gap-free `<PREFIX>-<YYYY>-<00000>` for an entity. */
export function allocateReferenceId(entity: ReferenceEntity): Promise<Result<AllocatedReference>> {
  return invoke<AllocatedReference>(ServerRoute.allocateReferenceId, { entity })
}

/** Draft → Submitted for `<table>/<rowId>`. */
export function submitDocument(table: string, rowId: string): Promise<Result<DocumentTransition>> {
  return invoke<DocumentTransition>(ServerRoute.submitDocument, { table, rowId })
}

/** Submitted → Cancelled for `<table>/<rowId>`; `reason` is mandatory. */
export function cancelDocument(
  table: string,
  rowId: string,
  reason: string,
): Promise<Result<DocumentTransition>> {
  return invoke<DocumentTransition>(ServerRoute.cancelDocument, { table, rowId, reason })
}

export type { AppError }
