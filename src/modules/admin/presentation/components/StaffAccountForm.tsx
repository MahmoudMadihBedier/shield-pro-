/**
 * System-Admin create / edit form for a staff login. Create makes the Auth
 * account (email + password) and the `public.users` profile in one step;
 * edit adjusts data, roles and responsibilities and (separately) resets the
 * password. All writes go through the `staff-account` Edge Function.
 */
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'

import type { AppError } from '@/core/errors'
import { isErr } from '@/core/result'
import {
  createStaffAccount,
  resetStaffPassword,
  updateStaffAccount,
} from '@/infrastructure/appwrite/functions'
import { Button } from '@/shared/ui'

import { warehousesRepo } from '../../data/repos'
import { WAREHOUSE_KIND_LABELS } from '../../domain/labels'
import { parseRoles, ROLE_OPTIONS } from '../../domain/staff'
import {
  staffCreateSchema,
  staffUpdateSchema,
  type StaffCreateInput,
  type StaffUpdateInput,
} from '../../domain/staff'
import type { User } from '../../domain/schemas'
import { useRelationOptions } from '../hooks/useRelationOptions'

const FIELD =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3 py-2 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25'
const LABEL = 'mb-1 block text-xs font-medium text-[var(--text-muted)]'
const ERR = 'mt-1 block text-xs font-medium text-red-600'

export interface StaffAccountFormProps {
  mode: 'create' | 'edit'
  row?: User
  onDone: () => void
}

function useWarehouseOptions() {
  return useQuery({
    queryKey: ['admin', 'warehouse-options', 'all-active'],
    staleTime: 60_000,
    queryFn: async () => {
      const res = await warehousesRepo.list({
        page: 0,
        pageSize: 300,
        sort: { field: 'name', dir: 'asc' },
        filters: [{ field: 'is_active', value: 'true' }],
      })
      if (isErr(res)) throw res.error
      return res.value.rows.map((w) => ({
        value: w.$id,
        label: `${w.name} · ${WAREHOUSE_KIND_LABELS[w.kind]?.ar ?? w.kind}`,
      }))
    },
  })
}

function RolesField({
  value,
  onChange,
  error,
}: {
  value: string[]
  onChange: (next: string[]) => void
  error?: string
}) {
  const toggle = (role: string) =>
    onChange(value.includes(role) ? value.filter((r) => r !== role) : [...value, role])
  return (
    <div>
      <span className={LABEL}>الوظيفة / Roles</span>
      <div className="grid gap-1 rounded-lg border border-[var(--border)] p-2 sm:grid-cols-2">
        {ROLE_OPTIONS.map((opt) => (
          <label key={opt.value} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded accent-brand-600"
              checked={value.includes(opt.value)}
              onChange={() => toggle(opt.value)}
            />
            <span>{opt.label}</span>
          </label>
        ))}
      </div>
      {error ? <span className={ERR}>{error}</span> : null}
    </div>
  )
}

export function StaffAccountForm({ mode, row, onDone }: StaffAccountFormProps) {
  const queryClient = useQueryClient()
  const branches = useRelationOptions('branch')
  const warehouses = useWarehouseOptions()
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['admin', 'list', 'user'] })

  if (mode === 'edit' && row) {
    return (
      <EditForm
        row={row}
        branchOptions={branches.data ?? []}
        subWarehouseOptions={warehouses.data ?? []}
        onSaved={() => {
          void invalidate()
          onDone()
        }}
      />
    )
  }

  return (
    <CreateForm
      branchOptions={branches.data ?? []}
      subWarehouseOptions={warehouses.data ?? []}
      onSaved={() => {
        void invalidate()
        onDone()
      }}
    />
  )
}

interface OptionList {
  branchOptions: { value: string; label: string }[]
  subWarehouseOptions: { value: string; label: string }[]
}

