/**
 * Data layer for the bulk-import screens (Plan §4.1). Thin wrappers over the
 * server RPCs; every write is System-Admin-gated server-side.
 */
import {
  importRawMaterialPrices as callImportPrices,
  type PriceImportResult,
} from '@/infrastructure/appwrite/functions'
import type { Result } from '@/core/result'

export type { PriceImportResult }

/** Update `raw_materials.purchase_price` by `code` from a validated CSV. */
export function importRawMaterialPrices(
  rows: ReadonlyArray<{ code: string; purchase_price: number }>,
): Promise<Result<PriceImportResult>> {
  return callImportPrices(rows)
}
