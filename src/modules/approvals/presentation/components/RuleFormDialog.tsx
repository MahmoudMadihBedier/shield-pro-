/**
 * Create / edit dialog for one `approval_rules` row. `predicate` is rendered
 * as a structured mini-form over `ApprovalPredicate`'s fields (not a raw JSON
 * textarea) so a System Admin never has to hand-write JSON.
 */
import { useEffect, useRef } from 'react'
import { useFormContext, type DefaultValues } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Button } from '@/shared/ui'
import { CheckboxField, Form, FormError, NumberField, SelectField } from '@/shared/forms'

import {
  approvalRuleInputSchema,
  decodeApprovalPredicate,
  type ApprovalRuleInput,
  type ApprovalRuleRow,
} from '../../domain/schemas'
import { APPROVAL_ACTION_OPTIONS, MOVEMENT_TYPE_OPTIONS } from '../../domain/labels'
import { useApprovalRuleMutations } from '../hooks/useApprovalRules'

const CONTROL_CLASS =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15'

const EMPTY_INPUT: ApprovalRuleInput = {
  movement_type: '',
  predicate: {},
  action: 'auto_approve',
  priority: 100,
  is_active: true,
}

type PredicateNumberFieldName =
  | 'predicate.maxQtyMultipleOfRepAverage'
  | 'predicate.maxRepeatCount'
  | 'predicate.repeatWindowHours'

/** A number field for one *optional* predicate threshold — an empty box means
 *  "this condition is not part of the rule", not zero. */
function OptionalPredicateNumberField({
  name,
  label,
  labelEn,
  min,
}: {
  name: PredicateNumberFieldName
  label: string
  labelEn: string
  min?: number
}) {
  const {
    register,
    formState: { errors },
  } = useFormContext<ApprovalRuleInput>()
  const [, field] = name.split('.')
  const error = (errors.predicate as Record<string, { message?: string } | undefined> | undefined)?.[
    field ?? ''
  ]?.message

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-start text-zinc-600 dark:text-zinc-400">
        {label} <span className="text-zinc-400">/ {labelEn}</span>
      </span>
      <input
        type="number"
        dir="ltr"
        inputMode="decimal"
        min={min}
        step="any"
        placeholder="—"
        className={`${CONTROL_CLASS} text-start`}
        {...register(name, {
          setValueAs: (v: unknown) => (v === '' || v === null || v === undefined ? undefined : Number(v)),
        })}
      />
      {error ? (
        <span role="alert" className="mt-1 block text-start text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  )
}

function buildDefaults(row: ApprovalRuleRow | undefined): ApprovalRuleInput {
  if (!row) return EMPTY_INPUT
  return {
    movement_type: row.movement_type,
    predicate: decodeApprovalPredicate(row.predicate),
    action: row.action,
    priority: row.priority,
    is_active: row.is_active,
  }
}

export interface RuleFormDialogProps {
  open: boolean
  mode: 'create' | 'edit'
  row?: ApprovalRuleRow
  onClose: () => void
}

/** Thin modal wrapper around the native `<dialog>` element (mirrors the shape
 *  used across the app's other create/edit dialogs). RTL- and dark-mode aware. */
export function RuleFormDialog({ open, mode, row, onClose }: RuleFormDialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  if (!open) return null

  const title = mode === 'edit' ? 'تعديل قاعدة الموافقة' : 'قاعدة موافقة جديدة'
  const titleEn = mode === 'edit' ? 'Edit approval rule' : 'New approval rule'

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className="m-auto w-[min(36rem,92vw)] rounded-2xl border border-black/10 bg-white p-0 text-zinc-900 backdrop:bg-black/40 dark:border-white/10 dark:bg-zinc-900 dark:text-zinc-100"
    >
      <div className="flex items-start justify-between gap-4 border-b border-black/10 p-4 dark:border-white/10">
        <h3 className="text-base font-semibold">
          {title}
          <span className="text-zinc-400"> / {titleEn}</span>
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label="إغلاق"
          className="rounded-lg px-2 py-0.5 text-lg leading-none text-zinc-500 hover:bg-black/5 dark:hover:bg-white/10"
        >
          ×
        </button>
      </div>
      <div className="max-h-[75vh] overflow-y-auto p-4">
        <RuleForm mode={mode} row={row} onDone={onClose} />
      </div>
    </dialog>
  )
}

function RuleForm({
  mode,
  row,
  onDone,
}: {
  mode: 'create' | 'edit'
  row?: ApprovalRuleRow
  onDone: () => void
}) {
  const mutations = useApprovalRuleMutations()
  const defaults = buildDefaults(row)

  async function handleSubmit(values: ApprovalRuleInput): Promise<Result<unknown>> {
    try {
      if (mode === 'create') {
        await mutations.create(values)
      } else if (row) {
        await mutations.update({ id: row.$id, patch: values })
      }
      onDone()
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ القاعدة. حاول مرة أخرى.'))
    }
  }

  return (
    <Form
      schema={approvalRuleInputSchema}
      defaultValues={defaults as DefaultValues<ApprovalRuleInput>}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <div className="space-y-3">
            <SelectField
              name="movement_type"
              label="نوع الحركة"
              labelEn="Movement type"
              required
              options={MOVEMENT_TYPE_OPTIONS}
              placeholder="اختر…"
            />
            <SelectField
              name="action"
              label="الإجراء الافتراضي"
              labelEn="Default action"
              required
              options={APPROVAL_ACTION_OPTIONS}
              placeholder="اختر…"
            />
            <NumberField
              name="priority"
              label="الأولوية"
              labelEn="Priority"
              hint="الأصغر يُقيَّم أولًا"
              required
              min={0}
              step={1}
            />
            <CheckboxField name="is_active" label="القاعدة مفعّلة" labelEn="Rule is active" />

            <fieldset className="space-y-3 rounded-xl border border-black/10 p-3 dark:border-white/10">
              <legend className="px-1 text-xs font-medium text-zinc-500">
                شروط القاعدة / Rule conditions
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                <OptionalPredicateNumberField
                  name="predicate.maxQtyMultipleOfRepAverage"
                  label="أقصى مضاعف لمتوسط المندوب"
                  labelEn="Max × rep average"
                  min={0}
                />
                <OptionalPredicateNumberField
                  name="predicate.maxRepeatCount"
                  label="أقصى عدد تكرار"
                  labelEn="Max repeat count"
                  min={0}
                />
                <OptionalPredicateNumberField
                  name="predicate.repeatWindowHours"
                  label="نافذة التكرار (ساعات)"
                  labelEn="Repeat window (hours)"
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <CheckboxField
                  name="predicate.requireManualIfNewCustomer"
                  label="مراجعة يدوية لعميل جديد"
                  labelEn="Manual if new customer"
                />
                <CheckboxField
                  name="predicate.requireManualIfOverCreditLimit"
                  label="مراجعة يدوية عند تجاوز حد الائتمان"
                  labelEn="Manual if over credit limit"
                />
                <CheckboxField
                  name="predicate.requireManualIfPriceOverride"
                  label="مراجعة يدوية عند تجاوز السعر"
                  labelEn="Manual if price override"
                />
              </div>
            </fieldset>
          </div>
          <FormError message={formError} />
          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onDone} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'جارٍ الحفظ…' : mode === 'create' ? 'إضافة' : 'حفظ'}
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}
