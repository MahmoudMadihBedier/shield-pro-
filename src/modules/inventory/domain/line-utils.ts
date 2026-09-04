/**
 * Generic JSON line-column helpers. Every inventory document stores its line
 * items as a single JSON string column (`lines` / `counts` / `variances`);
 * these turn that string into typed, validated rows and back.
 *
 * `parseLines` throws a plain `Error` on malformed / invalid JSON — the data
 * layer catches it at the Appwrite boundary and maps it to an `AppError`.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { z, type ZodType } from 'zod'

/** Serialise a list of line rows to the JSON string stored in Appwrite. */
export function serializeLines<T>(lines: readonly T[]): string {
  return JSON.stringify(lines)
}

/** Parse + validate a JSON line column. An absent / empty column is an empty list. */
export function parseLines<T>(raw: string | null | undefined, schema: ZodType<T>): T[] {
  if (raw == null || raw.trim() === '') return []

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('inventory: line column holds malformed JSON')
  }

  const result = z.array(schema).safeParse(parsed)
  if (!result.success) {
    throw new Error(`inventory: line column failed validation — ${result.error.message}`)
  }
  return result.data
}
