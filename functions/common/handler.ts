/**
 * Adapts an Appwrite Function `context` to a small typed JSON contract so each
 * Function's `main.ts` stays a three-liner and the interesting code lives in a
 * pure, injectable `logic.ts`.
 *
 * Wire response envelope (all Functions):
 *   success → 200 `{ "ok": true,  "data": <payload> }`
 *   failure → 4xx/5xx `{ "ok": false, "error": { "code": <AppErrorCode>, "message": <safe text> } }`
 */

/** Codes deliberately overlap `src/core/errors.ts::AppErrorCode` so the client
 *  can map them straight onto an `AppError` without a translation table. */
export type FnErrorCode =
  | 'validation'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'server'

const STATUS_BY_CODE: Record<FnErrorCode, number> = {
  validation: 400,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  server: 500,
}

export class FnError extends Error {
  readonly code: FnErrorCode
  readonly status: number
  constructor(code: FnErrorCode, message: string) {
    super(message)
    this.name = 'FnError'
    this.code = code
    this.status = STATUS_BY_CODE[code]
  }
}

/** The subset of the Appwrite Function request this module touches. */
export interface FnRequest {
  headers: Record<string, string | undefined>
  /** URL path the execution was invoked with, e.g. `/submit-document`. */
  path?: string
  bodyJson?: unknown
  bodyRaw?: string
  bodyText?: string
}

export interface HandlerInput<Body> {
  body: Body
  /** `$id` of the authenticated caller, or `null` when executed without a session. */
  caller: string | null
  /** Raw request — pass to `tablesDbFromRequest` to build a scoped client. */
  req: FnRequest
  log: (msg: unknown) => void
}

/** The subset of the Appwrite Function `context` this module touches. */
export interface FnContext {
  req: FnRequest
  res: { json: (data: unknown, status?: number) => unknown }
  log: (msg: unknown) => void
  error: (msg: unknown) => void
}

function readBody(req: FnContext['req']): unknown {
  if (req.bodyJson !== undefined && req.bodyJson !== null && req.bodyJson !== '') return req.bodyJson
  const raw = req.bodyRaw ?? req.bodyText ?? ''
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new FnError('validation', 'request body is not valid JSON')
  }
}

export function jsonHandler<Body = unknown, Out = unknown>(
  run: (input: HandlerInput<Body>) => Promise<Out>,
) {
  return async (context: FnContext): Promise<unknown> => {
    const { req, res, log, error } = context
    try {
      const data = await run({
        body: readBody(req) as Body,
        caller: req.headers['x-appwrite-user-id'] ?? null,
        req,
        log,
      })
      return res.json({ ok: true, data }, 200)
    } catch (e) {
      if (e instanceof FnError) {
        return res.json({ ok: false, error: { code: e.code, message: e.message } }, e.status)
      }
      error(e instanceof Error ? (e.stack ?? e.message) : String(e))
      return res.json(
        { ok: false, error: { code: 'server', message: 'The operation could not be completed.' } },
        500,
      )
    }
  }
}
