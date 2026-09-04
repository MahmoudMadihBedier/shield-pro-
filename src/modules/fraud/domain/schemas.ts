/**
 * Zod schema for the `fraud_flags` row — the source of truth for this module's
 * types, kept in lockstep with `scripts/appwrite/schema.ts` (`claude.md` B.2).
 *
 * `domain` is pure TypeScript — no react / appwrite / vite imports (Zod is the
 * project's runtime-validation primitive and is allowed, see `src/core`).
 */
import { z } from 'zod'

export const FRAUD_FLAG_KINDS = [
  'round_tripping',
  'repeated_movement',
  'high_reversal_ratio',
] as const
export const fraudFlagKindSchema = z.enum(FRAUD_FLAG_KINDS)
export type FraudFlagKind = z.infer<typeof fraudFlagKindSchema>

export const FRAUD_FLAG_STATUSES = ['open', 'reviewed', 'dismissed'] as const
export const fraudFlagStatusSchema = z.enum(FRAUD_FLAG_STATUSES)
export type FraudFlagStatus = z.infer<typeof fraudFlagStatusSchema>

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

export const fraudFlagRowSchema = z.object({
  ...systemFields,
  kind: fraudFlagKindSchema,
  subject_type: z.string().max(32),
  subject_id: z.string().max(36),
  detail: z.string().max(2000).nullish(),
  status: fraudFlagStatusSchema,
  created_at: z.string(),
})
export type FraudFlagRow = z.infer<typeof fraudFlagRowSchema>
