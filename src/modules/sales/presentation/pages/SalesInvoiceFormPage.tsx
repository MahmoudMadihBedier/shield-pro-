/**
 * Create form for a sales-invoice Draft. Pick an approved customer (their
 * `discount_pct` seeds each line), the selling rep, the products (priced via the
 * pure `domain/pricing` helpers), the payment split and the mandatory
 * geolocation. On save → `createDraft`.
 */
import { useMemo } from 'react'
import { useFormContext, useWatch, type DefaultValues } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'

import { useAuth } from '@/application/auth/context'
import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { Form, FormError, SelectField } from '@/shared/forms'
import { Button, Card, PageHeader } from '@/shared/ui'

import { formatCurrency } from '@/shared/formatters'

import { invoiceTotals, splitPayment } from '../../domain/pricing'
import { canActOnSales } from '../../domain/permissions'
import { RECEIVABLE_INVOICE_METHODS } from '@/modules/accounting/domain/aging'
import {
  salesInvoiceDraftSchema,
  serializeJsonArray,
  type SalesInvoiceDraft,
} from '../../domain/schemas'
import { GeoCaptureField, InvoiceLineEditor, PaymentPanel } from '../components'
import {
  useCustomerCreditCheck,
  useCustomerOptions,
  useProductOptions,
  useRepOptions,
  useSalesInvoiceActions,
  type ProductOption,
} from '../hooks'

const RECEIVABLE_METHODS: ReadonlySet<string> = new Set(RECEIVABLE_INVOICE_METHODS)

const DEFAULTS: SalesInvoiceDraft = {
  customer_id: '',
  rep_user_id: '',
  lines: [],
  payment_method: 'cash',
  cash_amount: 0,
  bank_reference: '',
  geo: '',
}

