/**
 * Staff-facing customer activity log — a timeline of logged interactions
 * (call / visit / WhatsApp / complaint / …) plus an inline "add" form. Drop it
 * onto a customer detail view. Reads/writes `crm_activities` (branch-scoped
 * RLS, migration 0029); the row's `branch_id` is copied from the customer.
 */
import { useMemo, useState } from 'react'
import type { DefaultValues } from 'react-hook-form'

import { useAuth } from '@/application/auth/context'
import { appError, type AppError } from '@/core/errors'
import { isSystemAdmin } from '@/core/rbac'
import { err, ok, type Result } from '@/core/result'
import { formatDate } from '@/shared/formatters'
import { DateField, Form, FormError, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Badge, Button, Card } from '@/shared/ui'

import {
  ACTIVITY_KINDS,
  ACTIVITY_OUTCOMES,
  activityFormSchema,
  activityKindLabel,
  activityOutcomeLabel,
  countByKind,
  type ActivityForm,
} from '../domain/activity'
import { useCustomerActivities, useDeleteActivity, useLogActivity } from './useCustomerActivities'

export interface CustomerActivityLogProps {
  customer: { $id: string; name: string; branch_id?: string | null }
}

const KIND_TONE: Record<string, 'neutral' | 'warning' | 'danger'> = {
  complaint: 'danger',
  follow_up: 'warning',
}

function todayLocalDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function CustomerActivityLog({ customer }: CustomerActivityLogProps) {
  const { principal } = useAuth()
  const [adding, setAdding] = useState(false)

  const list = useCustomerActivities(customer.$id)
  const logMutation = useLogActivity(customer.$id)
  const deleteMutation = useDeleteActivity(customer.$id)

  const rows = list.data ?? []
  const summary = useMemo(() => countByKind(rows), [rows])
  const canDelete = (createdBy: string) =>
    principal != null && (isSystemAdmin(principal) || principal.userId === createdBy)

  const defaults: ActivityForm = {
    kind: 'call',
    subject: '',
    note: '',
    occurred_on: todayLocalDate(),
    outcome: '',
  }

  async function handleAdd(values: ActivityForm): Promise<Result<unknown>> {
    try {
      await logMutation.mutateAsync({
        customerId: customer.$id,
        createdBy: principal?.userId ?? '',
        branchId: customer.branch_id ?? null,
        kind: values.kind,
        subject: values.subject.trim(),
        note: values.note ?? null,
        // store as an ISO datetime at local midnight of the chosen day
        occurredAt: new Date(`${values.occurred_on}T00:00:00`).toISOString(),
        outcome: values.outcome || null,
      })
      setAdding(false)
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
        return err(e as AppError)
      }
      return err(appError('unknown', 'تعذّر حفظ النشاط. حاول مرة أخرى.'))
    }
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-sm font-semibold">سجل النشاط / Activity log</h3>
        {!adding ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            + تسجيل نشاط
          </Button>
        ) : null}
      </div>

      {summary.length > 0 ? (
        <p className="text-xs text-zinc-500">
          {summary.map(([kind, n]) => `${activityKindLabel(kind)}: ${n}`).join(' · ')}
        </p>
      ) : null}

      {adding ? (
        <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <Form<ActivityForm>
            schema={activityFormSchema}
            defaultValues={defaults as DefaultValues<ActivityForm>}
            onSubmit={handleAdd}
            className="space-y-3"
          >
            {({ formError, isSubmitting }) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    name="kind"
                    label="النوع"
                    labelEn="Kind"
                    required
                    options={ACTIVITY_KINDS.map((k) => ({ value: k, label: activityKindLabel(k) }))}
                  />
                  <DateField name="occurred_on" label="التاريخ" labelEn="Date" required />
                </div>
                <TextField name="subject" label="العنوان" labelEn="Subject" required />
                <TextAreaField name="note" label="تفاصيل" labelEn="Note" rows={3} />
                <SelectField
                  name="outcome"
                  label="النتيجة (اختياري)"
                  labelEn="Outcome"
                  placeholder="—"
                  options={ACTIVITY_OUTCOMES.map((o) => ({
                    value: o,
                    label: activityOutcomeLabel(o) ?? o,
                  }))}
                />
                <FormError message={formError} />
                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setAdding(false)}
                    disabled={isSubmitting}
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" size="sm" disabled={isSubmitting || logMutation.isPending}>
                    {isSubmitting ? 'جارٍ الحفظ…' : 'حفظ'}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </div>
      ) : null}

      {deleteMutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {deleteMutation.error.message}
        </p>
      ) : null}

      {list.isLoading ? (
        <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
      ) : list.isError ? (
        <p className="flex flex-col items-start gap-1 text-sm text-red-600 dark:text-red-400">
          {list.error.message}
          <button type="button" className="underline" onClick={() => void list.refetch()}>
            إعادة المحاولة
          </button>
        </p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-zinc-500">لا يوجد نشاط مسجّل لهذا العميل بعد.</p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
          {rows.map((row) => {
            const outcome = activityOutcomeLabel(row.outcome)
            return (
              <li key={row.$id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                <Badge tone={KIND_TONE[row.kind] ?? 'neutral'}>{activityKindLabel(row.kind)}</Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.subject}</p>
                  {row.note ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                      {row.note}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-zinc-400" dir="ltr">
                    {formatDate(row.occurred_at)}
                    {outcome ? ` · ${outcome}` : ''}
                  </p>
                </div>
                {canDelete(row.created_by) ? (
                  <button
                    type="button"
                    className="text-xs text-zinc-400 underline hover:text-red-600"
                    disabled={deleteMutation.isPending}
                    onClick={() => deleteMutation.mutate(row.$id)}
                  >
                    حذف
                  </button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
