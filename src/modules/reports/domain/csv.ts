/**
 * Re-export of the canonical CSV serialiser, now shared app-wide in
 * `@/core/csv` (Plan §4.1 — one facade). Kept here so existing
 * `../../domain/csv` imports in this module keep working.
 */
export { toCsv, parseCsv, type CsvColumn } from '@/core/csv'
