/**
 * Create a return-request Draft: the origin document reference, the returned
 * lines, and a required reason. On success the new Draft's detail screen opens,
 * where the approve/reject → submit/cancel → post-to-ledger flow runs.
 */
import { useMemo } from 'react'
import { useFormContext } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { appError } from '@/core/errors'
import { err, type Result } from '@/core/result'
import { Form, FormError, TextAreaField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { serializeReturnLines, returnRequestDraftSchema, type ReturnRequestDraft } from '../../domain/schemas'
import { OriginRefField, ReturnLineEditor } from '../components'
import { useProductOptions, useReturnRequestActions, useReturnsPermissions } from '../hooks'

function LinesField() {
  const { watch, setValue, formState } = useFormContext<ReturnRequestDraft>()
  const products = useProductOptions()
  const lines = watch('lines') ?? []
  const error = formState.errors.lines?.message
  return (
    <div>
      <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">الأصناف / Lines</span>
      <ReturnLineEditor
        value={lines}
        onChange={(next) => setValue('lines', next, { shouldValidate: true })}
        productOptions={products.data ?? []}
      />
      {typeof error === 'string' ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </div>
  )
}

export function ReturnRequestFormPage() {
  const navigate = useNavigate()
  const perms = useReturnsPermissions()
  const { createDraft } = useReturnRequestActions()

  const defaultValues = useMemo<ReturnRequestDraft>(
    () => ({ origin_ref: '', reason: '', lines: [] }),
    [],
  )

  const onSubmit = async (values: ReturnRequestDraft): Promise<Result<unknown> | void> => {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          origin_ref: values.origin_ref,
          reason: values.reason,
          lines: serializeReturnLines(values.lines),
          status: 'pending',
          requested_by: perms.principal?.userId ?? null,
        },
      })
      navigate(`/returns/requests/${row.$id}`)
    } catch (e) {
      return err(
        appError('server', 'تعذّر إنشاء طلب المرتجع. حاول مجددًا.', {
          detail: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="طلب مرتجع جديد"
        titleEn="New return request"
        actions={
          <Button variant="ghost" onClick={() => navigate('/returns/requests')}>
            رجوع
          </Button>
        }
      />

      {!perms.canRequest ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية تسجيل طلب مرتجع.
        </Card>
      ) : (
        <Card>
          <Form schema={returnRequestDraftSchema} defaultValues={defaultValues} onSubmit={onSubmit}>
            {({ formError, isSubmitting }) => (
              <div className="space-y-4">
                <OriginRefField name="origin_ref" />

                <TextAreaField name="reason" label="السبب" labelEn="Reason" required rows={2} />

                <LinesField />

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