function CreateForm({
  branchOptions,
  subWarehouseOptions,
  onSaved,
}: OptionList & { onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffCreateInput>({
    resolver: zodResolver(staffCreateSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      roles: [],
      branch_id: '',
      sub_warehouse_id: '',
      job_grade: '',
    },
  })
  const roles = useWatch({ control, name: 'roles' })

  const onSubmit = handleSubmit(async (values) => {
    const res = await createStaffAccount({
      fullName: values.full_name,
      email: values.email,
      password: values.password,
      roles: values.roles,
      branchId: values.branch_id || undefined,
      subWarehouseId: values.sub_warehouse_id || undefined,
      jobGrade: values.job_grade || undefined,
    })
    if (isErr(res)) {
      setError('root', { message: res.error.message })
      return
    }
    onSaved()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="الاسم الكامل / Full name" error={errors.full_name?.message}>
        <input className={FIELD} {...register('full_name')} />
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="البريد الإلكتروني / Email" error={errors.email?.message}>
          <input className={FIELD} dir="ltr" autoComplete="off" {...register('email')} />
        </Field>
        <Field label="كلمة المرور / Password" error={errors.password?.message}>
          <input
            className={FIELD}
            dir="ltr"
            type="password"
            autoComplete="new-password"
            {...register('password')}
          />
        </Field>
      </div>

      <RolesField
        value={roles ?? []}
        onChange={(next) =>
          setValue('roles', next as StaffCreateInput['roles'], { shouldValidate: true })
        }
        error={errors.roles?.message as string | undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الفرع / Branch" error={errors.branch_id?.message}>
          <select className={FIELD} {...register('branch_id')}>
            <option value="">— بدون —</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المخزن / Warehouse" error={errors.sub_warehouse_id?.message}>
          <select className={FIELD} {...register('sub_warehouse_id')}>
            <option value="">— بدون —</option>
            {subWarehouseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="الدرجة الوظيفية / Job grade" error={errors.job_grade?.message}>
        <input className={FIELD} {...register('job_grade')} />
      </Field>

      {errors.root ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" loading={isSubmitting}>
          إنشاء الحساب
        </Button>
      </div>
    </form>
  )
}

function EditForm({
  row,
  branchOptions,
  subWarehouseOptions,
  onSaved,
}: OptionList & { row: User; onSaved: () => void }) {
  const {
    register,
    handleSubmit,
    setValue,
    control,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<StaffUpdateInput>({
    resolver: zodResolver(staffUpdateSchema),
    defaultValues: {
      full_name: row.full_name,
      email: '',
      roles: parseRoles(row.roles),
      branch_id: row.branch_id ?? '',
      sub_warehouse_id: row.sub_warehouse_id ?? '',
      job_grade: row.job_grade ?? '',
      is_active: row.is_active,
    },
  })
  const roles = useWatch({ control, name: 'roles' })

  const onSubmit = handleSubmit(async (values) => {
    const res = await updateStaffAccount({
      userId: row.$id,
      fullName: values.full_name,
      email: values.email,
      roles: values.roles,
      branchId: values.branch_id || undefined,
      subWarehouseId: values.sub_warehouse_id || undefined,
      jobGrade: values.job_grade || undefined,
      isActive: values.is_active,
    })
    if (isErr(res)) {
      setError('root', { message: res.error.message })
      return
    }
    onSaved()
  })

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <Field label="الاسم الكامل / Full name" error={errors.full_name?.message}>
        <input className={FIELD} {...register('full_name')} />
      </Field>
      <Field
        label="البريد الإلكتروني / Email — اتركه فارغًا للإبقاء عليه"
        error={errors.email?.message}
      >
        <input
          className={FIELD}
          dir="ltr"
          autoComplete="off"
          placeholder="بريد جديد لتغيير اسم الدخول"
          {...register('email')}
        />
      </Field>

      <RolesField
        value={roles ?? []}
        onChange={(next) =>
          setValue('roles', next as StaffUpdateInput['roles'], { shouldValidate: true })
        }
        error={errors.roles?.message as string | undefined}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="الفرع / Branch" error={errors.branch_id?.message}>
          <select className={FIELD} {...register('branch_id')}>
            <option value="">— بدون —</option>
            {branchOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="المخزن / Warehouse" error={errors.sub_warehouse_id?.message}>
          <select className={FIELD} {...register('sub_warehouse_id')}>
            <option value="">— بدون —</option>
            {subWarehouseOptions.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="الدرجة الوظيفية / Job grade" error={errors.job_grade?.message}>
        <input className={FIELD} {...register('job_grade')} />
      </Field>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="size-4 rounded accent-brand-600"
          {...register('is_active')}
        />
        <span>الحساب مُفعّل / Active (تعطيله يمنع الدخول)</span>
      </label>

      {errors.root ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
          {errors.root.message}
        </p>
      ) : null}

      <div className="flex justify-end gap-2 pt-1">
        <Button type="submit" loading={isSubmitting}>
          حفظ التغييرات
        </Button>
      </div>

      <ResetPasswordRow userId={row.$id} />
    </form>
  )
}

function ResetPasswordRow({ userId }: { userId: string }) {
  const [pw, setPw] = useState('')
  const mutation = useMutation<unknown, AppError, string>({
    mutationFn: async (password) => {
      const res = await resetStaffPassword(userId, password)
      if (isErr(res)) throw res.error
    },
    onSuccess: () => setPw(''),
  })
  return (
    <div className="mt-2 border-t border-[var(--border)] pt-3">
      <span className={LABEL}>إعادة تعيين كلمة المرور / Reset password</span>
      <div className="flex flex-wrap items-center gap-2">
        <input
          className={`${FIELD} max-w-xs`}
          dir="ltr"
          type="password"
          autoComplete="new-password"
          placeholder="كلمة مرور جديدة (8 أحرف على الأقل)"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={pw.length < 8 || mutation.isPending}
          onClick={() => mutation.mutate(pw)}
        >
          {mutation.isPending ? '…' : 'تعيين'}
        </Button>
        {mutation.isSuccess ? (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">تم التحديث</span>
        ) : null}
        {mutation.isError ? <span className={ERR}>{mutation.error.message}</span> : null}
      </div>
    </div>
  )
}

function Field({
  label,
  error,
  children,
}: {
  label: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <label className="block">
      <span className={LABEL}>{label}</span>
      {children}
      {error ? <span className={ERR}>{error}</span> : null}
    </label>
  )
}
