/**
 * Payment method + conditional cash / credit / bank-reference inputs, with a
 * live `splitPayment` preview. Binds to the React Hook Form fields
 * `payment_method`, `cash_amount` and `bank_reference`.
 *
 * Presentation only — the split maths comes from `domain/pricing`.
 */
import { useFormContext, useWatch } from 'react-hook-form'

import { formatCurrency } from '@/shared/formatters'
import { SelectField } from '@/shared/forms'

import { splitPayment } from '../../domain/pricing'
import { PAYMENT_METHODS, type PaymentMethod, type SalesInvoiceDraft } from '../../domain/schemas'
import { PAYMENT_METHOD_LABEL } from '../labels'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-500 disabled:opacity-50 dark:border-white/15'

const METHOD_OPTIONS = PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_METHOD_LABEL[m] }))

export interface PaymentPanelProps {
  netTotal: number
  disabled?: boolean
}

export function PaymentPanel({ netTotal, disabled = false }: PaymentPanelProps) {
  const { register, formState } = useFormContext<SalesInvoiceDraft>()
  const method = (useWatch({ name: 'payment_method' }) as PaymentMethod | undefined) ?? 'cash'
  const cashAmount = useWatch({ name: 'cash_amount' }) as number | undefined
  const bankReference = useWatch({ name: 'bank_reference' }) as string | undefined

  const split = splitPayment(netTotal, method, cashAmount, bankReference)
  const cashError =
    typeof formState.errors.cash_amount?.message === 'string'
      ? formState.errors.cash_amount.message
      : undefined
  const bankError =
    typeof formState.errors.bank_reference?.message === 'string'
      ? formState.errors.bank_reference.message
      : undefined

  return (
    <div className="space-y-3 rounded-lg border border-black/10 p-3 dark:border-white/10">
      <SelectField
        name="payment_method"
        label="طريقة الدفع"
        labelEn="Payment method"
        required
        options={METHOD_OPTIONS}
      />

      {method === 'partial' ? (
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
            المبلغ النقدي / Cash portion
          </span>
          <input
            type="number"
            dir="ltr"
            inputMode="decimal"
            min={0}
            max={netTotal}
            step="any"
            disabled={disabled}
            className={`${CONTROL} text-start`}
            {...register('cash_amount', { valueAsNumber: true })}
          />
          {cashError ? (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {cashError}
            </span>
          ) : null}
        </label>
      ) : null}

      {method === 'bank_transfer' ? (
        <label className="block text-sm">
          <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
            مرجع الحوالة / Bank reference
          </span>
          <input
            type="text"
            dir="ltr"
            disabled={disabled}
            className={`${CONTROL} text-start`}
            {...register('bank_reference')}
          />
          {bankError ? (
            <span role="alert" className="mt-1 block text-xs text-red-600">
              {bankError}
            </span>
          ) : null}
        </label>
      ) : null}

      <dl className="grid grid-cols-2 gap-2 text-sm">
        <dt className="text-zinc-500">نقدًا / Settled</dt>
        <dd dir="ltr" className="text-start tabular-nums">
          {split.ok ? formatCurrency(split.value.cash_amount) : '—'}
        </dd>
        <dt className="text-zinc-500">آجل / On credit</dt>
        <dd dir="ltr" className="text-start tabular-nums">
          {split.ok ? formatCurrency(split.value.credit_amount) : '—'}
        </dd>
      </dl>

      {!split.ok ? (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {split.error.message}
        </p>
      ) : null}
    </div>
  )
}
