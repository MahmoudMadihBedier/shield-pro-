/**
 * One lead: editable fields, the stage control, the stage-change timeline
 * (migration 0034, written server-side — never synthesized client-side), and
 * the "won → link to customer" flow. `docs/CRM_PLAN.md` Phase A #1.
 */
import { useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import type { DefaultValues } from 'react-hook-form'

import { useAuth } from '@/application/auth/context'
import { isOwnerOrAdmin } from '@/core/rbac'
import { appError, type AppError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { formatCurrency, formatDateTime } from '@/shared/formatters'
import { Form, FormError, NumberField, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Badge, Button, Card, PageHeader } from '@/shared/ui'

import { useStaffOptions } from '../../admin/useStaffOptions'
import {
  LEAD_SOURCES,
  describeStageEvent,
  leadEditFormSchema,
  leadSourceLabel,
  leadStageLabel,
  type LeadEditForm,
} from '../../domain/lead'
import {
  useDeleteLead,
  useLead,
  useLeadStageEvents,
  useSetLeadStage,
  useUpdateLead,
} from '../hooks'
import { LeadConvertCell } from './LeadConvertCell'
import { LeadStageCell } from './LeadStageCell'

export function LeadDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const { principal } = useAuth()

  const lead = useLead(id || undefined)
  const events = useLeadStageEvents(id || undefined)
  const staff = useStaffOptions()
  const updateMutation = useUpdateLead(id)
  const stageMutation = useSetLeadStage()
  const deleteMutation = useDeleteLead()

  const staffName = useMemo(
    () => new Map((staff.data ?? []).map((s) => [s.value, s.label])),
    [staff.data],
  )

  if (lead.isLoading) return <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
  if (lead.isError) {
    return <Card className="text-sm text-red-600 dark:text-red-400">{lead.error.message}</Card>
  }
  const row = lead.data
  if (!row) return <Card className="text-sm text-zinc-500">لا يوجد عميل محتمل بهذا المعرّف.</Card>

  const canEdit = isOwnerOrAdmin(principal, row.created_by, row.assigned_to)
  const canDelete = isOwnerOrAdmin(principal, row.created_by)

  const defaults: LeadEditForm = {
    name: row.name,
    phone: row.phone ?? '',
    email: row.email ?? '',
    source: row.source ?? '',
    estimated_value: row.estimated_value ?? 0,
    notes: row.notes ?? '',
    assigned_to: row.assigned_to,
  }

  async function handleSave(values: LeadEditForm): Promise<Result<unknown>> {
    try {
      await updateMutation.mutateAsync({
        name: values.name.trim(),
        phone: values.phone ?? null,
        email: values.email ?? null,
        source: values.source || null,
        estimatedValue: values.estimated_value,
        notes: values.notes ?? null,
        assignedTo: values.assigned_to,
      })
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) return err(e as AppError)
      return err(appError('unknown', 'تعذّر حفظ التعديلات. حاول مرة أخرى.'))
    }
  }

  async function handleDelete() {
    if (!window.confirm('حذف هذا العميل المحتمل نهائيًا؟')) return
    await deleteMutation.mutateAsync(row!.$id)
    navigate('/crm/leads')
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title={row.name}
        titleEn="Lead"
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => navigate('/crm/leads')}>
              رجوع
            </Button>
            {canDelete ? (
              <Button
                variant="danger"
                disabled={deleteMutation.isPending}
                onClick={() => void handleDelete()}
              >
                حذف
              </Button>
            ) : null}
          </div>
        }
      />

      <Card className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-sm text-zinc-500">المرحلة</span>
          {canEdit ? (
            <LeadStageCell
              lead={row}
              pending={stageMutation.isPending}
              onChange={(stage, lostReason) =>
                stageMutation.mutate({ id: row.$id, stage, lostReason })
              }
            />
          ) : (
            <Badge tone="neutral">{leadStageLabel(row.stage)}</Badge>
          )}
        </div>
        <LeadConvertCell lead={row} />
      </Card>
      {stageMutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {stageMutation.error.message}
        </p>
      ) : null}
      {row.stage === 'lost' && row.lost_reason ? (
        <Card className="text-sm text-zinc-500">سبب الخسارة: {row.lost_reason}</Card>
      ) : null}

      <Card>
        <h3 className="mb-3 text-sm font-semibold">بيانات العميل المحتمل</h3>
        {canEdit && staff.isLoading ? (
          <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
        ) : canEdit ? (
          <Form<LeadEditForm>
            schema={leadEditFormSchema}
            defaultValues={defaults as DefaultValues<LeadEditForm>}
            onSubmit={handleSave}
            className="space-y-3"
          >
            {({ formError, isSubmitting }) => (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="name" label="الاسم" labelEn="Name" required />
                  <TextField name="phone" label="الهاتف" labelEn="Phone" dir="ltr" />
                  <TextField name="email" label="البريد الإلكتروني" labelEn="Email" dir="ltr" />
                  <SelectField
                    name="source"
                    label="المصدر (اختياري)"
                    labelEn="Source"
                    placeholder="—"
                    options={LEAD_SOURCES.map((s) => ({
                      value: s,
                      label: leadSourceLabel(s) ?? s,
                    }))}
                  />
                  <NumberField
                    name="estimated_value"
                    label="القيمة المتوقعة"
                    labelEn="Estimated value"
                    hint="اترك 0 إن لم يوجد تقدير"
                    min={0}
                  />
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
                    type="submit"
                    size="sm"
                    disabled={isSubmitting || updateMutation.isPending}
                  >
                    {isSubmitting ? 'جارٍ الحفظ…' : 'حفظ التعديلات'}
                  </Button>
                </div>
              </>
            )}
          </Form>
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Fact label="الهاتف" value={row.phone || '—'} dir="ltr" />
            <Fact label="البريد الإلكتروني" value={row.email || '—'} dir="ltr" />
            <Fact label="المصدر" value={leadSourceLabel(row.source) ?? '—'} />
            <Fact
              label="القيمة المتوقعة"
              value={formatCurrency(row.estimated_value ?? 0)}
              dir="ltr"
            />
            <Fact
              label="المسؤول"
              value={staffName.get(row.assigned_to) ?? row.assigned_to}
              dir="ltr"
            />
            {row.notes ? <Fact label="ملاحظات" value={row.notes} /> : null}
          </dl>
        )}
      </Card>

      <Card>
        <h3 className="mb-3 text-sm font-semibold">سجل المرحلة / Stage history</h3>
        {events.isLoading ? (
          <p className="text-sm text-zinc-500">جارٍ التحميل…</p>
        ) : events.isError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{events.error.message}</p>
        ) : !events.data || events.data.length === 0 ? (
          <p className="text-sm text-zinc-500">لا يوجد سجل بعد.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {events.data.map((e) => (
              <li
                key={e.$id}
                className="flex items-start justify-between gap-3 border-t border-black/5 pt-2 first:border-t-0 first:pt-0 dark:border-white/5"
              >
                <div>
                  <p>{describeStageEvent(e)}</p>
                  {e.reason ? <p className="text-xs text-zinc-500">سبب: {e.reason}</p> : null}
                </div>
                <span className="shrink-0 text-xs text-zinc-400" dir="ltr">
                  {formatDateTime(e.changed_at)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function Fact({ label, value, dir }: { label: string; value: string; dir?: 'ltr' | 'rtl' }) {
  return (
    <div>
      <span className="block text-zinc-500">{label}</span>
      <span dir={dir}>{value}</span>
    </div>
  )
}
