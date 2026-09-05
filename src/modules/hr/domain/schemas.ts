/**
 * Zod schemas for the `hr` module — the source of truth for the
 * `attendance_records`, `payroll_runs` and `incentive_rules` row shapes, kept
 * in lockstep with `scripts/appwrite/schema.ts` (`claude.md` B.2). Every other
 * layer derives its types from here (`z.infer`).
 *
 * For each entity there are two schemas:
 *  - `<entity>RowSchema`  — exactly what Appwrite returns: the `$id` /
 *    `$createdAt` / `$updatedAt` system fields plus every column.
 *  - `<entity>DraftSchema` / `<entity>InputSchema` — the user-editable fields a
 *    create/edit form submits.
 *
 * `domain` is pure TypeScript — no react / appwrite / vite imports (Zod is the
 * project's runtime-validation primitive, see `src/core`).
 */
import { z } from 'zod'

import { documentEnvelopeSchema } from '@/core/document'

// ---------------------------------------------------------------------------
// Shared primitives
// ---------------------------------------------------------------------------

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

/** Row-side optional string — Appwrite returns `null` for an unset attribute. */
const rowOptStr = z.string().nullish()
/** Row-side boolean with a schema default — older rows may omit it. */
const rowBool = z.boolean().nullish().transform((v) => v ?? true)
/** Row-side numeric with a schema default of 0. */
const rowNum0 = z.number().nullish().transform((v) => v ?? 0)

/** "YYYY-MM-DD" business-date string used for `date` / period-boundary columns. */
const isoDate = z
  .string({ error: 'التاريخ مطلوب' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'صيغة التاريخ غير صحيحة (YYYY-MM-DD)')

/** Required free-text column, trimmed. */
const reqText = (max: number, label: string) =>
  z
    .string({ error: `${label} مطلوب` })
    .trim()
    .min(1, `${label} مطلوب`)
    .max(max, `${label} طويل جدًا`)

/** Optional free-text column, trimmed. Empty string is accepted (form default). */
const optText = (max: number) => z.string().trim().max(max).optional()

/** A non-negative money / quantity input. */
const nonNegative = (label: string) =>
  z.number({ error: `${label}: أدخل رقمًا صحيحًا` }).min(0, `${label} يجب ألا تكون سالبة`)

const documentRowSchema = documentEnvelopeSchema.extend(systemFields)

// ---------------------------------------------------------------------------
// attendance_records
// ---------------------------------------------------------------------------

export const ATTENDANCE_STATUSES = ['present', 'absent', 'leave', 'half_day'] as const
export const attendanceStatusSchema = z.enum(ATTENDANCE_STATUSES)
export type AttendanceStatus = z.infer<typeof attendanceStatusSchema>

/** Exactly what Appwrite returns for one `attendance_records` row. */
export const attendanceRecordRowSchema = z.object({
  ...systemFields,
  user_id: z.string(),
  date: z.string(),
  check_in: rowOptStr,
  check_out: rowOptStr,
  status: attendanceStatusSchema,
  notes: rowOptStr,
  branch_id: rowOptStr,
  created_by: z.string(),
  created_at: z.string(),
})
export type AttendanceRecord = z.infer<typeof attendanceRecordRowSchema>

/**
 * The upsert-by-day input (`attendance-repo.ts::upsertAttendance`). `created_at`
 * is stamped by the repo, not the caller.
 */
export const attendanceDraftSchema = z.object({
  userId: reqText(36, 'الموظف'),
  date: isoDate,
  checkIn: z.string().optional().nullable(),
  checkOut: z.string().optional().nullable(),
  status: attendanceStatusSchema,
  notes: optText(512),
  branchId: optText(36).nullable().optional(),
  createdBy: reqText(36, 'المستخدم المُنشئ'),
})
export type AttendanceDraft = z.infer<typeof attendanceDraftSchema>

// ---------------------------------------------------------------------------
// payroll_runs (submittable document)
// ---------------------------------------------------------------------------

/** One employee's line inside `payroll_runs.lines` (JSON column). */
export const payrollLineSchema = z.object({
  user_id: z.string(),
  base_salary: z.number().nonnegative(),
  incentives: z.number().nonnegative(),
  deductions: z.number().nonnegative(),
  net_pay: z.number(),
})
export type PayrollLine = z.infer<typeof payrollLineSchema>

export const payrollRunRowSchema = documentRowSchema.extend({
  pay_period_start: z.string(),
  pay_period_end: z.string(),
  /** Raw JSON — parse with `parsePayrollLines(row.lines)`. */
  lines: z.string(),
  total_net_pay: rowNum0,
})
export type PayrollRunRow = z.infer<typeof payrollRunRowSchema>

/** Create-form shape (React Hook Form + Zod). */
export const payrollRunDraftSchema = z.object({
  pay_period_start: isoDate,
  pay_period_end: isoDate,
  lines: z.array(payrollLineSchema).min(1, 'أضف موظفًا واحدًا على الأقل'),
})
export type PayrollRunDraft = z.infer<typeof payrollRunDraftSchema>

// ---------------------------------------------------------------------------
// incentive_rules
// ---------------------------------------------------------------------------

export const INCENTIVE_KINDS = ['sales_commission', 'production_bonus', 'attendance_bonus'] as const
export const incentiveKindSchema = z.enum(INCENTIVE_KINDS)
export type IncentiveKind = z.infer<typeof incentiveKindSchema>

export const incentiveRuleRowSchema = z.object({
  ...systemFields,
  name: z.string(),
  kind: incentiveKindSchema,
  predicate: rowOptStr,
  amount_or_pct: rowNum0,
  is_active: rowBool,
})
export type IncentiveRule = z.infer<typeof incentiveRuleRowSchema>

/**
 * Create/edit form + repo-write shape. `predicate` is the JSON-serialised
 * `IncentivePredicate` (see `domain/incentives.ts`) — stored as a string
 * column, same as every other JSON-column entity in this codebase.
 */
export const incentiveRuleInputSchema = z.object({
  name: reqText(128, 'اسم القاعدة'),
  kind: incentiveKindSchema,
  predicate: optText(2000),
  amount_or_pct: nonNegative('القيمة / النسبة'),
  is_active: z.boolean(),
})
export type IncentiveRuleInput = z.infer<typeof incentiveRuleInputSchema>
