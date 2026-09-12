/**
 * CRM leads / opportunity pipeline — the source-of-truth Zod shapes for
 * `leads` (migration 0031) plus pure display/ordering helpers. A lead is a
 * prospective customer not yet in `customers`, tracked through a stage
 * pipeline (new → contacted → qualified → won / lost).
 *
 * `domain` is pure TypeScript — Zod only, no react / appwrite / vite.
 */
import { z } from 'zod'

/** `leads.stage`. */
export const LEAD_STAGES = ['new', 'contacted', 'qualified', 'won', 'lost'] as const
export const leadStageSchema = z.enum(LEAD_STAGES)
export type LeadStage = z.infer<typeof leadStageSchema>

/** `leads.source` — optional. */
export const LEAD_SOURCES = ['referral', 'walk_in', 'call', 'whatsapp', 'social', 'other'] as const
export const leadSourceSchema = z.enum(LEAD_SOURCES)
export type LeadSource = z.infer<typeof leadSourceSchema>

const rowOptStr = z.string().nullish()

/** Exactly what the `tablesDB` shim returns for a `leads` row. */
export const leadRowSchema = z.object({
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
  name: z.string(),
  phone: rowOptStr,
  email: rowOptStr,
  source: leadSourceSchema.nullish(),
  stage: leadStageSchema,
  estimated_value: z.number().nullish(),
  notes: rowOptStr,
  assigned_to: z.string(),
  created_by: z.string(),
  branch_id: rowOptStr,
  converted_customer_id: rowOptStr,
  lost_reason: rowOptStr,
})
export type LeadRow = z.infer<typeof leadRowSchema>

/**
 * Exactly what the `tablesDB` shim returns for a `lead_stage_events` row
 * (migration 0034) — an append-only log written server-side by the same
 * trigger that guards the stage transition, never by the client.
 */
export const leadStageEventRowSchema = z.object({
  $id: z.string(),
  lead_id: z.string(),
  from_stage: leadStageSchema.nullish(),
  to_stage: leadStageSchema,
  reason: rowOptStr,
  changed_by: z.string(),
  changed_at: z.string(),
})
export type LeadStageEvent = z.infer<typeof leadStageEventRowSchema>

/**
 * The lead detail page's edit form — every field except `stage` (its own
 * dedicated, guarded control) and the read-only `converted_customer_id`.
 */
export const leadEditFormSchema = z.object({
  name: z.string().trim().min(1, 'أدخل اسم العميل المحتمل').max(128, 'الاسم طويل جدًا'),
  phone: z.string().trim().max(32, 'رقم الهاتف طويل جدًا').optional(),
  email: z.union([z.literal(''), z.string().trim().email('بريد إلكتروني غير صحيح')]).optional(),
  source: z.union([z.literal(''), leadSourceSchema]).optional(),
  estimated_value: z.number({ error: 'أدخل رقمًا' }).min(0, 'يجب ألا تكون القيمة سالبة'),
  notes: z.string().trim().max(2000, 'الملاحظة طويلة جدًا').optional(),
  assigned_to: z.string().min(1, 'اختر المسؤول عن المتابعة'),
})
export type LeadEditForm = z.infer<typeof leadEditFormSchema>

/**
 * Bulk-import CSV row (`CsvImportPanel`, Phase B #4 — docs/CRM_PLAN.md).
 * No `assigned_to` column: a spreadsheet only has a staff member's name, not
 * their `auth_user_id`, and matching by name is unreliable — every imported
 * lead is self-assigned to whoever runs the import, same as the single-lead
 * form's default; reassigning afterward is a normal one-click edit.
 */
export const leadImportRowSchema = z.object({
  name: z.string().trim().min(1, 'name مطلوب'),
  phone: z.string().trim().optional(),
  email: z.string().trim().optional(),
  source: z
    .union([z.literal(''), leadSourceSchema], {
      error: `source يجب أن يكون أحد: ${LEAD_SOURCES.join(', ')}، أو فارغًا`,
    })
    .optional(),
  estimated_value: z.coerce
    .number({ error: 'estimated_value يجب أن يكون رقمًا' })
    .nonnegative('estimated_value يجب ألا يكون سالبًا')
    .optional(),
  notes: z.string().trim().optional(),
})
export type LeadImportRow = z.infer<typeof leadImportRowSchema>

/**
 * `estimated_value` is a plain required number defaulting to 0 — NOT
 * `.optional()`. The bound `NumberField` uses RHF's `valueAsNumber: true`,
 * which yields `NaN` (not `undefined`) for an empty input; the shared `Form`
 * component requires the schema's Zod input type to equal its output type
 * (`ZodType<TValues, TValues>`), which rules out the `preprocess` + optional
 * combo that would otherwise tolerate that (same constraint documented on
 * `IncentiveRuleFormDialog`'s `amount_or_pct`). 0 already reads as "no
 * estimate" everywhere this field is consulted (`openPipelineValue`), so
 * defaulting to it is not a behavioural loss.
 */
