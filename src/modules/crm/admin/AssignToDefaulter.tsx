/**
 * Self-assign default for an async-loaded "assigned to" `SelectField`.
 *
 * `SelectField` is an uncontrolled native `<select defaultValue="">` — RHF's
 * `defaultValues.assigned_to` can only take effect if the matching `<option>`
 * already exists in the DOM at mount, but the staff-options list is loaded
 * asynchronously, so the intended self-assign default silently falls back to
 * the empty placeholder. Once the options arrive, apply it here — but only
 * while the field is still untouched and empty, so it never clobbers a
 * deliberate choice. Shared by every CRM form that defaults "assigned to" to
 * the signed-in staff member (follow-ups, leads) — the field name is always
 * `assigned_to`, so this stays a plain string rather than a generic `Path<T>`
 * to sidestep RHF's `DeepMap` typing on `dirtyFields`.
 */
import { useEffect } from 'react'
import { useFormContext, type FieldValues } from 'react-hook-form'

import type { SelectOption } from '@/shared/forms'

export interface AssignToDefaulterProps {
  options: readonly SelectOption[]
  selfId: string
}

export function AssignToDefaulter<T extends FieldValues & { assigned_to: string }>({
  options,
  selfId,
}: AssignToDefaulterProps) {
  const { getValues, setValue, formState } = useFormContext<T>()
  const dirtyFields = formState.dirtyFields as Record<string, boolean | undefined>
  const dirty = Boolean(dirtyFields.assigned_to)

  useEffect(() => {
    if (dirty || !selfId) return
    if (!options.some((o) => o.value === selfId)) return
    if (getValues('assigned_to' as never)) return
    setValue('assigned_to' as never, selfId as never)
  }, [options, selfId, dirty, getValues, setValue])

  return null
}
