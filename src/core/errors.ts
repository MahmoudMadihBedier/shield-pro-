/**
 * Typed application errors.
 *
 * The data layer is the only place allowed to construct these from raw
 * transport/SDK errors (see `infrastructure/appwrite/errors.ts`). Everything
 * above the data layer passes `AppError` around inside a `Result` and never
 * sees a raw Appwrite exception.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export type AppErrorCode =
  | 'network' // could not reach the server
  | 'unauthorized' // not signed in / session expired
  | 'forbidden' // signed in but not allowed (RBAC / scope)
  | 'not_found'
  | 'validation' // input failed a schema / business rule
  | 'conflict' // state changed underneath us / duplicate
  | 'rate_limited'
  | 'pending_approval' // action is held awaiting a manual approval decision
  | 'server' // 5xx from the backend
  | 'unknown'

export interface AppError {
  readonly code: AppErrorCode
  /** Safe to show to the user: says what happened and what to do next. */
  readonly message: string
  /** Technical detail for logs/telemetry — never rendered raw in the UI. */
  readonly detail?: string
  /** Original thrown value, kept for logging only. */
  readonly cause?: unknown
}

export function appError(
  code: AppErrorCode,
  message: string,
  opts: { detail?: string; cause?: unknown } = {},
): AppError {
  return { code, message, detail: opts.detail, cause: opts.cause }
}

export function isAppError(value: unknown): value is AppError {
  return (
    typeof value === 'object' &&
    value !== null &&
    'code' in value &&
    'message' in value &&
    typeof (value as { message: unknown }).message === 'string'
  )
}
