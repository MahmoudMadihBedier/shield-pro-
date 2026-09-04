/**
 * Create a warehouse-transfer Draft: pick the source + destination warehouses
 * (same-warehouse is blocked) and add product lines. On success the new Draft's
 * detail screen opens, where the quadruple-step flow runs.
 */
import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { appError } from '@/core/errors'
import { err, type Result } from '@/core/result'
import { Form, FormError } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { serializeLines } from '../../domain/line-utils'
import {
  warehouseTransferDraftSchema,
  type WarehouseTransferDraft,
} from '../../domain/schemas'
import { TransferLineEditor } from '../components'
import {
  useInventoryPermissions,
  useProductOptions,
  useWarehouseOptions,
  useWarehouseTransferActions,
} from '../hooks'

function WarehousePicker({
  name,
  label,
  options,
}: {
  name: 'from_warehouse_id' | 'to_warehouse_id'
  label: string
  options: ReadonlyArray<{ value: string; label: string }>
}) {
  const { register, formState } = useFormContext<WarehouseTransferDraft>()
  const error = formState.errors[name]?.message
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600 dark:text-zinc-400">{label}</span>
      <select
        className="w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 dark:border-white/15"
        defaultValue=""
        {...register(name)}
      >
        <option value="" disabled>
          اختر مخزنًا…
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {typeof error === 'string' ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </label>
  )
}

function LinesField({ productOptions }: { productOptions: ReadonlyArray<{ value: string; label: string }> }) {
  const { watch, setValue, formState } = useFormContext<WarehouseTransferDraft>()
  const lines = watch('lines') ?? []
  const error = formState.errors.lines?.message
  return (
    <div>
      <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">الأصناف / Lines</span>
      <TransferLineEditor
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

export function WarehouseTransferFormPage() {
  const navigate = useNavigate()
  const { createDraft } = useWarehouseTransferActions()
  const perms = useInventoryPermissions()

  const warehouses = useWarehouseOptions()
  const products = useProductOptions()
  const warehouseOptions = warehouses.data ?? []
  const productOptions = products.data ?? []

  const defaultValues = useMemo<WarehouseTransferDraft>(
    () => ({ from_warehouse_id: '', to_warehouse_id: '', lines: [] }),
    [],
  )

  const onSubmit = async (values: WarehouseTransferDraft): Promise<Result<unknown> | void> => {
    if (values.from_warehouse_id === values.to_warehouse_id) {
      return err(appError('validation', 'لا يمكن التحويل إلى نفس المخزن.'))
    }
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          from_warehouse_id: values.from_warehouse_id,
          to_warehouse_id: values.to_warehouse_id,
          lines: serializeLines(values.lines),
          status: 'pending',
        },
      })
      navigate(`/inventory/transfers/${row.$id}`)
    } catch (e) {
      return err(
        appError('server', 'تعذّر إنشاء التحويل. حاول مجددًا.', {
          detail: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="تحويل جديد"
        titleEn="New transfer"
        actions={
          <Button variant="ghost" onClick={() => navigate('/inventory/transfers')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRequest ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية إنشاء تحويل مخزني.
        </Card>
      ) : (
        <Card>
          <Form schema={warehouseTransferDraftSchema} defaultValues={defaultValues} onSubmit={onSubmit}>
            {({ formError, isSubmitting }) => (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <WarehousePicker name="from_warehouse_id" label="من مخزن / From" options={warehouseOptions} />
                  <WarehousePicker name="to_warehouse_id" label="إلى مخزن / To" options={warehouseOptions} />
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
