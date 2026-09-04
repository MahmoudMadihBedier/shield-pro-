/**
 * Pure builders that turn a submitted sales document into the ledger movements
 * that post it. The data layer (`data/post-sales.ts`) feeds these to the
 * `/post-stock-ledger` and `/post-gl` Functions — nothing here knows about
 * Appwrite.
 *
 * ## Chart of accounts
 * A real chart-of-accounts is a later story. Until then the GL builders use
 * plain string account codes: `'accounts_receivable'`, `'cash'`, `'bank'`,
 * `'sales_revenue'`. When the CoA lands these become lookups.
 *
 * `domain` is pure TypeScript — no framework imports.
 */
import { CREDIT, DEBIT, type GlLine } from '@/core/ledger'

import { parseInvoiceLines, parseRepIssueLines } from './schemas'
import type { SalesInvoiceRow, RepStockIssueRow } from './schemas'

/** Structurally compatible with `StockMoveInput` in `@/infrastructure/appwrite/functions`. */
export interface StockMove {
  productId: string
  warehouseId: string
  lotNumber?: string | null
  qtyChange: number
  valuationRate?: number
}

export const SALES_ACCOUNTS = {
  accountsReceivable: 'accounts_receivable',
  cash: 'cash',
  bank: 'bank',
  salesRevenue: 'sales_revenue',
} as const

type InvoiceLike = Pick<SalesInvoiceRow, 'lines'>
type InvoiceGlLike = Pick<
  SalesInvoiceRow,
  'net_total' | 'cash_amount' | 'credit_amount' | 'payment_method'
>
type RepIssueLike = Pick<RepStockIssueRow, 'lines'>

/**
 * Each invoice line leaves the rep's custody warehouse: one negative move of
 * `qty`, valued at the line's `net_price` (the amount actually invoiced).
 */
export function invoiceToStockMoves(
  invoice: InvoiceLike,
  repCustodyWarehouseId: string,
): StockMove[] {
  return parseInvoiceLines(invoice.lines).map((line) => ({
    productId: line.product_id,
    warehouseId: repCustodyWarehouseId,
    qtyChange: -line.qty,
    valuationRate: line.net_price,
  }))
}

/**
 * Balanced double entry for the sale:
 *  - Dr `cash` / `bank` for the settled portion (`cash_amount`)
 *  - Dr `accounts_receivable` for the portion still owed (`credit_amount`)
 *  - Cr `sales_revenue` for the full `net_total`
 *
 * `cash_amount + credit_amount === net_total` (guaranteed by `splitPayment`),
 * so Σ debit === Σ credit.
 */
export function invoiceToGlLines(invoice: InvoiceGlLike): GlLine[] {
  const settledAccount =
    invoice.payment_method === 'bank_transfer' ? SALES_ACCOUNTS.bank : SALES_ACCOUNTS.cash
  const lines: GlLine[] = []
  if (invoice.cash_amount > 0) lines.push(DEBIT(settledAccount, invoice.cash_amount))
  if (invoice.credit_amount > 0) {
    lines.push(DEBIT(SALES_ACCOUNTS.accountsReceivable, invoice.credit_amount))
  }
  lines.push(CREDIT(SALES_ACCOUNTS.salesRevenue, invoice.net_total))
  return lines
}

/**
 * Rep stock issue: each line moves OUT of the sub-warehouse (`-qty`) and IN to
 * the rep's custody warehouse (`+qty`), carrying the line's lot number.
 */
export function repIssueToStockMoves(
  issue: RepIssueLike,
  fromSubWarehouseId: string,
  repCustodyWarehouseId: string,
): StockMove[] {
  const moves: StockMove[] = []
  for (const line of parseRepIssueLines(issue.lines)) {
    moves.push({
      productId: line.product_id,
      warehouseId: fromSubWarehouseId,
      lotNumber: line.lot_number ?? null,
      qtyChange: -line.qty,
    })
    moves.push({
      productId: line.product_id,
      warehouseId: repCustodyWarehouseId,
      lotNumber: line.lot_number ?? null,
      qtyChange: line.qty,
    })
  }
  return moves
}
