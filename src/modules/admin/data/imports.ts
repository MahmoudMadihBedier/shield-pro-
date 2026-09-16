/**
 * Data layer for the bulk-import screens (Plan §4.1). Thin wrappers over the
 * server RPCs; every write is System-Admin-gated server-side.
 */
import {
  importBankStatement as callImportBankStatement,
  importOpeningStock as callImportOpeningStock,
  importRawMaterialPrices as callImportPrices,
  type BankStatementImportResult,
  type OpeningStockImportResult,
  type PriceImportResult,
} from '@/infrastructure/appwrite/functions'
import type { Result } from '@/core/result'

export type { BankStatementImportResult, OpeningStockImportResult, PriceImportResult }

/** Update `raw_materials.purchase_price` by `code` from a validated CSV. */
export function importRawMaterialPrices(
  rows: ReadonlyArray<{ code: string; purchase_price: number }>,
): Promise<Result<PriceImportResult>> {
  return callImportPrices(rows)
}

/** Post one opening-stock ledger move per row (`product_code`/`warehouse_name` match). */
export function importOpeningStock(
  rows: ReadonlyArray<{
    product_code: string
    warehouse_name: string
    qty: number
    unit_cost: number
  }>,
): Promise<Result<OpeningStockImportResult>> {
  return callImportOpeningStock(rows)
}

/** Bulk-insert bank statement lines. No duplicate detection — see `functions.ts`. */
export function importBankStatement(
  rows: ReadonlyArray<{
    statement_date: string
    description: string
    reference?: string
    debit: number
    credit: number
    balance?: number
  }>,
): Promise<Result<BankStatementImportResult>> {
  return callImportBankStatement(rows)
}
