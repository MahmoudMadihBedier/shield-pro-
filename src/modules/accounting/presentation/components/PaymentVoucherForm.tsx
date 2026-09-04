/**
 * Create form for a payment voucher (`payment_vouchers`) Draft. `reason` is
 * mandatory (schema + form). `direction` decides whether this is money in
 * (`receipt`) or out (`payment`).
 */
import type { DefaultValues } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, NumberField, SelectField, TextAreaField, TextField } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { VOUCHER_DIRECTION_OPTIONS } from '../../domain/labels'
import {
  paymentVoucherFormSchema,
  type PaymentVoucherForm as PaymentVoucherFormValues,
} from '../../domain/schemas'
import { usePaymentVoucherActions } from '../hooks'

export interface PaymentVoucherFormProps {
  onCreated: (id: string) => void
  onCancel: () => void
}

const DEFAULTS: PaymentVoucherFormValues = {
  direction: 'payment',
  amount: 0,
  reason: '',
  counterparty: '',
  treasury_account: '',
  evidence_file_id: '',
}

export function PaymentVoucherForm({ onCreated, onCancel }: PaymentVoucherFormProps) {
  const { createDraft } = usePaymentVoucherActions()

  async function handleSubmit(values: PaymentVoucherFormValues): Promise<Result<unknown>> {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          direction: values.direction,
          amount: values.amount,
          reason: values.reason,
          counterparty: values.counterparty?.trim() ? values.counterparty.trim() : null,
          treasury_account: values.treasury_account?.trim() ? values.treasury_account.trim() : null,
          evidence_file_id: values.evidence_file_id?.trim() ? values.evidence_file_id.trim() : null,
        },
      })
      onCreated(row.$id)
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
        return err(e as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ السند. حاول مرة أخرى.'))
    }
  }

  return (
    <Form
      schema={paymentVoucherFormSchema}
      defaultValues={DEFAULTS as DefaultValues<PaymentVoucherFormValues>}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField
              name="direction"
              label="النوع"
              labelEn="Direction"
              required
              options={VOUCHER_DIRECTION_OPTIONS}
            />
            <NumberField name="amount" label="المبلغ" labelEn="Amount" required min={0} />
          </div>

          <TextAreaField name="reason" label="السبب" labelEn="Reason" required rows={2} />

          <div className="grid gap-3 sm:grid-cols-2">
            <TextField name="counterparty" label="الطرف الآخر" labelEn="Counterparty" />
            <TextField name="treasury_account" label="الخزينة" labelEn="Treasury account" />
          </div>

          <TextField
            name="evidence_file_id"
            label="مُعرّف المرفق"
            labelEn="Evidence file id"
            hint="مؤقتًا: أدخل مُعرّف الملف يدويًا"
          />

          <FormError message={formError} />

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
              إلغاء
            </Button>
            <Button type="submit" disabled={isSubmitting || createDraft.isPending}>
              {isSubmitting ? 'جارٍ الحفظ…' : 'إنشاء مسودة'}
            </Button>
          </div>
        </>
      )}
    </Form>
  )
}
