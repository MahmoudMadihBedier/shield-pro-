/**
 * Test-only compatibility surface left over from the Appwrite → Supabase
 * migration. Unit tests across the module data layers were written against the
 * Appwrite SDK's `Query` / `ID` helpers and its `AppwriteException`; rather than
 * rewrite ~30 test files, they import the equivalents from here.
 *
 * NOT imported by any production code — `src/**` outside `__tests__` must never
 * pull this in.
 */
export { Query, ID } from './query'

/**
 * Minimal stand-in for the Appwrite SDK's `AppwriteException`. `mapAppwriteError`
 * (see `./errors`) recognises any `Error` carrying a numeric `code`, so this is
 * enough to exercise the status-code → `AppError` mapping.
 */
export class AppwriteException extends Error {
  readonly code: number
  readonly type: string
  readonly response: string

  constructor(message: string, code = 0, type = '', response = '') {
    super(message)
    this.name = 'AppwriteException'
    this.code = code
    this.type = type
    this.response = response
  }
}
