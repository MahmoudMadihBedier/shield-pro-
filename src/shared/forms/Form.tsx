import { zodResolver } from '@hookform/resolvers/zod'
import { useState, type ReactNode } from 'react'
import { FormProvider, useForm, type DefaultValues, type FieldValues } from 'react-hook-form'
import type { ZodType } from 'zod'

import { isErr, type Result } from '@/core/result'

/** What a `Form` submit handler may hand back. */
export type FormSubmitOutcome = Result<unknown> | void

export interface FormRenderProps {
  /** Form-level error surfaced from an `err(...)` submit result. `null` when clear. */
  formError: string | null
  isSubmitting: boolean
}

export interface FormProps<TValues extends FieldValues> {
  /** A Zod object schema. Its inferred type drives every field and `onSubmit`. */
  schema: ZodType<TValues, TValues>
  defaultValues?: DefaultValues<TValues>
  /**
   * Receives the parsed, typed values. Return an `err(AppError)` `Result` to
   * surface a form-level message (see {@link FormError}); return nothing / an
   * `ok` result on success.
   */
  onSubmit: (values: TValues) => Promise<FormSubmitOutcome> | FormSubmitOutcome
  children: ReactNode | ((props: FormRenderProps) => ReactNode)
  className?: string
  id?: string
}

/**
 * Thin wrapper over React Hook Form + Zod resolver (`claude.md` B.6 — every
 * form uses RHF + a Zod resolver). Sets up the form context so field
 * components bind via `useFormContext`, and turns an `err(...)` submit result
 * into a form-level error string.
 */
export function Form<TValues extends FieldValues>({
  schema,
  defaultValues,
  onSubmit,
  children,
  className,
  id,
}: FormProps<TValues>) {
  const methods = useForm<TValues>({
    resolver: zodResolver(schema),
    defaultValues,
  })
  const [formError, setFormError] = useState<string | null>(null)

  const submit = methods.handleSubmit(async (values) => {
    setFormError(null)
    const outcome = await onSubmit(values)
    if (outcome && isErr(outcome)) {
      setFormError(outcome.error.message)
    }
  })

  return (
    <FormProvider {...methods}>
      <form noValidate onSubmit={submit} className={className} id={id}>
        {typeof children === 'function'
          ? children({ formError, isSubmitting: methods.formState.isSubmitting })
          : children}
      </form>
    </FormProvider>
  )
}

/** Presentational form-level error banner. Renders nothing when `message` is falsy. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null
  return (
    <p
      role="alert"
      className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
    >
      {message}
    </p>
  )
}
