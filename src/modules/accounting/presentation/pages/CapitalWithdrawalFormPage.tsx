/**
 * Create form for a capital withdrawal Draft. `method` picks a sensible
 * default GL source account (`DEFAULT_SOURCE_ACCOUNT`); the accountant can
 * edit it. On submit the document posts `Dr owners_drawings / Cr <source_account>`
 * — the capital account itself is never touched directly.
 */
import { useEffect } from 'react'
import { useFormContext, type DefaultValues } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, NumberField, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { CAPITAL_WITHDRAWAL_METHOD_OPTIONS } from '../../domain/labels'
import {
  DEFAULT_SOURCE_ACCOUNT,
  capitalWithdrawalFormSchema,
  type CapitalWithdrawalMethod,
  type CapitalWithdrawalForm as FormValues,
} from '../../domain/schemas'
import { useAccountingPermissions, useCapitalWithdrawalActions } from '../hooks'

const DEFAULTS: FormValues = {
  withdrawn_by: '',
  method: 'cash',
  reason: '',
  amount: 0,
  source_account: DEFAULT_SOURCE_ACCOUNT.cash,
}

/** When `method` changes and `source_account` still holds a default, follow it. */
function SourceAccountSync() {
  const { watch, setValue, getValues } = useFormContext<FormValues>()
  const method = watch('method')
  useEffect(() => {
    const current = getValues('source_account')
    const isDefault = (Object.values(DEFAULT_SOURCE_ACCOUNT) as string[]).includes(current)
    if (isDefault) {
      setValue('source_account', DEFAULT_SOURCE_ACCOUNT[method as CapitalWithdrawalMethod], {
        shouldValidate: true,
      })
    }
  }, [method, getValues, setValue])
  return null
}

export function CapitalWithdrawalFormPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const { createDraft } = useCapitalWithdrawalActions()

  async function handleSubmit(values: FormValues): Promise<Result<unknown>> {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          withdrawn_by: values.withdrawn_by.trim(),
          method: values.method,
          reason: values.reason?.trim() ? values.reason.trim() : null,
          amount: values.amount,
          source_account: values.source_account.trim(),
        },
      })
      navigate(`/accounting/capital-withdrawals/${row.$id}`)
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
        return err(e as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ الإدخال. حاول مرة أخرى.'))
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="سحب رأس مال جديد"
        titleEn="New capital withdrawal"
        actions={
          <Button variant="ghost" onClick={() => navigate('/accounting/capital-withdrawals')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRecord ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل سحب رأس المال.
        </Card>
      ) : (
        <Card>
          <Form
            schema={capitalWithdrawalFormSchema}
            defaultValues={DEFAULTS as DefaultValues<FormValues>}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {({ formError, isSubmitting }) => (
              <>
                <SourceAccountSync />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="withdrawn_by" label="المستفيد" labelEn="Withdrawn by" required />
                  <SelectField
                    name="method"
                    label="طريقة السحب"
                    labelEn="Method"
                    required
                    options={CAPITAL_WITHDRAWAL_METHOD_OPTIONS}
                  />
                </div>

                <TextAreaField
                  name="reason"
                  label="السبب"
                  labelEn="Reason"
                  rows={2}
                  hint="مثال: سحب شخصي للمالك، توزيع أرباح مبدئي"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField name="amount" label="القيمة" labelEn="Amount" required min={0} />
                  <TextField
                    name="source_account"
                    label="حساب المصدر (دائن)"
                    labelEn="Source account (credit)"
                    required
                  />
                </div>

                <FormError message={formError} />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/accounting/capital-withdrawals')}
                    disabled={isSubmitting}
                  >
                    إلغاء
                  </Button>
                  <Button type="submit" disabled={isSubmitting || createDraft.isPending}>
                    {isSubmitting ? 'جارٍ الحفظ…' : 'إنشاء مسودة'}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </Card>
      )}
    </div>
  )
}
