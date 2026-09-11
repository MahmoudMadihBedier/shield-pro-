/**
 * CRM follow-up tasks — the source-of-truth Zod shapes for `crm_followups`
 * (migration 0030) plus pure display helpers. A follow-up is a staff to-do
 * tied to a customer ("call back on <date>"), assigned to a staff member,
 * open until marked done or cancelled. Not a submittable document.
 *
 * `domain` is pure TypeScript — Zod only, no react / appwrite / vite.
 */
import { z } from 'zod'

/** `crm_followups.status`. */
export const FOLLOWUP_STATUSES = ['open', 'done', 'cancelled'] as const
export const followupStatusSchema = z.enum(FOLLOWUP_STATUSES)
export type FollowupStatus = z.infer<typeof followupStatusSchema>

const rowOptStr = z.string().nullish()

/** Exactly what the `tablesDB` shim returns for a `crm_followups` row. */
export const followupRowSchema = z.object({
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
  customer_id: z.string(),
  title: z.string(),
  notes: rowOptStr,
  /** `YYYY-MM-DD` (Postgres `date`). */
  due_date: z.string(),
  assigned_to: z.string(),
  status: followupStatusSchema,
  created_by: z.string(),
  branch_id: rowOptStr,
  done_at: rowOptStr,
  done_by: rowOptStr,
})
export type FollowupRow = z.infer<typeof followupRowSchema>

/** The add-follow-up form shape (React Hook Form + Zod resolver). */
export const followupFormSchema = z.object({
  title: z.string().trim().min(1, 'أدخل عنوانًا موجزًا').max(140, 'العنوان طويل جدًا'),
  notes: z.string().trim().max(2000, 'الملاحظة طويلة جدًا').optional(),
  due_date: z.string().min(1, 'اختر تاريخ الاستحقاق'),
  assigned_to: z.string().min(1, 'اختر المسؤول عن المتابعة'),
})
export type FollowupForm = z.infer<typeof followupFormSchema>

export const FOLLOWUP_STATUS_LABEL: Record<FollowupStatus, string> = {
  open: 'مفتوحة',
  done: 'مكتملة',
  cancelled: 'ملغاة',
}

export function followupStatusLabel(status: string): string {
  return FOLLOWUP_STATUS_LABEL[status as FollowupStatus] ?? status
}

/** An `open` follow-up whose due date has passed (day granularity, local time). */
export function isOverdue(
  followup: Pick<FollowupRow, 'status' | 'due_date'>,
  today: Date = new Date(),
): boolean {
  if (followup.status !== 'open') return false
  const due = Date.parse(`${followup.due_date}T00:00:00`)
  if (Number.isNaN(due)) return false
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  return due < start
}

/**
 * Open + overdue first (earliest due date first), then other open (earliest
 * first), then done/cancelled last (most recently touched first).
 */
export function sortFollowups<T extends Pick<FollowupRow, 'status' | 'due_date' | '$updatedAt'>>(
  rows: readonly T[],
  today: Date = new Date(),
): T[] {
  const rank = (f: T) => (f.status !== 'open' ? 2 : isOverdue(f, today) ? 0 : 1)
  return [...rows].sort((a, b) => {
    const r = rank(a) - rank(b)
    if (r !== 0) return r
    if (rank(a) < 2) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0
    return Date.parse(b.$updatedAt) - Date.parse(a.$updatedAt)
  })
}

/** How many open follow-ups are overdue — for a compact badge/summary. */
export function countOverdue(
  rows: readonly Pick<FollowupRow, 'status' | 'due_date'>[],
  today: Date = new Date(),
): number {
  return rows.filter((r) => isOverdue(r, today)).length
}