export const leadFormSchema = z.object({
  name: z.string().trim().min(1, 'أدخل اسم العميل المحتمل').max(128, 'الاسم طويل جدًا'),
  phone: z.string().trim().max(32, 'رقم الهاتف طويل جدًا').optional(),
  email: z.union([z.literal(''), z.string().trim().email('بريد إلكتروني غير صحيح')]).optional(),
  source: z.union([z.literal(''), leadSourceSchema]).optional(),
  estimated_value: z.number({ error: 'أدخل رقمًا' }).min(0, 'يجب ألا تكون القيمة سالبة'),
  notes: z.string().trim().max(2000, 'الملاحظة طويلة جدًا').optional(),
  assigned_to: z.string().min(1, 'اختر المسؤول عن المتابعة'),
})
export type LeadForm = z.infer<typeof leadFormSchema>

export const LEAD_STAGE_LABEL: Record<LeadStage, string> = {
  new: 'جديد',
  contacted: 'تم التواصل',
  qualified: 'مؤهّل',
  won: 'ناجح',
  lost: 'خاسر',
}

export const LEAD_SOURCE_LABEL: Record<LeadSource, string> = {
  referral: 'إحالة',
  walk_in: 'زيارة مباشرة',
  call: 'مكالمة',
  whatsapp: 'واتساب',
  social: 'وسائل التواصل',
  other: 'أخرى',
}

export function leadStageLabel(stage: string): string {
  return LEAD_STAGE_LABEL[stage as LeadStage] ?? stage
}

export function leadSourceLabel(source: string | null | undefined): string | null {
  if (!source) return null
  return LEAD_SOURCE_LABEL[source as LeadSource] ?? source
}

/** `won` and `lost` are the pipeline's closed stages. */
export function isOpenStage(stage: string): boolean {
  return stage !== 'won' && stage !== 'lost'
}

/**
 * The pipeline's allowed forward moves: `new → contacted → qualified → won`,
 * with `lost` reachable from any open stage. `won` and `lost` are terminal —
 * reopening a closed lead is an explicit Admin Override action, not a normal
 * stage change (`claude.md` A.6: workflow transitions are a business rule,
 * not a free-form field).
 */
export const LEAD_STAGE_TRANSITIONS: Record<LeadStage, readonly LeadStage[]> = {
  new: ['contacted', 'lost'],
  contacted: ['qualified', 'lost'],
  qualified: ['won', 'lost'],
  won: [],
  lost: [],
}

export function canTransitionLeadStage(from: LeadStage, to: LeadStage): boolean {
  return from === to || LEAD_STAGE_TRANSITIONS[from].includes(to)
}

/** The stages selectable from `from`, including `from` itself. */
export function nextLeadStages(from: LeadStage): readonly LeadStage[] {
  return [from, ...LEAD_STAGE_TRANSITIONS[from]]
}

const STAGE_RANK: Record<LeadStage, number> = {
  new: 0,
  contacted: 1,
  qualified: 2,
  won: 3,
  lost: 3,
}

/** Earliest pipeline stage first (new → … → won/lost), newest-created within a stage first. */
export function sortLeads<T extends Pick<LeadRow, 'stage' | '$createdAt'>>(
  rows: readonly T[],
): T[] {
  return [...rows].sort((a, b) => {
    const r = STAGE_RANK[a.stage as LeadStage] - STAGE_RANK[b.stage as LeadStage]
    if (r !== 0) return r
    return Date.parse(b.$createdAt) - Date.parse(a.$createdAt)
  })
}

/** Total estimated value of every still-open lead — a simple pipeline-value figure. */
export function openPipelineValue(
  rows: readonly Pick<LeadRow, 'stage' | 'estimated_value'>[],
): number {
  return rows
    .filter((r) => isOpenStage(r.stage))
    .reduce((sum, r) => sum + Math.max(0, r.estimated_value ?? 0), 0)
}

/** A one-line description of a stage-history event, oldest-first display. */
export function describeStageEvent(e: Pick<LeadStageEvent, 'from_stage' | 'to_stage'>): string {
  if (!e.from_stage) return `أُنشئ بمرحلة ${leadStageLabel(e.to_stage)}`
  return `من ${leadStageLabel(e.from_stage)} إلى ${leadStageLabel(e.to_stage)}`
}

/** Newest first. */
export function sortStageEvents<T extends Pick<LeadStageEvent, 'changed_at'>>(
  events: readonly T[],
): T[] {
  return [...events].sort((a, b) => Date.parse(b.changed_at) - Date.parse(a.changed_at))
}

/** Flat rows for CSV / Excel export — `sortLeads`-ordered, names resolved by the caller. */
export function leadsToRows(
  rows: readonly LeadRow[],
  staffName: (id: string) => string,
): Array<{
  name: string
  phone: string
  email: string
  source: string
  stage: string
  estimated_value: number
  assigned_to: string
  created_at: string
  converted: string
}> {
  return sortLeads(rows).map((r) => ({
    name: r.name,
    phone: r.phone ?? '',
    email: r.email ?? '',
    source: leadSourceLabel(r.source) ?? '',
    stage: leadStageLabel(r.stage),
    estimated_value: r.estimated_value ?? 0,
    assigned_to: staffName(r.assigned_to),
    created_at: r.$createdAt,
    converted: r.converted_customer_id ? 'نعم' : 'لا',
  }))
}
