/** Create a rep stock-issue Draft: sub-warehouse, rep, and the issue lines. */
import { useMemo } from 'react'
import { useFormContext, type DefaultValues } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, SelectField } from '@/shared/forms'
import type { SelectOption } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { canActOnSales } from '../../domain/permissions'
import {
  repStockIssueDraftSchema,
  serializeJsonArray,
  type RepStockIssueDraft,
} from '../../domain/schemas'
import { RepIssueLineEditor } from '../components'
import {
  useProductOptions,
  useRepOptions,
  useRepStockIssueActions,
  useSubWarehouseOptions,
} from '../hooks'

const DEFAULTS: RepStockIssueDraft = { sub_warehouse_id: '', rep_user_id: '', lines: [] }

export function RepStockIssueFormPage() {
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnSales(principal)

  const subWarehouses = useSubWarehouseOptions()
  const reps = useRepOptions()
  const products = useProductOptions()
  const { createDraft } = useRepStockIssueActions()

  const productOptions = useMemo<SelectOption[]>(
    () => (products.data ?? []).map((o) => ({ value: o.value, label: o.label })),
    [products.data],
  )

  const onSubmit = async (values: RepStockIssueDraft): Promise<Result<unknown> | void> => {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          sub_warehouse_id: values.sub_warehouse_id,
          rep_user_id: values.rep_user_id,
          lines: serializeJsonArray(values.lines),
          status: 'pending',
          requested_by: principal?.userId ?? null,
        },
      })
      navigate(`/sales/rep-issues/${row.$id}`)
      return ok(undefined)
    } catch (e) {
      return err(
        appError('server', 'تعذّر حفظ إذن الصرف. حاول مجددًا.', {
          detail: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="صرف عهدة جديد"
        titleEn="New rep stock issue"
        actions={
          <Button variant="ghost" onClick={() => navigate('/sales/rep-issues')}>
            رجوع
          </Button>
        }
      />

      {!canAct ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية طلب صرف عهدة.
        </Card>
      ) : (
        <Card>
          <Form
            schema={repStockIssueDraftSchema}
            defaultValues={DEFAULTS as DefaultValues<RepStockIssueDraft>}
            onSubmit={onSubmit}
          >
            {({ formError, isSubmitting }) => (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    name="sub_warehouse_id"
                    label="المخزن الفرعي"
                    labelEn="Sub-warehouse"
                    required
                    placeholder={subWarehouses.isLoading ? 'جارٍ التحميل…' : 'اختر مخزنًا فرعيًا…'}
                    options={(subWarehouses.data ?? []).map((o) => ({
                      value: o.value,
                      label: o.label,
                    }))}
                  />
                  <SelectField
                    name="rep_user_id"
                    label="المندوب"
                    labelEn="Sales rep"
                    required
                    placeholder={reps.isLoading ? 'جارٍ التحميل…' : 'اختر مندوبًا…'}
                    options={(reps.data ?? []).map((o) => ({ value: o.value, label: o.label }))}
                  />
                </div>

                <LinesField productOptions={productOptions} />

                <FormError message={formError} />

                <Button type="submit" disabled={isSubmitting || createDraft.isPending}>
                  حفظ كمسودة
                </Button>
              </div>
            )}
          </Form>
        </Card>
      )}
    </div>
  )
}

function LinesField({ productOptions }: { productOptions: readonly SelectOption[] }) {
  const { watch, setValue, formState } = useFormContext<RepStockIssueDraft>()
  const lines = watch('lines') ?? []
  const error = formState.errors.lines?.message
  return (
    <div>
      <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">الأصناف / Lines</span>
      <RepIssueLineEditor
        value={lines}
        onChange={(next) => setValue('lines', next, { shouldValidate: true })}
        productOptions={productOptions}
      />
      {typeof error === 'string' ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </div>
  )
}
