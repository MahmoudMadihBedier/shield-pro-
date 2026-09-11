/**
 * Leads / opportunity pipeline — Phase 3+ staff CRM. A prospective customer
 * not yet in `customers`, tracked new → contacted → qualified → won/lost.
 * Converting to a real customer is a manual step (mandatory business fields —
 * geo, code, credit terms — belong in the normal Customers form, not defaulted
 * silently here); a won lead can then be linked back via a customer picker.
 */
import { useMemo, useState } from 'react'
import type { DefaultValues } from 'react-hook-form'

import { useAuth } from '@/application/auth/context'
import { isSystemAdmin } from '@/core/rbac'
import { appError, type AppError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { formatCurrency, formatDate } from '@/shared/formatters'
import { DataTable, type ColumnDef } from '@/shared/data-table'
import { Form, FormError, NumberField, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { useStaffOptions } from '../../admin/useStaffOptions'
import {
  LEAD_SOURCES,
  LEAD_STAGES,
  isOpenStage,
  leadFormSchema,
  leadSourceLabel,
  leadStageLabel,
  openPipelineValue,
  type LeadForm,
  type LeadRow,
  type LeadStage,
} from '../../domain/lead'
import { useCreateLead, useDeleteLead, useLeads, useSetLeadStage } from '../hooks'
import { LeadConvertCell } from './LeadConvertCell'

export function LeadsListPage() {
  const { principal } = useAuth()
  const [adding, setAdding] = useState(false)
  const [stageFilter, setStageFilter] = useState<'all' | LeadStage>('all')

  const list = useLeads()
  const staff = useStaffOptions()
  const createMutation = useCreateLead()
  const stageMutation = useSetLeadStage()
  const deleteMutation = useDeleteLead()

  const rows = list.data ?? []
  const filteredRows = useMemo(
    () => (stageFilter === 'all' ? rows : rows.filter((r) => r.stage === stageFilter)),
    [rows, stageFilter],
  )
  const staffName = useMemo(
    () => new Map((staff.data ?? []).map((s) => [s.value, s.label])),
    [staff.data],
  )
  const pipelineValue = useMemo(() => openPipelineValue(rows), [rows])

  const canDelete = (createdBy: string) =>
    principal != null && (isSystemAdmin(principal) || principal.userId === createdBy)

  const defaults: LeadForm = {
    name: '',
    phone: '',
    email: '',
    source: '',
    notes: '',
    assigned_to: principal?.userId ?? '',
  }

  async function handleAdd(values: LeadForm): Promise<Result<unknown>> {
    try {
      await createMutation.mutateAsync({
        createdBy: principal?.userId ?? '',
        assignedTo: values.assigned_to,
        name: values.name.trim(),
        phone: values.phone ?? null,
        email: values.email ?? null,
        source: values.source || null,
        estimatedValue: values.estimated_value ?? null,
        notes: values.notes ?? null,
      })
      setAdding(false)
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) return err(e as AppError)
      return err(appError('unknown', 'تعذّر حفظ العميل المحتمل. حاول مرة أخرى.'))
    }
  }

  const columns: ColumnDef<LeadRow>[] = [
    {
      id: 'name',
      header: 'الاسم / Name',
      accessor: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{r.name}</p>
          <p className="truncate text-xs text-zinc-400" dir="ltr">
            {[r.phone, r.email].filter(Boolean).join(' · ') || '—'}
          </p>
        </div>
      ),
      width: 'minmax(12rem, 1.4fr)',
    },
    {
      id: 'stage',
      header: 'المرحلة / Stage',
      accessor: (r) => r.stage,
      cell: (r) => (
        <select
          value={r.stage}
          disabled={stageMutation.isPending}
          onChange={(e) => {
            const next = e.target.value as LeadStage
            const lostReason =
              next === 'lost' ? (window.prompt('سبب الخسارة (اختياري):') ?? '') : undefined
            stageMutation.mutate({ id: r.$id, stage: next, lostReason })
          }}
          className="rounded-lg border border-black/15 bg-transparent px-2 py-1 text-xs dark:border-white/15"
        >
          {LEAD_STAGES.map((s) => (
            <option key={s} value={s}>
              {leadStageLabel(s)}
            </option>
          ))}
        </select>
      ),
      width: '10rem',
    },
    {
      id: 'source',
      header: 'المصدر / Source',
      accessor: (r) => r.source ?? '',
      cell: (r) => leadSourceLabel(r.source) ?? '—',
      width: '8rem',
    },
    {
      id: 'value',
      header: 'القيمة المتوقعة / Value',
      accessor: (r) => r.estimated_value ?? 0,
      align: 'end',
      cell: (r) =>
        r.estimated_value ? (
          <span dir="ltr" className="tabular-nums">
            {formatCurrency(r.estimated_value)}
          </span>
        ) : (
          '—'
        ),
      width: '8rem',
    },
    {
      id: 'assigned',
      header: 'المسؤول / Owner',
      accessor: (r) => r.assigned_to,
      cell: (r) => staffName.get(r.assigned_to) ?? r.assigned_to,
      width: '9rem',
    },
    {
      id: 'created',
      header: 'التاريخ / Date',
      accessor: (r) => r.$createdAt,
      align: 'end',
      cell: (r) => (
        <span dir="ltr" className="text-zinc-500">
          {formatDate(r.$createdAt)}
        </span>
      ),
      width: '7rem',
    },
    {
      id: '__actions',
      header: '',
      accessor: () => null,
      align: 'end',
      width: 'minmax(10rem, 1fr)',
      cell: (r) => (
        <div className="flex items-center justify-end gap-2">
          <LeadConvertCell lead={r} />
          {canDelete(r.created_by) ? (
            <button
              type="button"
              className="text-xs text-zinc-400 underline hover:text-red-600"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(r.$id)}
            >
              حذف
            </button>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <PageHeader
        title="العملاء المحتملون"
        titleEn="Leads pipeline"
        description="من عميل محتمل إلى صفقة: تتبّع التواصل حتى التحويل إلى عميل فعلي."
        actions={
          !adding ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              + عميل محتمل جديد
            </Button>
          ) : undefined
        }
      />

      <Card className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-sm text-zinc-500">
          قيمة الفرص المفتوحة / Open pipeline value (
          {rows.filter((r) => isOpenStage(r.stage)).length} فرصة)
        </span>
        <span className="text-lg font-bold tabular-nums" dir="ltr">
          {formatCurrency(pipelineValue)}
        </span>
      </Card>

      {adding ? (
        <Card>
          <Form<LeadForm>
            schema={leadFormSchema}
            defaultValues={defaults as DefaultValues<LeadForm>}
            onSubmit={handleAdd}
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
                    label="القيمة المتوقعة (اختياري)"
                    labelEn="Estimated value"
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
                <TextAreaField name="notes" label="ملاحظات" labelEn="Notes" rows={2} />
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
        </Card>
      ) : null}

      {stageMutation.isError || deleteMutation.isError ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {(stageMutation.error ?? deleteMutation.error)?.message}
        </p>
      ) : null}

      <DataTable
        columns={columns}
        rows={filteredRows}
        getRowId={(r) => r.$id}
        isLoading={list.isLoading}
        error={list.isError ? list.error : null}
        onRetry={() => void list.refetch()}
        emptyMessage="لا يوجد عملاء محتملون بهذه المرحلة."
        toolbar={
          <select
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value as 'all' | LeadStage)}
            className="rounded-lg border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
          >
            <option value="all">كل المراحل</option>
            {LEAD_STAGES.map((s) => (
              <option key={s} value={s}>
                {leadStageLabel(s)}
              </option>
            ))}
          </select>
        }
      />
    </div>
  )
}
