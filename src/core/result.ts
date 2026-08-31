/**
 * `Result<T, E>` — the single cross-layer success/failure contract for
 * Shield Pro (per `claude.md` Section B.5).
 *
 * - Data layer: catches raw errors, returns `err(AppError)`.
 * - Domain layer: use-cases return `Result<T, AppError>`; never throw across
 *   a layer boundary.
 * - Presentation layer: maps `err` to a user-facing state; unwraps `ok`.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */
import type { AppError } from './errors'

export interface Ok<T> {
  readonly ok: true
  readonly value: T
}

export interface Err<E> {
  readonly ok: false
  readonly error: E
}

export type Result<T, E = AppError> = Ok<T> | Err<E>

export function ok<T>(value: T): Ok<T> {
  return { ok: true, value }
}

export function err<E>(error: E): Err<E> {
  return { ok: false, error }
}

export function isOk<T, E>(result: Result<T, E>): result is Ok<T> {
  return result.ok
}

export function isErr<T, E>(result: Result<T, E>): result is Err<E> {
  return !result.ok
}

/** Map the success value, leaving an error untouched. */
export function mapResult<T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> {
  return result.ok ? ok(fn(result.value)) : result
}

/** Get the value or throw the error — use only at the outermost boundary. */
export function unwrap<T, E>(result: Result<T, E>): T {
  if (result.ok) return result.value
  throw result.error
}
