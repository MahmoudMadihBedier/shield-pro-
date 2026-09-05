/**
 * Zod schema for the `notifications` row — the source of truth for this
 * module's types, kept in lockstep with `scripts/appwrite/schema.ts`
 * (`claude.md` B.2). Pure TypeScript — no react / appwrite / vite imports.
 *
 * `kind` is a free short string on the server (str48), not a closed enum —
 * new trigger kinds land over time (Implementation Plan §4 / Phase 2 Story
 * 2.6 lists low stock, pending approvals, overdue customers, missed cash-up,
 * fraud flags and high waste %; only `fraud_flag` and `approval_pending` are
 * wired to a real trigger so far). So the schema accepts any non-empty
 * string and {@link notificationKindLabel} supplies a graceful fallback for
 * a kind it doesn't recognise yet, instead of failing to parse the row.
 */
import { z } from 'zod'

/** Appwrite system columns present on every returned row. */
const systemFields = {
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
}

export const notificationRowSchema = z.object({
  ...systemFields,
  recipient_user_id: z.string().max(36),
  kind: z.string().min(1).max(48),
  title: z.string().max(200),
  body: z.string().max(2000).nullish(),
  entity_ref: z.string().max(32).nullish(),
  is_read: z.boolean().default(false),
  created_at: z.string(),
})
export type Notification = z.infer<typeof notificationRowSchema>

export interface NotificationKindLabel {
  /** Arabic-first label. */
  ar: string
  /** English gloss. */
  en: string
}

/**
 * Starter map for every trigger kind named in the Implementation Plan.
 * `fraud_flag` and `approval_pending` are wired to a real Function today;
 * the rest are labelled ahead of time so the centre renders sensibly the
 * moment a future Story starts writing them.
 */
export const NOTIFICATION_KIND_LABELS: Record<string, NotificationKindLabel> = {
  fraud_flag: { ar: 'بلاغ احتيال', en: 'Fraud flag' },
  approval_pending: { ar: 'طلب موافقة معلّق', en: 'Approval pending' },
  low_stock: { ar: 'مخزون منخفض', en: 'Low stock' },
  overdue_customer: { ar: 'عميل متأخر السداد', en: 'Overdue customer' },
  missed_cashup: { ar: 'تسوية نقدية فائتة', en: 'Missed cash-up' },
  high_waste: { ar: 'نسبة هدر مرتفعة', en: 'High waste %' },
}

const UNKNOWN_KIND_LABEL: NotificationKindLabel = { ar: 'إشعار', en: 'Notification' }

/** Label for `kind`, falling back to a generic "Notification" for an unknown one. */
export function notificationKindLabel(kind: string): NotificationKindLabel {
  return NOTIFICATION_KIND_LABELS[kind] ?? UNKNOWN_KIND_LABEL
}

/** Convenience: `"عربي / English"`. */
export function bilingualKindLabel(kind: string): string {
  const label = notificationKindLabel(kind)
  return `${label.ar} / ${label.en}`
}
