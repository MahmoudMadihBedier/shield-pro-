/**
 * A text input for `origin_ref` (the `INV-` / `TRF-` / `SR-` document being
 * reversed) with a live badge showing what kind of document it resolves to,
 * and a hint for which warehouse a return of that kind should land back in.
 * UI guidance only — the actual warehouse is always chosen by the user.
 */
import { useFormContext, useWatch } from 'react-hook-form'

import { StatusPill, type BadgeTone } from '@/shared/ui'

import { originKind, originWarehouseHint, type OriginKind } from '../../domain/origin'

const KIND_STYLE: Record<OriginKind, { ar: string; en: string; tone: BadgeTone }> = {
  sale: { ar: 'فاتورة مبيعات', en: 'Sales invoice', tone: 'success' },
  transfer: { ar: 'تحويل مخزني', en: 'Warehouse transfer', tone: 'neutral' },
  receipt: { ar: 'إذن استلام خامات', en: 'Raw-material receipt', tone: 'warning' },
  unknown: { ar: 'غير معروف', en: 'Unknown', tone: 'danger' },
}

const CONTROL_CLASS =
  'w-full rounded-lg border border-black/15 bg-transparent px-3 py-2 text-sm outline-none transition focus:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/15'

export interface OriginRefFieldProps {
  name: string
  disabled?: boolean
}

export function OriginRefField({ name, disabled }: OriginRefFieldProps) {
  const {
    register,
    control,
    formState: { errors },
  } = useFormContext()
  const value = useWatch({ control, name }) as string | undefined
  const error = errors[name]?.message
  const trimmed = (value ?? '').trim()
  const kind = trimmed ? originKind(trimmed) : null

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-start text-zinc-600 dark:text-zinc-400">
        المستند الأصلي
        <span className="text-zinc-400"> / Origin reference</span>
      </span>
      <input
        type="text"
        dir="ltr"
        placeholder="INV-2026-00042"
        disabled={disabled}
        className={`${CONTROL_CLASS} text-start`}
        {...register(name)}
      />

      {kind ? (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <StatusPill tone={KIND_STYLE[kind].tone}>
            {KIND_STYLE[kind].ar}
            <span className="opacity-70"> / {KIND_STYLE[kind].en}</span>
          </StatusPill>
          <span className="text-zinc-500">{originWarehouseHint(kind)}</span>
        </div>
      ) : null}

      {typeof error === 'string' ? (
        <span role="alert" className="mt-1 block text-start text-xs text-red-600">
          {error}
        </span>
      ) : null}
    </label>
  )
}
