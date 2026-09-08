/**
 * Staff-account create / edit forms — the System-Admin flow for onboarding a
 * user (auth account + `public.users` profile) and later adjusting their
 * responsibilities. The actual writes go through the `staff-account` Edge
 * Function (`src/infrastructure/appwrite/functions.ts`), which owns the Auth
 * admin API.
 *
 * `domain` is pure TypeScript — no react, no appwrite imports.
 */
import { z } from 'zod'

import { ALL_ROLES } from '@/core/rbac'

export { ROLE_OPTIONS, ROLE_LABELS, ALL_ROLES, parseRoles, serializeRoles } from '@/core/rbac'

const roleSchema = z.enum(ALL_ROLES, { error: 'اختر مسمى وظيفيًا واحدًا على الأقل' })

const emailSchema = z
  .string({ error: 'البريد الإلكتروني مطلوب' })
  .trim()
  .toLowerCase()
  .email('أدخل بريدًا إلكترونيًا صحيحًا')
  .max(160)

const passwordSchema = z
  .string({ error: 'كلمة المرور مطلوبة' })
  .min(8, 'كلمة المرور يجب ألا تقل عن 8 أحرف')
  .max(72, 'كلمة المرور طويلة جدًا')

const fullNameSchema = z.string({ error: 'الاسم الكامل مطلوب' }).trim().min(1).max(128)
const optId = z.string().trim().max(36).optional()
const optGrade = z.string().trim().max(64).optional()

/** New staff account: auth user + profile in one step. */
export const staffCreateSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  password: passwordSchema,
  roles: z.array(roleSchema).min(1, 'اختر مسمى وظيفيًا واحدًا على الأقل'),
  branch_id: optId,
  sub_warehouse_id: optId,
  job_grade: optGrade,
})
export type StaffCreateInput = z.infer<typeof staffCreateSchema>

/** Edit an existing account's data / roles / responsibilities. */
export const staffUpdateSchema = z.object({
  full_name: fullNameSchema,
  email: emailSchema,
  roles: z.array(roleSchema).min(1, 'اختر مسمى وظيفيًا واحدًا على الأقل'),
  branch_id: optId,
  sub_warehouse_id: optId,
  job_grade: optGrade,
  is_active: z.boolean(),
})
export type StaffUpdateInput = z.infer<typeof staffUpdateSchema>

/** Password reset — a separate action so it is never sent implicitly. */
export const staffPasswordSchema = z.object({ password: passwordSchema })
export type StaffPasswordInput = z.infer<typeof staffPasswordSchema>
