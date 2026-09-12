/**
 * CRM customer activity log — the source-of-truth Zod shapes for `crm_activities`
 * (migration 0029) plus pure display helpers. An activity is one logged
 * interaction with an existing customer (call / visit / WhatsApp / complaint /
 * …): a staff-facing timeline, not a submittable document.
 *
 * `domain` is pure TypeScript — Zod only, no react / appwrite / vite.
 */
import { z } from 'zod'

/** `crm_activities.kind`. */
export const ACTIVITY_KINDS = [
  'call',
  'visit',
  'whatsapp',
  'email',
  'meeting',
  'complaint',
  'note',
] as const
export const activityKindSchema = z.enum(ACTIVITY_KINDS)
export type ActivityKind = z.infer<typeof activityKindSchema>

/** `crm_activities.outcome` — optional. */
export const ACTIVITY_OUTCOMES = ['positive', 'neutral', 'negative', 'follow_up'] as const
export const activityOutcomeSchema = z.enum(ACTIVITY_OUTCOMES)
export type ActivityOutcome = z.infer<typeof activityOutcomeSchema>

const rowOptStr = z.string().nullish()

/** Exactly what the `tablesDB` shim returns for a `crm_activities` row. */
export const activityRowSchema = z.object({
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
  customer_id: z.string(),
  kind: activityKindSchema,
  subject: z.string(),
  note: rowOptStr,
  occurred_at: z.string(),
  outcome: activityOutcomeSchema.nullish(),
  created_by: z.string(),
  branch_id: rowOptStr,
})
export type ActivityRow = z.infer<typeof activityRowSchema>

/**
 * The add-activity form shape (React Hook Form + Zod resolver). `occurred_on`
 * is a `<input type="date">` value; the repo turns it into an ISO datetime.
 */
export const activityFormSchema = z.object({
  kind: activityKindSchema,
  subject: z.string().trim().min(1, 'أدخل عنوانًا موجزًا').max(140, 'العنوان طويل جدًا'),
  note: z.string().trim().max(2000, 'الملاحظة طويلة جدًا').optional(),
  occurred_on: z.string().min(1, 'اختر التاريخ'),
  outcome: z.union([z.literal(''), activityOutcomeSchema]).optional(),
})
export type ActivityForm = z.infer<typeof activityFormSchema>

export const ACTIVITY_KIND_LABEL: Record<ActivityKind, string> = {
  call: 'مكالمة',
  visit: 'زيارة',
  whatsapp: 'واتساب',
  email: 'بريد إلكتروني',
  meeting: 'اجتماع',
  complaint: 'شكوى',
  note: 'ملاحظة',
}

export const ACTIVITY_OUTCOME_LABEL: Record<ActivityOutcome, string> = {
  positive: 'إيجابية',
  neutral: 'محايدة',
  negative: 'سلبية',
  follow_up: 'تحتاج متابعة',
}

export function activityKindLabel(kind: string): string {
  return ACTIVITY_KIND_LABEL[kind as ActivityKind] ?? kind
}

export function activityOutcomeLabel(outcome: string | null | undefined): string | null {
  if (!outcome) return null
  return ACTIVITY_OUTCOME_LABEL[outcome as ActivityOutcome] ?? outcome
}

/** Newest first, by `occurred_at` then `$createdAt` (stable for same-day rows). */
export function sortActivities<T extends { occurred_at: string; $createdAt: string }>(
  rows: readonly T[],
): T[] {
  const ms = (iso: string) => {
    const t = Date.parse(iso)
    return Number.isNaN(t) ? 0 : t
  }
  return [...rows].sort(
    (a, b) => ms(b.occurred_at) - ms(a.occurred_at) || ms(b.$createdAt) - ms(a.$createdAt),
  )
}

/** How many activities of each kind — for a compact summary line. */
export function countByKind(rows: readonly { kind: string }[]): Array<[string, number]> {
  const counts = new Map<string, number>()
  for (const r of rows) counts.set(r.kind, (counts.get(r.kind) ?? 0) + 1)
  return [...counts.entries()].sort((a, b) => b[1] - a[1])
}

/** Flat rows for CSV / Excel export — `sortActivities`-ordered. */
export function activitiesToRows(rows: readonly ActivityRow[]): Array<{
  date: string
  kind: string
  subject: string
  note: string
  outcome: string
}> {
  return sortActivities(rows).map((r) => ({
    date: r.occurred_at,
    kind: activityKindLabel(r.kind),
    subject: r.subject,
    note: r.note ?? '',
    outcome: activityOutcomeLabel(r.outcome) ?? '',
  }))
}
