import type { ReactNode } from 'react'
import { useFormContext } from 'react-hook-form'

const CONTROL_CLASS =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15'

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

function FieldLabel({ label, labelEn }: { label: string; labelEn?: string }) {
  return (
    <span className="mb-1 block text-start text-zinc-600 dark:text-zinc-400">
      {label}
      {labelEn ? <span className="text-zinc-400"> / {labelEn}</span> : null}
    </span>
  )
}

function FieldMessages({ hint, error }: { hint?: string; error?: string }) {
  return (
    <>
      {hint && !error ? (
        <span className="mt-1 block text-start text-xs text-zinc-400">{hint}</span>
      ) : null}
      {error ? (
        <span role="alert" className="mt-1 block text-start text-xs text-red-600">
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
  children,
}: {
  name: string
  label: string
  labelEn?: string
  hint?: string
  children: ReactNode
}) {
  const error = useFieldError(name)
  return (
    <label className="block text-sm">
      <FieldLabel label={label} labelEn={labelEn} />
      {children}
      <FieldMessages hint={hint} error={error} />
    </label>
  )
}

export interface TextFieldProps extends BaseFieldProps {
  type?: 'text' | 'email' | 'password' | 'tel' | 'url' | 'search'
  placeholder?: string
  autoComplete?: string
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
}: TextFieldProps) {
  const { register } = useFormContext()
  return (
    <Field name={name} label={label} labelEn={labelEn} hint={hint}>
      <input
        type={type}
        placeholder={placeholder}
        autoComplete={autoComplete}
        disabled={disabled}
        aria-required={required}
        className={CONTROL_CLASS}
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
    <Field name={name} label={label} labelEn={labelEn} hint={hint}>
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
    <Field name={name} label={label} labelEn={labelEn} hint={hint}>
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
    <Field name={name} label={label} labelEn={labelEn} hint={hint}>
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
          className="h-4 w-4 rounded border-black/25 dark:border-white/25"
          {...register(name)}
        />
        <span className="text-zinc-600 dark:text-zinc-400">
          {label}
          {labelEn ? <span className="text-zinc-400"> / {labelEn}</span> : null}
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
    <Field name={name} label={label} labelEn={labelEn} hint={hint}>
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
