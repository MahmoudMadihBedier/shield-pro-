/**
 * Staff-facing follow-up task list for a customer — "call back on <date>",
 * assigned to a staff member, open until marked done or cancelled. Drop it
 * onto a customer detail view. Reads/writes `crm_followups` (branch-scoped
 * RLS, migration 0030); `branch_id` is set server-side from the customer.
 */
import { useMemo, useState } from 'react'
import type { DefaultValues } from 'react-hook-form'

import { useAuth } from '@/application/auth/context'
import { appError, type AppError } from '@/core/errors'
import { isOwnerOrAdmin } from '@/core/rbac'
import { err, ok, type Result } from '@/core/result'
import { formatDate } from '@/shared/formatters'
import { DateField, Form, FormError, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Badge, Button, Card } from '@/shared/ui'

import { AssignToDefaulter } from './AssignToDefaulter'

import {
  countOverdue,
  followupFormSchema,
  followupStatusLabel,
  isOverdue,
  type FollowupForm,
} from '../domain/followup'
import {
  useCreateFollowup,
  useCustomerFollowups,
  useDeleteFollowup,
  useReopenFollowup,
  useSetFollowupStatus,
} from './useCustomerFollowups'
import { useStaffOptions } from './useStaffOptions'

export interface CustomerFollowupListProps {
  customer: { $id: string }
}

function todayLocalDate(): string {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function CustomerFollowupList({ customer }: CustomerFollowupListProps) {
  const { principal } = useAuth()
  const [adding, setAdding] = useState(false)

  const list = useCustomerFollowups(customer.$id)
  const staff = useStaffOptions()
  const createMutation = useCreateFollowup(customer.$id)
  const statusMutation = useSetFollowupStatus(customer.$id)
  const reopenMutation = useReopenFollowup(customer.$id)
  const deleteMutation = useDeleteFollowup(customer.$id)

  const rows = useMemo(() => list.data ?? [], [list.data])
  const overdueCount = useMemo(() => countOverdue(rows), [rows])
  const staffName = useMemo(
    () => new Map((staff.data ?? []).map((s) => [s.value, s.label])),
    [staff.data],
  )

  const [actionError, setActionError] = useState<AppError | null>(null)

  const canManage = (row: { created_by: string; assigned_to: string }) =>
    isOwnerOrAdmin(principal, row.created_by, row.assigned_to)
  const canDelete = (createdBy: string) => isOwnerOrAdmin(principal, createdBy)

  const defaults: FollowupForm = {
    title: '',
    notes: '',
    due_date: todayLocalDate(),
    assigned_to: principal?.userId ?? '',
  }

  async function handleAdd(values: FollowupForm): Promise<Result<unknown>> {
    try {
      await createMutation.mutateAsync({
        customerId: customer.$id,
        createdBy: principal?.userId ?? '',
        assignedTo: values.assigned_to,
        title: values.title.trim(),
        notes: values.notes ?? null,
        dueDate: values.due_date,
      })
      setAdding(false)
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) return err(e as AppError)
      return err(appError('unknown', 'تعذّر حفظ المتابعة. حاول مرة أخرى.'))
    }
  }

  const anyActionPending =
    statusMutation.isPending || reopenMutation.isPending || deleteMutation.isPending

  // Clear any stale error before firing a new action, so a banner from a
  // previous failed action never lingers next to a since-successful one.
  function runSetStatus(id: string, status: 'done' | 'cancelled') {
    setActionError(null)
    statusMutation.mutate(
      { id, status, doneBy: principal?.userId ?? '' },
      { onError: setActionError },
    )
  }
  function runReopen(id: string) {
    setActionError(null)
    reopenMutation.mutate(id, { onError: setActionError })
  }
  function runDelete(id: string) {
    setActionError(null)
    deleteMutation.mutate(id, { onError: setActionError })
  }

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">المتابعات / Follow-ups</h3>
          {overdueCount > 0 ? <Badge tone="danger">{overdueCount} متأخرة</Badge> : null}
        </div>
        {!adding ? (
          <Button size="sm" variant="secondary" onClick={() => setAdding(true)}>
            + متابعة جديدة
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="rounded-lg border border-black/10 p-3 dark:border-white/10">
          <Form<FollowupForm>
            schema={followupFormSchema}
            defaultValues={defaults as DefaultValues<FollowupForm>}
            onSubmit={handleAdd}
            className="space-y-3"
          >
            {({ formError, isSubmitting }) => (
              <>
                <AssignToDefaulter<FollowupForm>
                  options={staff.data ?? []}
                  selfId={principal?.userId ?? ''}
                />
                <TextField name="title" label="العنوان" labelEn="Title" required />
                <div className="grid gap-3 sm:grid-cols-2">
                  <DateField name="due_date" label="تاريخ الاستحقاق" labelEn="Due date" required />
                  <SelectField
                    name="assigned_to"
                    label="المسؤول"
                    labelEn="Assigned to"
                    required
                    options={staff.data ?? []}
                    placeholder={staff.isLoading ? 'جارٍ التحميل…' : 'اختر…'}
                  />
                </div>
                <TextAreaField name="notes" label="ملاحظات" labelEn="Notes" rows={3} />
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
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || createMutation.isPending}
                  >
                    {isSubmitting ? 'جارٍ الحفظ…' : 'حفظ'}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </div>
      ) : null}

      {actionError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {actionError.message}
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
        <p className="text-sm text-zinc-500">لا توجد متابعات لهذا العميل بعد.</p>
      ) : (
        <ul className="divide-y divide-black/5 text-sm dark:divide-white/5">
          {rows.map((row) => {
            const overdue = isOverdue(row)
            return (
              <li key={row.$id} className="flex flex-wrap items-start gap-x-3 gap-y-1 py-2">
                <Badge tone={overdue ? 'danger' : row.status === 'done' ? 'success' : 'neutral'}>
                  {overdue ? 'متأخرة' : followupStatusLabel(row.status)}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.title}</p>
                  {row.notes ? (
                    <p className="mt-0.5 whitespace-pre-wrap text-zinc-600 dark:text-zinc-400">
                      {row.notes}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-xs text-zinc-400" dir="ltr">
                    {formatDate(row.due_date)} · {staffName.get(row.assigned_to) ?? row.assigned_to}
                  </p>
                </div>
                {canManage(row) ? (
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    {row.status === 'open' ? (
                      <>
                        <button
                          type="button"
                          className="text-emerald-700 underline hover:no-underline dark:text-emerald-400"
                          disabled={anyActionPending}
                          onClick={() => runSetStatus(row.$id, 'done')}
                        >
                          إنجاز
                        </button>
                        <button
                          type="button"
                          className="text-zinc-500 underline hover:no-underline"
                          disabled={anyActionPending}
                          onClick={() => runSetStatus(row.$id, 'cancelled')}
                        >
                          إلغاء
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="text-zinc-500 underline hover:no-underline"
                        disabled={anyActionPending}
                        onClick={() => runReopen(row.$id)}
                      >
                        إعادة فتح
                      </button>
                    )}
                    {canDelete(row.created_by) ? (
                      <button
                        type="button"
                        className="text-zinc-400 underline hover:text-red-600"
                        disabled={anyActionPending}
                        onClick={() => runDelete(row.$id)}
                      >
                        حذف
                      </button>
                    ) : null}
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
