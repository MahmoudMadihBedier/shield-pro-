/**
 * Multi-rep attribution on a sale / purchase — a list of
 * `{ user_id, branch_id }` pairs stored as a JSON string column (`reps`).
 * Attribution / commission only; the custody + rep-ledger key stays the
 * document's single `rep_user_id`.
 *
 * `core` has ZERO framework imports — plain TypeScript + Zod only.
 */
import { z } from 'zod'

export const repAssignmentSchema = z.object({
  user_id: z.string().min(1),
  branch_id: z.string().min(1),
})
export type RepAssignment = z.infer<typeof repAssignmentSchema>

/**
 * Form-side row shape. The `RepBranchEditor` repeater seeds a new row with both
 * selects blank, so form validation must *tolerate* a half-filled row rather
 * than dead-ending submit with an error the UI never surfaces. Incomplete rows
 * are dropped on submit via {@link pickCompleteReps}.
 */
export const repAssignmentInputSchema = z.object({
  user_id: z.string(),
  branch_id: z.string(),
})

/** Keep only fully-filled attribution rows (both ids chosen). */
export function pickCompleteReps(reps: readonly RepAssignment[] | undefined): RepAssignment[] {
  return (reps ?? []).filter((r) => r.user_id !== '' && r.branch_id !== '')
}

/** Serialise for the `reps` JSON column. */
export function serializeReps(reps: readonly RepAssignment[]): string {
  return JSON.stringify(reps)
}

/** Parse the `reps` JSON column; an absent / malformed value is an empty list. */
export function parseReps(raw: string | null | undefined): RepAssignment[] {
  if (raw == null || raw.trim() === '') return []
  try {
    const parsed = z.array(repAssignmentSchema).safeParse(JSON.parse(raw))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}
