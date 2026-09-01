/**
 * Shared currency / date / number formatting. Every module formats through
 * here so locale and currency stay consistent (`claude.md` B.6). Never inline
 * `toFixed()` or hand-build date strings.
 *
 * All helpers are locale-aware and default to the Arabic-first product locale
 * (`ar-EG`) and currency (`EGP`); pass an explicit `locale` for deterministic
 * output (e.g. in tests).
 */
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from './constants'

/** Non-breaking space — keeps a value and its unit on the same line. */
const NBSP = ' '

export function formatCurrency(
  amount: number,
  { locale = DEFAULT_LOCALE, currency = DEFAULT_CURRENCY } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency,
  }).format(amount)
}

export function formatNumber(
  value: number,
  { locale = DEFAULT_LOCALE, maximumFractionDigits = 3, minimumFractionDigits = 0 } = {},
): string {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)
}

/**
 * A physical quantity (stock counts, weights, volumes). Same number rules as
 * {@link formatNumber} plus an optional trailing unit label (e.g. `كجم`, `pcs`),
 * joined with a non-breaking space.
 */
export function formatQuantity(
  value: number,
  {
    locale = DEFAULT_LOCALE,
    unit,
    maximumFractionDigits = 3,
    minimumFractionDigits = 0,
  }: {
    locale?: string
    unit?: string
    maximumFractionDigits?: number
    minimumFractionDigits?: number
  } = {},
): string {
  const formatted = new Intl.NumberFormat(locale, {
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)
  return unit ? `${formatted}${NBSP}${unit}` : formatted
}

/**
 * A ratio rendered as a percentage. `value` is the ratio, not the percentage:
 * `0.125` -> `12.5%`.
 */
export function formatPercent(
  value: number,
  { locale = DEFAULT_LOCALE, maximumFractionDigits = 1, minimumFractionDigits = 0 } = {},
): string {
  return new Intl.NumberFormat(locale, {
    style: 'percent',
    maximumFractionDigits,
    minimumFractionDigits,
  }).format(value)
}

export function formatDate(
  value: string | number | Date,
  { locale = DEFAULT_LOCALE, timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone }).format(new Date(value))
}

export function formatDateTime(
  value: string | number | Date,
  { locale = DEFAULT_LOCALE, timeZone }: { locale?: string; timeZone?: string } = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone,
  }).format(new Date(value))
}

const SECONDS_FORMAT = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatRelativeLatency(ms: number): string {
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${SECONDS_FORMAT.format(ms / 1000)} s`
}
