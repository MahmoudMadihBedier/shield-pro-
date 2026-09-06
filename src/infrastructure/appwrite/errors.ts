/**
 * The data-layer boundary: turn a raw Supabase / transport error into a typed
 * `AppError` with a user-facing message. Nothing above `infrastructure` should
 * ever see a `PostgrestError`, an `AuthError`, or the coded `Error` thrown by
 * the `tablesDB` shim.
 *
 * (Kept the name `mapAppwriteError` during the Appwrite → Supabase migration so
 * the ~30 import sites don't churn; it will be renamed in cleanup.)
 */
import { appError, type AppError } from '@/core/errors'

/** A Postgres SQLSTATE / PostgREST code → our coarse error bucket. */
function codeFromSqlState(sqlState: string): AppError['code'] {
  switch (sqlState) {
    case 'PGRST116': // .single() found 0 rows
    case 'P0002': // plpgsql: no_data_found / raise 'does not exist'
      return 'not_found'
    case '23505': // unique_violation
    case '55000': // object_not_in_prerequisite_state (e.g. "already submitted")
    case '40001': // serialization_failure
      return 'conflict'
    case '42501': // insufficient_privilege — RLS denial + our SoD / role raises
      return 'forbidden'
    case 'PGRST301': // JWT expired
    case '28000': // invalid_authorization_specification
      return 'unauthorized'
    case '23502': // not_null_violation
    case '23503': // foreign_key_violation
    case '23514': // check_violation
    case '22023': // invalid_parameter_value — our "unknown entity" raises
    case '22P02': // invalid_text_representation
    case '22007': // invalid_datetime_format
      return 'validation'
    default:
      if (sqlState.startsWith('08')) return 'network' // connection exceptions
      if (
        sqlState.startsWith('53') || // insufficient_resources
        sqlState.startsWith('54') || // program_limit_exceeded
        sqlState.startsWith('57') || // operator_intervention
        sqlState.startsWith('58') || // system_error
        sqlState.startsWith('XX') || // internal_error
        sqlState.startsWith('PGRST') // unmatched PostgREST codes → treat as server
      ) {
        return 'server'
      }
      return 'unknown'
  }
}

const MESSAGES: Record<AppError['code'], string> = {
  network: 'Cannot reach the server. Check your internet connection.',
  unauthorized: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to perform this action.',
  not_found: 'The requested record could not be found.',
  validation: 'Some of the information provided is invalid. Please review and try again.',
  conflict: 'This change conflicts with the current state. Refresh and try again.',
  rate_limited: 'Too many attempts. Please wait a moment and try again.',
  pending_approval: 'This document is awaiting approval review and cannot be submitted yet.',
  server: 'The service is temporarily unavailable. Please try again shortly.',
  unknown: 'Something went wrong.',
}

interface PostgrestLike {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}
interface AuthLike {
  message: string
  status?: number
  code?: string
  name: string
}

function isPostgrestLike(e: unknown): e is PostgrestLike {
  return (
    typeof e === 'object' &&
    e !== null &&
    'message' in e &&
    'code' in e &&
    typeof (e as { code: unknown }).code === 'string'
  )
}

function isAuthLike(e: unknown): e is AuthLike {
  return (
    typeof e === 'object' &&
    e !== null &&
    'name' in e &&
    typeof (e as { name: unknown }).name === 'string' &&
    /AuthError|AuthApiError|AuthSessionMissingError/.test((e as { name: string }).name)
  )
}

export function mapAppwriteError(e: unknown): AppError {
  // Network failures surface as a fetch TypeError before anything typed.
  if (e instanceof TypeError && /fetch|network|Failed to fetch|Load failed/i.test(e.message)) {
    return appError('network', MESSAGES.network, { detail: e.message, cause: e })
  }

  // Supabase Auth errors carry an HTTP `status`.
  if (isAuthLike(e)) {
    const status = e.status ?? 0
    let code: AppError['code'] = 'unknown'
    if (status === 400 || status === 422) code = 'validation'
    else if (status === 401 || e.name === 'AuthSessionMissingError') code = 'unauthorized'
    else if (status === 403) code = 'forbidden'
    else if (status === 404) code = 'not_found'
    else if (status === 429) code = 'rate_limited'
    else if (status >= 500) code = 'server'
    // "Invalid login credentials" should read as such, not as a generic 400.
    const message = /invalid login credentials/i.test(e.message)
      ? 'The email or password is incorrect.'
      : MESSAGES[code]
    return appError(code, message, {
      detail: `${e.name}${e.code ? ` ${e.code}` : ''}: ${e.message}`,
    })
  }

  // PostgREST / plpgsql errors (also what `supabase.rpc()` returns on failure).
  if (isPostgrestLike(e)) {
    const code = codeFromSqlState(e.code ?? '')
    // For explicit business-rule raises (forbidden / conflict / validation) the
    // server message is already human-friendly and worth surfacing.
    const surface =
      code === 'forbidden' || code === 'conflict' || code === 'validation' || code === 'not_found'
    return appError(code, surface && e.message ? e.message : MESSAGES[code], {
      detail: `${e.code}: ${e.message}${e.details ? ` (${e.details})` : ''}`,
      cause: e,
    })
  }

  // The `tablesDB` shim throws `Error & { code: number }`.
  if (e instanceof Error && typeof (e as { code?: unknown }).code === 'number') {
    const n = (e as unknown as { code: number }).code
    let code: AppError['code'] = 'unknown'
    if (n === 400) code = 'validation'
    else if (n === 401) code = 'unauthorized'
    else if (n === 403) code = 'forbidden'
    else if (n === 404) code = 'not_found'
    else if (n === 409) code = 'conflict'
    else if (n === 429) code = 'rate_limited'
    else if (n >= 500) code = 'server'
    return appError(code, MESSAGES[code], { detail: e.message, cause: e })
  }

  if (e instanceof Error) {
    return appError('unknown', MESSAGES.unknown, { detail: e.message, cause: e })
  }

  return appError('unknown', MESSAGES.unknown, { cause: e })
}
