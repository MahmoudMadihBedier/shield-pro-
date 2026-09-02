/** Create a write-off Draft: warehouse, kind, reason (required) and lines. */
import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { appError } from '@/core/errors'
import { err, type Result } from '@/core/result'
import { Form, FormError, SelectField, TextAreaField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { serializeLines } from '../../domain/line-utils'
import { writeOffDraftSchema, type WriteOffDraft } from '../../domain/schemas'
import { WriteOffLineEditor } from '../components'
import {
  useInventoryPermissions,
  useProductOptions,
  useWarehouseOptions,
  useWriteOffActions,
} from '../hooks'
import { WRITE_OFF_KIND_OPTIONS } from '../labels'

function LinesField({ productOptions }: { productOptions: ReadonlyArray<{ value: string; label: string }> }) {
  const { watch, setValue, formState } = useFormContext<WriteOffDraft>()
  const lines = watch('lines') ?? []
  const error = formState.errors.lines?.message
  return (
    <div>
      <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">الأصناف / Lines</span>
      <WriteOffLineEditor
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

export function WriteOffFormPage() {
  const navigate = useNavigate()
  const perms = useInventoryPermissions()
  const { createDraft } = useWriteOffActions()

  const warehouses = useWarehouseOptions()
  const products = useProductOptions()

  const warehouseOptions = useMemo(
    () => (warehouses.data ?? []).map((o) => ({ value: o.value, label: o.label })),
    [warehouses.data],
  )

  const defaultValues = useMemo<WriteOffDraft>(
    () => ({ warehouse_id: '', kind: 'damage', reason: '', lines: [] }),
    [],
  )

  const onSubmit = async (values: WriteOffDraft): Promise<Result<unknown> | void> => {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          warehouse_id: values.warehouse_id,
          kind: values.kind,
          reason: values.reason,
          lines: serializeLines(values.lines),
        },
      })
      navigate(`/inventory/write-offs/${row.$id}`)
    } catch (e) {
      return err(
        appError('server', 'تعذّر إنشاء سجل الهالك. حاول مجددًا.', {
          detail: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="هالك جديد"
        titleEn="New write-off"
        actions={
          <Button variant="ghost" onClick={() => navigate('/inventory/write-offs')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRequest ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل هالك.
        </Card>
      ) : (
        <Card>
          <Form schema={writeOffDraftSchema} defaultValues={defaultValues} onSubmit={onSubmit}>
            {({ formError, isSubmitting }) => (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    name="warehouse_id"
                    label="المخزن"
                    labelEn="Warehouse"
                    required
                    placeholder="اختر مخزنًا…"
                    options={warehouseOptions}
                  />
                  <SelectField
                    name="kind"
                    label="النوع"
                    labelEn="Kind"
                    required
                    options={WRITE_OFF_KIND_OPTIONS}
                  />
                </div>

                <TextAreaField name="reason" label="السبب" labelEn="Reason" required rows={2} />

                <LinesField productOptions={products.data ?? []} />

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
