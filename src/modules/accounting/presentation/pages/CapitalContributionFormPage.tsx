/**
 * Create form for a capital contribution Draft. `asset_type` picks a sensible
 * default GL asset account (`DEFAULT_ASSET_ACCOUNT`); the accountant can edit
 * it. On submit the document posts `Dr <asset_account> / Cr owners_capital`.
 */
import { useEffect } from 'react'
import { useFormContext, type DefaultValues } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, NumberField, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { CAPITAL_ASSET_TYPE_OPTIONS } from '../../domain/labels'
import {
  DEFAULT_ASSET_ACCOUNT,
  capitalContributionFormSchema,
  type CapitalAssetType,
  type CapitalContributionForm as FormValues,
} from '../../domain/schemas'
import { useAccountingPermissions, useCapitalContributionActions } from '../hooks'

const DEFAULTS: FormValues = {
  contributor: '',
  asset_type: 'cash',
  description: '',
  amount: 0,
  asset_account: DEFAULT_ASSET_ACCOUNT.cash,
}

/** When `asset_type` changes and `asset_account` still holds a default, follow it. */
function AssetAccountSync() {
  const { watch, setValue, getValues } = useFormContext<FormValues>()
  const assetType = watch('asset_type')
  useEffect(() => {
    const current = getValues('asset_account')
    const isDefault = (Object.values(DEFAULT_ASSET_ACCOUNT) as string[]).includes(current)
    if (isDefault) {
      setValue('asset_account', DEFAULT_ASSET_ACCOUNT[assetType as CapitalAssetType], {
        shouldValidate: true,
      })
    }
  }, [assetType, getValues, setValue])
  return null
}

export function CapitalContributionFormPage() {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const { createDraft } = useCapitalContributionActions()

  async function handleSubmit(values: FormValues): Promise<Result<unknown>> {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          contributor: values.contributor.trim(),
          asset_type: values.asset_type,
          description: values.description?.trim() ? values.description.trim() : null,
          amount: values.amount,
          asset_account: values.asset_account.trim(),
        },
      })
      navigate(`/accounting/capital/${row.$id}`)
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
        title="إدخال رأس مال جديد"
        titleEn="New capital contribution"
        actions={
          <Button variant="ghost" onClick={() => navigate('/accounting/capital')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRecord ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل رأس المال.
        </Card>
      ) : (
        <Card>
          <Form
            schema={capitalContributionFormSchema}
            defaultValues={DEFAULTS as DefaultValues<FormValues>}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {({ formError, isSubmitting }) => (
              <>
                <AssetAccountSync />
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField name="contributor" label="المساهم" labelEn="Contributor" required />
                  <SelectField
                    name="asset_type"
                    label="نوع الأصل"
                    labelEn="Asset type"
                    required
                    options={CAPITAL_ASSET_TYPE_OPTIONS}
                  />
                </div>

                <TextAreaField
                  name="description"
                  label="الوصف"
                  labelEn="Description"
                  rows={2}
                  hint="مثال: سيارة تويوتا هايلكس 2022 لوحة 123، أو مبنى المصنع بالمنطقة الصناعية"
                />

                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField name="amount" label="القيمة" labelEn="Amount" required min={0} />
                  <TextField
                    name="asset_account"
                    label="حساب الأصل (مدين)"
                    labelEn="Asset account (debit)"
                    required
                  />
                </div>

                <FormError message={formError} />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => navigate('/accounting/capital')}
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
