/**
 * Renders the create / edit form for any master-data entity from its
 * `registry` field descriptors + `<entity>InputSchema`. Uses the shared form
 * kit only (`claude.md` B.6) — no bespoke form state.
 */
import type { DefaultValues, FieldValues } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Button } from '@/shared/ui'
import {
  CheckboxField,
  Form,
  FormError,
  NumberField,
  SelectField,
  TextField,
  type SelectOption,
} from '@/shared/forms'

import { FIELD_LABELS } from '../../domain/labels'
import { useMasterMutations } from '../hooks/useMasterMutations'
import { useRelationOptions } from '../hooks/useRelationOptions'
import {
  ADMIN_REGISTRY,
  type AdminEntity,
  type AdminInputMap,
  type AdminRowMap,
  type FieldDescriptor,
} from '../registry'

interface MasterFormPanelProps<K extends AdminEntity> {
  entity: K
  mode: 'create' | 'edit'
  /** The row being edited (edit mode only). */
  row?: AdminRowMap[K]
  /** Values forced on the payload and hidden from the form (e.g. `product_id`). */
  fixedValues?: Partial<AdminInputMap[K]>
  onDone: () => void
}

function buildDefaults<K extends AdminEntity>(
  entity: K,
  row: AdminRowMap[K] | undefined,
  fixedValues: Partial<AdminInputMap[K]> | undefined,
): AdminInputMap[K] {
  const config = ADMIN_REGISTRY[entity]
  const defaults: Record<string, unknown> = { ...(config.emptyInput as Record<string, unknown>) }
  if (row) {
    const record = row as Record<string, unknown>
    for (const field of config.fields) {
      const value = record[field.name]
      if (value === undefined || value === null) continue
      if (field.kind === 'number') defaults[field.name] = Number(value)
      else if (field.kind === 'checkbox') defaults[field.name] = Boolean(value)
      else defaults[field.name] = String(value)
    }
  }
  return { ...(defaults as AdminInputMap[K]), ...(fixedValues ?? {}) }
}

function RelationField({
  descriptor,
  label,
  labelEn,
}: {
  descriptor: FieldDescriptor
  label: string
  labelEn: string
}) {
  const { data, isLoading, isError } = useRelationOptions(descriptor.relationTo)
  const options: SelectOption[] = (data ?? []).map((option) => ({
    value: option.value,
    label: option.label,
  }))
  return (
    <SelectField
      name={descriptor.name}
      label={label}
      labelEn={labelEn}
      required={descriptor.required}
      disabled={isLoading}
      options={options}
      placeholder={
        isError ? 'تعذّر تحميل الخيارات' : isLoading ? 'جارٍ التحميل…' : 'اختر…'
      }
    />
  )
}

function renderField(entity: AdminEntity, descriptor: FieldDescriptor) {
  const labels = FIELD_LABELS[entity][descriptor.name] ?? { ar: descriptor.name, en: descriptor.name }
  const common = {
    name: descriptor.name,
    label: labels.ar,
    labelEn: labels.en,
    required: descriptor.required,
  }
  switch (descriptor.kind) {
    case 'number':
      return (
        <NumberField
          key={descriptor.name}
          {...common}
          min={descriptor.min}
          max={descriptor.max}
          step={descriptor.step}
          placeholder={descriptor.placeholder}
        />
      )
    case 'checkbox':
      return <CheckboxField key={descriptor.name} {...common} />
    case 'select':
      return (
        <SelectField
          key={descriptor.name}
          {...common}
          options={descriptor.options ?? []}
          placeholder="اختر…"
        />
      )
    case 'relation':
      return (
        <RelationField
          key={descriptor.name}
          descriptor={descriptor}
          label={labels.ar}
          labelEn={labels.en}
        />
      )
    default:
      return <TextField key={descriptor.name} {...common} placeholder={descriptor.placeholder} />
  }
}

export function MasterFormPanel<K extends AdminEntity>({
  entity,
  mode,
  row,
  fixedValues,
  onDone,
}: MasterFormPanelProps<K>) {
  const config = ADMIN_REGISTRY[entity]
  const mutations = useMasterMutations(entity)
  const defaults = buildDefaults(entity, row, fixedValues)

  async function handleSubmit(values: AdminInputMap[K]): Promise<Result<unknown>> {
    const payload = { ...values, ...(fixedValues ?? {}) }
    try {
      if (mode === 'create') {
        await mutations.create(payload)
      } else if (row) {
        await mutations.update({ id: (row as { $id: string }).$id, patch: payload })
      }
      onDone()
      return ok(undefined)
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && 'message' in error) {
        return err(error as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ البيانات. حاول مرة أخرى.'))
    }
  }

  return (
    <Form
      schema={config.inputSchema}
      defaultValues={defaults as DefaultValues<AdminInputMap[K] & FieldValues>}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <div className="space-y-3">
            {config.fields.map((descriptor) => renderField(entity, descriptor))}
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
