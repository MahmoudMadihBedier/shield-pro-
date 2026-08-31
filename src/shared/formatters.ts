/**
 * Shared currency / date / number formatting. Every module formats through
 * here so locale and currency stay consistent (`claude.md` B.6). Never inline
 * `toFixed()` or hand-build date strings.
 */
import { DEFAULT_CURRENCY, DEFAULT_LOCALE } from './constants'

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
  { locale = DEFAULT_LOCALE, maximumFractionDigits = 3 } = {},
): string {
  return new Intl.NumberFormat(locale, { maximumFractionDigits }).format(value)
}

export function formatDate(
  value: string | number | Date,
  { locale = DEFAULT_LOCALE }: { locale?: string } = {},
): string {
  return new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(value))
}

export function formatDateTime(
  value: string | number | Date,
  { locale = DEFAULT_LOCALE }: { locale?: string } = {},
): string {
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatRelativeLatency(ms: number): string {
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}