export function SalesInvoiceFormPage() {
  const navigate = useNavigate()
  const { principal } = useAuth()
  const canAct = canActOnSales(principal)

  const customers = useCustomerOptions()
  const reps = useRepOptions()
  const products = useProductOptions()
  const { createDraft } = useSalesInvoiceActions()

  const customerOptions = useMemo(
    () => (customers.data ?? []).map((o) => ({ value: o.value, label: o.label })),
    [customers.data],
  )
  const repOptions = useMemo(
    () => (reps.data ?? []).map((o) => ({ value: o.value, label: o.label })),
    [reps.data],
  )

  const onSubmit = async (values: SalesInvoiceDraft): Promise<Result<unknown> | void> => {
    const totals = invoiceTotals(values.lines)
    const split = splitPayment(
      totals.net_total,
      values.payment_method,
      values.cash_amount,
      values.bank_reference,
    )
    if (!split.ok) return err(split.error)

    try {
      const row = await createDraft.mutateAsync({
        fields: {
          customer_id: values.customer_id,
          rep_user_id: values.rep_user_id,
          lines: serializeJsonArray(values.lines),
          gross_total: totals.gross_total,
          discount_total: totals.discount_total,
          net_total: totals.net_total,
          payment_method: values.payment_method,
          cash_amount: split.value.cash_amount,
          credit_amount: split.value.credit_amount,
          bank_reference: values.bank_reference?.trim() || null,
          geo: values.geo.trim(),
          sold_by: principal?.userId ?? values.rep_user_id,
        },
      })
      navigate(`/sales/invoices/${row.$id}`)
      return ok(undefined)
    } catch (e) {
      return err(
        appError('server', 'تعذّر حفظ الفاتورة. حاول مجددًا.', {
          detail: e instanceof Error ? e.message : String(e),
        }),
      )
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="فاتورة مبيعات جديدة"
        titleEn="New sales invoice"
        actions={
          <Button variant="ghost" onClick={() => navigate('/sales/invoices')}>
            رجوع
          </Button>
        }
      />

      {!canAct ? (
        <Card className="text-sm text-amber-700 dark:text-amber-300">
          لا تملك صلاحية إصدار فواتير مبيعات.
        </Card>
      ) : (
        <Card>
          <Form
            schema={salesInvoiceDraftSchema}
            defaultValues={DEFAULTS as DefaultValues<SalesInvoiceDraft>}
            onSubmit={onSubmit}
          >
            {({ formError, isSubmitting }) => (
              <div className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <SelectField
                    name="customer_id"
                    label="العميل"
                    labelEn="Customer"
                    required
                    placeholder={customers.isLoading ? 'جارٍ التحميل…' : 'اختر عميلًا معتمدًا…'}
                    options={customerOptions}
                  />
                  <SelectField
                    name="rep_user_id"
                    label="المندوب"
                    labelEn="Sales rep"
                    required
                    placeholder={reps.isLoading ? 'جارٍ التحميل…' : 'اختر مندوبًا…'}
                    options={repOptions}
                  />
                </div>

                <LinesField
                  productOptions={products.data ?? []}
                  customerDiscountByCustomer={
                    new Map((customers.data ?? []).map((c) => [c.value, c.discountPct]))
                  }
                />

                <PaymentTotalsBridge />

                <CreditCheckBridge />

                <GeoCaptureField name="geo" />

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

function LinesField({
  productOptions,
  customerDiscountByCustomer,
}: {
  productOptions: readonly ProductOption[]
  customerDiscountByCustomer: Map<string, number>
}) {
  const { watch, setValue, formState } = useFormContext<SalesInvoiceDraft>()
  const lines = watch('lines') ?? []
  const customerId = (useWatch({ name: 'customer_id' }) as string | undefined) ?? ''
  const customerDiscountPct = customerDiscountByCustomer.get(customerId) ?? 0
  const error = formState.errors.lines?.message

  return (
    <div>
      <span className="mb-1 block text-sm text-zinc-600 dark:text-zinc-400">الأصناف / Lines</span>
      <InvoiceLineEditor
        value={lines}
        onChange={(next) => setValue('lines', next, { shouldValidate: true })}
        productOptions={productOptions}
        customerDiscountPct={customerDiscountPct}
      />
      {typeof error === 'string' ? (
        <span className="mt-1 block text-xs text-red-600">{error}</span>
      ) : null}
    </div>
  )
}

/** Feeds the live net total from the line editor into the PaymentPanel. */
function PaymentTotalsBridge() {
  const watched = useWatch({ name: 'lines' }) as SalesInvoiceDraft['lines'] | undefined
  const totals = useMemo(() => invoiceTotals(watched ?? []), [watched])
  return <PaymentPanel netTotal={totals.net_total} />
}

/**
 * Live credit-limit check (Story 2.5). For a credit-side payment method it
 * warns when `outstanding + this invoice` exceeds the customer's limit — the
 * draft can still be saved, but `submit` is blocked server-side until a System
 * Admin / Chief Accountant records an override.
 */
function CreditCheckBridge() {
  const customerId = (useWatch({ name: 'customer_id' }) as string | undefined) || undefined
  const method = (useWatch({ name: 'payment_method' }) as string | undefined) ?? 'cash'
  const lines = useWatch({ name: 'lines' }) as SalesInvoiceDraft['lines'] | undefined
  const netTotal = useMemo(() => invoiceTotals(lines ?? []).net_total, [lines])
  const receivable = RECEIVABLE_METHODS.has(method)

  const check = useCustomerCreditCheck(receivable ? customerId : undefined, netTotal)

  if (!receivable || !customerId || !check.data || check.data.ok) return null
  return (
    <Card className="border-amber-300 bg-amber-50 text-sm text-amber-800 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-200">
      <p className="font-semibold">تجاوز حد الائتمان / Over credit limit</p>
      <p className="mt-1">
        الرصيد المستحق {formatCurrency(check.data.outstanding)} + هذه الفاتورة{' '}
        {formatCurrency(netTotal)} يتجاوز الحد {formatCurrency(check.data.creditLimit)} بمقدار{' '}
        <strong dir="ltr">{formatCurrency(check.data.overBy)}</strong>. يمكن حفظ المسودة، لكن
        اعتمادها يتطلب موافقة المحاسب الرئيسي أو مدير النظام.
      </p>
    </Card>
  )
}
