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

/** The add-lead form shape (React Hook Form + Zod resolver). */
export const leadFormSchema = z.object({
  name: z.string().trim().min(1, 'أدخل اسم العميل المحتمل').max(128, 'الاسم طويل جدًا'),
  phone: z.string().trim().max(32, 'رقم الهاتف طويل جدًا').optional(),
  email: z.union([z.literal(''), z.string().trim().email('بريد إلكتروني غير صحيح')]).optional(),
  source: z.union([z.literal(''), leadSourceSchema]).optional(),
  estimated_value: z.number({ error: 'أدخل رقمًا' }).min(0, 'يجب ألا تكون القيمة سالبة').optional(),
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
