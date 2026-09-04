/**
 * `"lat,lng"` text input plus a "use my location" button
 * (`navigator.geolocation`). Binds to a React Hook Form field by `name`; the
 * invoice `geo` is mandatory at issue time (`scripts/appwrite/schema.ts` — the
 * column is required).
 */
import { useState } from 'react'
import { useFormContext } from 'react-hook-form'

import { isValidGeo } from '../../domain/geo'

const CONTROL =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15'

export interface GeoCaptureFieldProps {
  name: string
  label?: string
  labelEn?: string
  disabled?: boolean
}

export function GeoCaptureField({
  name,
  label = 'الموقع الجغرافي',
  labelEn = 'Geolocation',
  disabled = false,
}: GeoCaptureFieldProps) {
  const { register, setValue, watch, formState } = useFormContext()
  const value = (watch(name) as string | undefined) ?? ''
  const fieldError = formState.errors[name]
  const errorMessage = typeof fieldError?.message === 'string' ? fieldError.message : undefined

  const [busy, setBusy] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const capture = () => {
    setGeoError(null)
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGeoError('خدمة تحديد الموقع غير متاحة على هذا الجهاز.')
      return
    }
    setBusy(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords
        setValue(name, `${latitude},${longitude}`, { shouldValidate: true, shouldDirty: true })
        setBusy(false)
      },
      (error) => {
        setGeoError(error.message || 'تعذّر تحديد الموقع. أدخل الإحداثيات يدويًا.')
        setBusy(false)
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-start text-zinc-600 dark:text-zinc-400">
        {label}
        {labelEn ? <span className="text-zinc-400"> / {labelEn}</span> : null}
      </span>
      <div className="flex items-center gap-2">
        <input
          dir="ltr"
          inputMode="text"
          placeholder="30.0444,31.2357"
          disabled={disabled}
          aria-required
          className={`${CONTROL} text-start`}
          {...register(name)}
        />
        <button
          type="button"
          onClick={capture}
          disabled={disabled || busy}
          className="shrink-0 rounded-lg border border-black/15 px-3 py-2 text-xs font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"
        >
          {busy ? 'جارٍ التحديد…' : 'استخدم موقعي'}
        </button>
      </div>
      {value && !isValidGeo(value) && !errorMessage ? (
        <span className="mt-1 block text-start text-xs text-amber-600">
          الصيغة المتوقعة: إحداثيان مفصولان بفاصلة، مثل 30.0444,31.2357
        </span>
      ) : null}
      {geoError ? (
        <span role="alert" className="mt-1 block text-start text-xs text-red-600">
          {geoError}
        </span>
      ) : null}
      {errorMessage ? (
        <span role="alert" className="mt-1 block text-start text-xs text-red-600">
          {errorMessage}
        </span>
      ) : null}
    </label>
  )
}
