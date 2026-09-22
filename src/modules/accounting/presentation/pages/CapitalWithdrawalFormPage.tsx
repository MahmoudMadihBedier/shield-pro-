/**
 * Create / edit form for a capital withdrawal Draft. `method` picks a
 * sensible default GL source account (`DEFAULT_SOURCE_ACCOUNT`); the
 * accountant can edit it. On submit the document posts
 * `Dr owners_drawings / Cr <source_account>` — the capital account itself is
 * never touched directly.
 *
 * Two hosts: the standalone `/accounting/capital-withdrawals/new` route (no
 * `onDone`), and a `Dialog` opened from the detail page to edit a still-Draft
 * row (`mode="edit"`, `withdrawal`, `onDone` all given).
 */
import { useEffect } from 'react'
import { useFormContext, type DefaultValues } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { CASH_LIKE_ACCOUNTS } from '@/core/accounts'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, NumberField, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { CAPITAL_WITHDRAWAL_METHOD_OPTIONS } from '../../domain/labels'
import {
  DEFAULT_SOURCE_ACCOUNT,
  capitalWithdrawalFormSchema,
  type CapitalWithdrawal,
  type CapitalWithdrawalMethod,
  type CapitalWithdrawalForm as FormValues,
} from '../../domain/schemas'
import { useAccountOptions, useAccountingPermissions, useCapitalWithdrawalActions } from '../hooks'

const DEFAULTS: FormValues = {
  withdrawn_by: '',
  method: 'cash',
  reason: '',
  amount: 0,
  source_account: DEFAULT_SOURCE_ACCOUNT.cash,
}

/**
 * When `method` changes and `source_account` still holds a default, follow
 * it. Also re-applies the field's current value once the (async-loaded)
 * account options arrive — see `AssetAccountSync` in the sibling contribution
 * form page for why this second effect is needed.
 */
function SourceAccountSync({ accountsLoaded }: { accountsLoaded: boolean }) {
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
  useEffect(() => {
    if (!accountsLoaded) return
    setValue('source_account', getValues('source_account'))
  }, [accountsLoaded, getValues, setValue])
  return null
}

export interface CapitalWithdrawalFormPageProps {
  mode?: 'create' | 'edit'
  /** The Draft being edited. Required when `mode === 'edit'`. */
  withdrawal?: CapitalWithdrawal
  /** Given when hosted in a `Dialog` (edit flow); omitted for the standalone route. */
  onDone?: () => void
}

export function CapitalWithdrawalFormPage({
  mode = 'create',
  withdrawal,
  onDone,
}: CapitalWithdrawalFormPageProps = {}) {
  const navigate = useNavigate()
  const perms = useAccountingPermissions()
  const { createDraft, updateDraft } = useCapitalWithdrawalActions()
  const assetAccounts = useAccountOptions(['asset'])
  // A withdrawal only ever leaves from where cash physically sits — never a
  // fixed-asset account, even though both share account_type 'asset'.
  const cashAccounts = (assetAccounts.data ?? []).filter((o) =>
    (CASH_LIKE_ACCOUNTS as readonly string[]).includes(o.value),
  )

  const defaults: FormValues = withdrawal
    ? {
        withdrawn_by: withdrawal.withdrawn_by,
        method: withdrawal.method,
        reason: withdrawal.reason ?? '',
        amount: withdrawal.amount,
        source_account: withdrawal.source_account,
      }
    : DEFAULTS

  function goBack() {
    if (onDone) onDone()
    else navigate('/accounting/capital-withdrawals')
  }

  async function handleSubmit(values: FormValues): Promise<Result<unknown>> {
    const fields = {
      withdrawn_by: values.withdrawn_by.trim(),
      method: values.method,
      reason: values.reason?.trim() ? values.reason.trim() : null,
      amount: values.amount,
      source_account: values.source_account.trim(),
    }
    try {
      if (mode === 'edit' && withdrawal) {
        await updateDraft.mutateAsync({ id: withdrawal.$id, patch: fields })
        onDone?.()
      } else {
        const row = await createDraft.mutateAsync({ fields })
        if (onDone) onDone()
        else navigate(`/accounting/capital-withdrawals/${row.$id}`)
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
          لا تملك صلاحية تسجيل سحب رأس المال.
        </Card>
      ) : (
        <Card>
          <Form
            schema={capitalWithdrawalFormSchema}
            defaultValues={defaults as DefaultValues<FormValues>}
            onSubmit={handleSubmit}
            className="space-y-4"
          >
            {({ formError, isSubmitting }) => (
              <>
                <SourceAccountSync accountsLoaded={!assetAccounts.isLoading} />
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
                  <SelectField
                    name="source_account"
                    label="حساب المصدر (دائن)"
                    labelEn="Source account (credit)"
                    required
                    options={cashAccounts}
                    disabled={assetAccounts.isLoading}
                    placeholder={
                      assetAccounts.isError
                        ? 'تعذّر تحميل الحسابات'
                        : assetAccounts.isLoading
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
        title="سحب رأس مال جديد"
        titleEn="New capital withdrawal"
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
