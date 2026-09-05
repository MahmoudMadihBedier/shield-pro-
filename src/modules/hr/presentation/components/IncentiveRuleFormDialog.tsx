/**
 * Create/edit dialog for one `incentive_rules` row. The predicate JSON column
 * is edited as plain structured fields (per `kind`) and serialised on submit —
 * the operator never types raw JSON.
 */
import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { CheckboxField, Form, FormError, NumberField, SelectField, TextField } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { parseIncentivePredicate, serializeIncentivePredicate } from '../../domain/incentives'
import { INCENTIVE_KINDS, incentiveKindSchema, type IncentiveKind, type IncentiveRule } from '../../domain/schemas'
import { useIncentiveRuleMutations } from '../hooks'
import { Dialog } from './Dialog'

const KIND_LABEL: Record<IncentiveKind, string> = {
  sales_commission: 'عمولة مبيعات',
  production_bonus: 'مكافأة إنتاج',
  attendance_bonus: 'مكافأة حضور',
}

/**
 * The predicate fields are plain required numbers defaulting to 0 (Zod's
 * output type must match its input type for the shared `Form` component, so
 * an `optional()` + `preprocess` combo — needed to tolerate `NumberField`'s
 * `NaN`-on-empty — is not usable here). 0 reads as "no threshold" wherever
 * `evaluateIncentive` consults it, so this is not a behavioural loss.
 */
const formSchema = z.object({
  name: z.string().trim().min(1, 'اسم القاعدة مطلوب').max(128, 'اسم القاعدة طويل جدًا'),
  kind: incentiveKindSchema,
  amount_or_pct: z.number({ error: 'أدخل رقمًا صحيحًا' }).min(0, 'يجب ألا تكون القيمة سالبة'),
  is_active: z.boolean(),
  minSalesAmount: z.number({ error: 'أدخل رقمًا صحيحًا' }).min(0),
  ratePct: z.number({ error: 'أدخل رقمًا صحيحًا' }).min(0).max(100),
  minUnitsProduced: z.number({ error: 'أدخل رقمًا صحيحًا' }).min(0),
  minAttendanceDays: z.number({ error: 'أدخل رقمًا صحيحًا' }).min(0),
  flatAmount: z.number({ error: 'أدخل رقمًا صحيحًا' }).min(0),
})
type FormValues = z.infer<typeof formSchema>

function buildDefaults(row: IncentiveRule | undefined): FormValues {
  const predicate = parseIncentivePredicate(row?.predicate)
  return {
    name: row?.name ?? '',
    kind: row?.kind ?? 'sales_commission',
    amount_or_pct: row?.amount_or_pct ?? 0,
    is_active: row?.is_active ?? true,
    minSalesAmount: predicate.minSalesAmount ?? 0,
    ratePct: predicate.ratePct ?? 0,
    minUnitsProduced: predicate.minUnitsProduced ?? 0,
    minAttendanceDays: predicate.minAttendanceDays ?? 0,
    flatAmount: predicate.flatAmount ?? 0,
  }
}

/** Reads the live `kind` selection so the predicate fields below it can react. */
function KindFields() {
  const { watch } = useFormContext<FormValues>()
  const kind = watch('kind') ?? 'sales_commission'

  if (kind === 'sales_commission') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField name="minSalesAmount" label="حد المبيعات الأدنى" labelEn="Min sales amount" min={0} />
        <NumberField name="ratePct" label="نسبة العمولة %" labelEn="Rate %" min={0} max={100} />
      </div>
    )
  }
  if (kind === 'production_bonus') {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <NumberField
          name="minUnitsProduced"
          label="حد الوحدات المُنتجة"
          labelEn="Min units produced"
          min={0}
        />
        <NumberField name="flatAmount" label="مبلغ ثابت" labelEn="Flat amount" min={0} />
      </div>
    )
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <NumberField
        name="minAttendanceDays"
        label="حد أيام الحضور"
        labelEn="Min attendance days"
        min={0}
      />
      <NumberField name="flatAmount" label="مبلغ ثابت" labelEn="Flat amount" min={0} />
    </div>
  )
}

export interface IncentiveRuleFormDialogProps {
  open: boolean
  row?: IncentiveRule
  onClose: () => void
}

export function IncentiveRuleFormDialog({ open, row, onClose }: IncentiveRuleFormDialogProps) {
  const mutations = useIncentiveRuleMutations()
  const defaults = useMemo(() => buildDefaults(row), [row])
  const mode = row ? 'edit' : 'create'

  async function handleSubmit(values: FormValues): Promise<Result<unknown>> {
    const predicate = serializeIncentivePredicate({
      minSalesAmount: values.minSalesAmount,
      ratePct: values.ratePct,
      minUnitsProduced: values.minUnitsProduced,
      minAttendanceDays: values.minAttendanceDays,
      flatAmount: values.flatAmount,
    })
    const payload = {
      name: values.name,
      kind: values.kind,
      amount_or_pct: values.amount_or_pct,
      is_active: values.is_active,
      predicate,
    }
    try {
      if (mode === 'create') {
        await mutations.create(payload)
      } else if (row) {
        await mutations.update({ id: row.$id, patch: payload })
      }
      onClose()
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ قاعدة الحافز. حاول مرة أخرى.'))
    }
  }

  return (
    <Dialog
      open={open}
      title={mode === 'create' ? 'قاعدة حافز جديدة' : 'تعديل قاعدة الحافز'}
      titleEn={mode === 'create' ? 'New incentive rule' : 'Edit incentive rule'}
      onClose={onClose}
    >
      <Form schema={formSchema} defaultValues={defaults} onSubmit={handleSubmit} className="space-y-4">
        {({ formError, isSubmitting }) => (
          <>
            <TextField name="name" label="اسم القاعدة" labelEn="Name" required />
            <SelectField
              name="kind"
              label="النوع"
              labelEn="Kind"
              required
              options={INCENTIVE_KINDS.map((kind) => ({ value: kind, label: KIND_LABEL[kind] }))}
            />
            <NumberField
              name="amount_or_pct"
              label="القيمة الافتراضية (نسبة أو مبلغ)"
              labelEn="Default amount / %"
              min={0}
              hint="تُستخدم إن لم يحدد الحقل أدناه نسبة/مبلغًا خاصًا به."
            />
            <KindFields />
            <CheckboxField name="is_active" label="فعّالة" labelEn="Active" />

            <FormError message={formError} />
            <div className="flex items-center justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                إلغاء
              </Button>
              <Button type="submit" disabled={isSubmitting || mutations.isPending}>
                {isSubmitting ? 'جارٍ الحفظ…' : mode === 'create' ? 'إضافة' : 'حفظ'}
              </Button>
            </div>
          </>
        )}
      </Form>
    </Dialog>
  )
}
