/**
 * Create / edit form for a capital contribution Draft. `asset_type` picks a
 * sensible default GL asset account (`DEFAULT_ASSET_ACCOUNT`); the accountant
 * can edit it. On submit the document posts `Dr <asset_account> / Cr owners_capital`.
 *
 * Two hosts: the standalone `/accounting/capital/new` route (no `onDone` — a
 * plain full-page create form), and a `Dialog` opened from the detail page to
 * edit a still-Draft row (`mode="edit"`, `contribution`, `onDone` all given —
 * the page chrome is skipped since the dialog already has its own title bar).
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
  type CapitalContribution,
  type CapitalContributionForm as FormValues,
} from '../../domain/schemas'
import {
  useAccountOptions,
  useAccountingPermissions,
  useCapitalContributionActions,
} from '../hooks'

const DEFAULTS: FormValues = {
  contributor: '',
  asset_type: 'cash',
  description: '',
  amount: 0,
  asset_account: DEFAULT_ASSET_ACCOUNT.cash,
}

/**
 * When `asset_type` changes and `asset_account` still holds a default, follow
 * it. Also re-applies the field's current value once the (async-loaded)
 * account options arrive: the `<select>` is a native uncontrolled element, so
 * a value set before its matching `<option>` exists (mount-time default, or
 * an edit-mode prefill) never visually takes — `accountsLoaded` re-asserts it
 * once the option is actually there.
 */
function AssetAccountSync({ accountsLoaded }: { accountsLoaded: boolean }) {
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
  useEffect(() => {
    if (!accountsLoaded) return
    setValue('asset_account', getValues('asset_account'))
  }, [accountsLoaded, getValues, setValue])
  return null
}

export interface CapitalContributionFormPageProps {
  mode?: 'create' | 'edit'
  /** The Draft being edited. Required when `mode === 'edit'`. */
  contribution?: CapitalContribution
  /** Given when hosted in a `Dialog` (edit flow); omitted for the standalone route. */
  onDone?: () => void
}

export function CapitalContributionFormPage({
  mode = 'create',
  contribution,
  onDone,
}: CapitalContributionFormPageProps = {}) {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const { createDraft, updateDraft } = useCapitalContributionActions()
  const accounts = useAccountOptions(['asset'])

  const defaults: FormValues = contribution
    ? {
        contributor: contribution.contributor,
        asset_type: contribution.asset_type,
        description: contribution.description ?? '',
        amount: contribution.amount,
        asset_account: contribution.asset_account,
      }
    : DEFAULTS

  function goBack() {
    if (onDone) onDone()
    else navigate('/accounting/capital')
  }

  async function handleSubmit(values: FormValues): Promise<Result<unknown>> {
    const fields = {
      contributor: values.contributor.trim(),
      asset_type: values.asset_type,
      description: values.description?.trim() ? values.description.trim() : null,
      amount: values.amount,
      asset_account: values.asset_account.trim(),
    }
    try {
      if (mode === 'edit' && contribution) {
        await updateDraft.mutateAsync({ id: contribution.$id, patch: fields })
        onDone?.()
      } else {
        const row = await createDraft.mutateAsync({ fields })
        if (onDone) onDone()
        else navigate(`/accounting/capital/${row.$id}`)
      }
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
        return err(e as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ الإدخال. حاول مرة أخرى.'))
    }
  }

  const body = (
    <>
      {!perms.canRecord ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل رأس المال.
        </Card>
      ) : (
        <Card>
          <Form
            schema={capitalContributionFormSchema}
            defaultValues={defaults as DefaultValues<FormValues>}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {({ formError, isSubmitting }) => (
              <>
                <AssetAccountSync accountsLoaded={!accounts.isLoading} />
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
                  <SelectField
                    name="asset_account"
                    label="حساب الأصل (مدين)"
                    labelEn="Asset account (debit)"
                    required
                    options={accounts.data ?? []}
                    disabled={accounts.isLoading}
                    placeholder={
                      accounts.isError
                        ? 'تعذّر تحميل الحسابات'
                        : accounts.isLoading
                          ? 'جارٍ التحميل…'
                          : 'اختر الحساب…'
                    }
                  />
                </div>

                <FormError message={formError} />

                <div className="flex items-center justify-end gap-2 pt-2">
                  <Button type="button" variant="ghost" onClick={goBack} disabled={isSubmitting}>
                    إلغاء
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSubmitting || createDraft.isPending || updateDraft.isPending}
                  >
                    {isSubmitting ? 'جارٍ الحفظ…' : mode === 'edit' ? 'حفظ' : 'إنشاء مسودة'}
                  </Button>
                </div>
              </>
            )}
          </Form>
        </Card>
      )}
    </>
  )

  if (onDone) return <div className="space-y-4">{body}</div>

  return (
    <div className="space-y-4">
      <PageHeader
        title="إدخال رأس مال جديد"
        titleEn="New capital contribution"
        actions={
          <Button variant="ghost" onClick={goBack}>
            رجوع
          </Button>
        }
      />
      {body}
    </div>
  )
}
