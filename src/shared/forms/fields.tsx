import type { ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'

const CONTROL_CLASS =
  'w-full rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] text-[var(--text)] px-3 py-2 text-sm outline-none transition-colors placeholder:text-[var(--text-subtle)] hover:border-brand-400/60 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/25 disabled:cursor-not-allowed disabled:opacity-50'

interface BaseFieldProps {
  name: string
  /** Arabic-first label. */
  label: string
  /** Optional English gloss, shown muted after the Arabic label. */
  labelEn?: string
  hint?: string
  disabled?: boolean
  required?: boolean
}

function useFieldError(name: string): string | undefined {
  const {
    formState: { errors },
  } = useFormContext()
  const entry = errors[name]
  return typeof entry?.message === 'string' ? entry.message : undefined
}

function FieldLabel({
  label,
  labelEn,
  required,
}: {
  label: string
  labelEn?: string
  required?: boolean
}) {
  return (
    <span className="mb-1 block text-start text-xs font-medium text-[var(--text-muted)]">
      {label}
      {labelEn ? <span className="font-normal text-[var(--text-subtle)]"> / {labelEn}</span> : null}
      {required ? <span className="text-red-500"> *</span> : null}
    </span>
  )
}

function FieldMessages({ hint, error }: { hint?: string; error?: string }) {
  return (
    <>
      {hint && !error ? (
        <span className="mt-1 block text-start text-xs text-[var(--text-subtle)]">{hint}</span>
      ) : null}
      {error ? (
        <span
          role="alert"
          className="mt-1 block text-start text-xs font-medium text-red-600 dark:text-red-400"
        >
          {error}
        </span>
      ) : null}
    </>
  )
}

/** Label + control + error/hint shell shared by every field. */
function Field({
  name,
  label,
  labelEn,
  hint,
  required,
  children,
}: {
  name: string
  label: string
  labelEn?: string
  hint?: string
  required?: boolean
  children: ReactNode
}) {
  const error = useFieldError(name)
  return (
    <label className="block text-sm">
      <FieldLabel label={label} labelEn={labelEn} required={required} />
      <div
        className={
          error
            ? '[&_input]:border-red-500 [&_input]:focus:ring-red-500/25 [&_select]:border-red-500 [&_textarea]:border-red-500'
            : undefined
        }
      >
        {children}
      </div>
      <FieldMessages hint={hint} error={error} />
    </label>
  )
}

export interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'
  placeholder?: string
  autoComplete?: string
  /** Force text direction — e.g. `'ltr'` for a code/PIN typed inside an RTL form. */
  dir?: 'ltr' | 'rtl'
}

export function TextField({
  name,
  label,
  labelEn,
  hint,
  disabled,
  required,
  type = 'text',
  placeholder,
  autoComplete,
  dir,
}: TextFieldProps) {
  const { register } = useFormContext()
  return (
    <Field name={name} label={label} labelEn={labelEn} hint={hint} required={required}>
      <input
        type={type}
        dir={dir}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-required={required}
        className={dir ? `${CONTROL_CLASS} text-start` : CONTROL_CLASS}
        {...register(name)}
      />
    </Field>
  )
}

export interface TextAreaFieldProps extends BaseFieldProps {
  placeholder?: string
  rows?: number
}

export function TextAreaField({
  name,
  label,
  labelEn,
  hint,
  disabled,
  required,
  placeholder,
  rows = 3,
}: TextAreaFieldProps) {
  const { register } = useFormContext()
  return (
    <Field name={name} label={label} labelEn={labelEn} hint={hint} required={required}>
      <textarea
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        aria-required={required}
        className={CONTROL_CLASS}
        {...register(name)}
      />
    </Field>
  )
}

export interface NumberFieldProps extends BaseFieldProps {
  placeholder?: string
  min?: number
  max?: number
  step?: number | 'any'
}

export function NumberField({
  name,
  label,
  labelEn,
  hint,
  disabled,
  required,
  placeholder,
  min,
  max,
  step = 'any',
}: NumberFieldProps) {
  const { register } = useFormContext()
  return (
    <Field name={name} label={label} labelEn={labelEn} hint={hint} required={required}>
      {/* digits stay LTR even inside an RTL form; the label above is RTL */}
      <input
        type="number"
        dir="ltr"
        inputMode="decimal"
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        aria-required={required}
        className={`${CONTROL_CLASS} text-start`}
        {...register(name, { valueAsNumber: true })}
      />
    </Field>
  )
}

export interface SelectOption {
  value: string
  label: string
}

export interface SelectFieldProps extends BaseFieldProps {
  options: ReadonlyArray<SelectOption>
  placeholder?: string
}

export function SelectField({
  name,
  label,
  labelEn,
  hint,
  disabled,
  required,
  options,
  placeholder,
}: SelectFieldProps) {
  const { register } = useFormContext()
  return (
    <Field name={name} label={label} labelEn={labelEn} hint={hint} required={required}>
      <select
        disabled={disabled}
        aria-required={required}
        defaultValue=""
        className={CONTROL_CLASS}
        {...register(name)}
      >
        {placeholder ? (
          <option value="" disabled>
            {placeholder}
          </option>
        ) : null}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  )
}

export interface CheckboxFieldProps extends BaseFieldProps {
  placeholder?: never
}

export function CheckboxField({ name, label, labelEn, hint, disabled }: CheckboxFieldProps) {
  const { register } = useFormContext()
  const error = useFieldError(name)
  return (
    <div className="text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          disabled={disabled}
          className="size-4 rounded border-[var(--border-strong)] text-brand-600 accent-brand-600 focus:ring-2 focus:ring-brand-500/25 disabled:opacity-50"
          {...register(name)}
        />
        <span className="text-[var(--text-muted)]">
          {label}
          {labelEn ? <span className="text-[var(--text-subtle)]"> / {labelEn}</span> : null}
        </span>
      </label>
      <FieldMessages hint={hint} error={error} />
    </div>
  )
}

export interface DateFieldProps extends BaseFieldProps {
  min?: string
  max?: string
}

export function DateField({
  name,
  label,
  labelEn,
  hint,
  disabled,
  required,
  min,
  max,
}: DateFieldProps) {
  const { register } = useFormContext()
  return (
    <Field name={name} label={label} labelEn={labelEn} hint={hint} required={required}>
      <input
        type="date"
        dir="ltr"
        min={min}
        max={max}
        disabled={disabled}
        aria-required={required}
        className={`${CONTROL_CLASS} text-start`}
        {...register(name)}
      />
    </Field>
  )
}
