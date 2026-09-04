/**
 * Create form for a collection (`receipts`) Draft. The user picks a Submitted
 * sales invoice; its customer and net total pre-fill the form (both stay
 * editable only where it makes sense — the customer is locked to the invoice,
 * the amount can be a partial payment).
 */
import { useEffect, useMemo, useRef } from 'react'
import { useFormContext, useWatch, type DefaultValues } from 'react-hook-form'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, NumberField, SelectField, TextField } from '@/shared/forms'
import { Button } from '@/shared/ui'

import { RECEIPT_METHOD_OPTIONS } from '../../domain/labels'
import { receiptFormSchema, type ReceiptForm as ReceiptFormValues } from '../../domain/schemas'
import { useCustomerOptions, useReceiptActions, useSubmittedInvoiceOptions } from '../hooks'

export interface ReceiptFormProps {
  onCreated: (id: string) => void
  onCancel: () => void
}

const DEFAULTS: ReceiptFormValues = {
  invoice_ref: '',
  customer_id: '',
  amount: 0,
  method: 'cash',
  evidence_file_id: '',
}

export function ReceiptForm({ onCreated, onCancel }: ReceiptFormProps) {
  const invoices = useSubmittedInvoiceOptions()
  const customers = useCustomerOptions()
  const { createDraft } = useReceiptActions()

  const invoiceByRef = useMemo(
    () => new Map((invoices.data ?? []).map((inv) => [inv.value, inv])),
    [invoices.data],
  )
  const customerName = useMemo(
    () => new Map((customers.data ?? []).map((c) => [c.value, c.label])),
    [customers.data],
  )

  const invoiceOptions = (invoices.data ?? []).map((inv) => ({
    value: inv.value,
    label: inv.label,
  }))

  async function handleSubmit(values: ReceiptFormValues): Promise<Result<unknown>> {
    try {
      const row = await createDraft.mutateAsync({
        fields: {
          invoice_ref: values.invoice_ref,
          customer_id: values.customer_id,
          amount: values.amount,
          method: values.method,
          evidence_file_id: values.evidence_file_id?.trim() ? values.evidence_file_id.trim() : null,
        },
      })
      onCreated(row.$id)
      return ok(undefined)
    } catch (e) {
      if (e && typeof e === 'object' && 'code' in e && 'message' in e) {
        return err(e as ReturnType<typeof appError>)
      }
      return err(appError('unknown', 'تعذّر حفظ سند التحصيل. حاول مرة أخرى.'))
    }
  }

  return (
    <Form
      schema={receiptFormSchema}
      defaultValues={DEFAULTS as DefaultValues<ReceiptFormValues>}
      onSubmit={handleSubmit}
      className="space-y-4"
    >
      {({ formError, isSubmitting }) => (
        <>
          <SelectField
            name="invoice_ref"
            label="الفاتورة"
            labelEn="Invoice"
            required
            options={invoiceOptions}
            placeholder={
              invoices.isError
                ? 'تعذّر تحميل الفواتير'
                : invoices.isLoading
                  ? 'جارٍ التحميل…'
                  : 'اختر فاتورة معتمدة…'
            }
          />

          <InvoicePrefill invoiceByRef={invoiceByRef} />
          <CustomerReadout customerName={customerName} />

          <NumberField name="amount" label="المبلغ" labelEn="Amount" required min={0} />

          <SelectField
            name="method"
            label="طريقة الدفع"
            labelEn="Method"
            required
            options={RECEIPT_METHOD_OPTIONS}
          />

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

/** Copies the chosen invoice's customer + net total into the form once per selection. */
function InvoicePrefill({
  invoiceByRef,
}: {
  invoiceByRef: Map<string, { customerId: string; amount: number }>
}) {
  const { setValue } = useFormContext<ReceiptFormValues>()
  const invoiceRef = useWatch<ReceiptFormValues>({ name: 'invoice_ref' }) as string | undefined
  const applied = useRef<string | null>(null)

  useEffect(() => {
    if (!invoiceRef || invoiceRef === applied.current) return
    const invoice = invoiceByRef.get(invoiceRef)
    if (!invoice) return
    setValue('customer_id', invoice.customerId, { shouldValidate: true })
    setValue('amount', invoice.amount, { shouldValidate: true, shouldDirty: true })
    applied.current = invoiceRef
  }, [invoiceRef, invoiceByRef, setValue])

  return null
}

/** Read-only display of the invoice's customer (the field is set by the picker). */
function CustomerReadout({ customerName }: { customerName: Map<string, string> }) {
  const customerId = useWatch<ReceiptFormValues>({ name: 'customer_id' }) as string | undefined
  const { formState } = useFormContext<ReceiptFormValues>()
  const error = formState.errors.customer_id?.message
  return (
    <div className="text-sm">
      <span className="mb-1 block text-zinc-600 dark:text-zinc-400">العميل / Customer</span>
      <div className="rounded-lg border border-black/10 bg-black/[0.02] px-3 py-2 text-zinc-700 dark:border-white/10 dark:bg-white/[0.03] dark:text-zinc-200">
        {customerId ? (customerName.get(customerId) ?? customerId) : '—'}
      </div>
      {typeof error === 'string' ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </div>
  )
}
