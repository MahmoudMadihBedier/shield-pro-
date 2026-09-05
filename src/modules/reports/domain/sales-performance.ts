/**
 * Sales-performance aggregation — top/bottom products, branch + rep
 * performance, a gross-margin ratio and a monthly revenue trend.
 *
 * Pure TypeScript, zero I/O: every function here takes already-fetched rows
 * (from `../data/dashboard-repo`) and reduces them. No react/appwrite imports
 * (`claude.md` B.4).
 */

// ---------------------------------------------------------------------------
// Top / bottom products
// ---------------------------------------------------------------------------

export interface TopProduct {
  productId: string
  unitsSold: number
  netRevenue: number
}

/** One priced invoice line, the shape `sales_invoices.lines` decodes to. */
export interface InvoiceLineLike {
  product_id: string
  qty: number
  net_price: number
}

const DEFAULT_LIMIT = 10

function aggregateByProduct(invoiceLines: readonly InvoiceLineLike[]): Map<string, TopProduct> {
  const byProduct = new Map<string, TopProduct>()
  for (const line of invoiceLines) {
    const existing = byProduct.get(line.product_id)
    const unitsSold = line.qty
    const netRevenue = line.qty * line.net_price
    if (existing) {
      existing.unitsSold += unitsSold
      existing.netRevenue += netRevenue
    } else {
      byProduct.set(line.product_id, { productId: line.product_id, unitsSold, netRevenue })
    }
  }
  return byProduct
}

/** Best-selling products by net revenue, descending. Ties keep insertion order (stable sort). */
export function topProducts(
  invoiceLines: readonly InvoiceLineLike[],
  opts: { limit?: number } = {},
): TopProduct[] {
  const limit = opts.limit ?? DEFAULT_LIMIT
  const rows = [...aggregateByProduct(invoiceLines).values()]
  rows.sort((a, b) => b.netRevenue - a.netRevenue)
  return rows.slice(0, limit)
}

/**
 * Worst-selling products by net revenue, ascending. Products with **zero**
 * sales are excluded by default — they never appear in `invoiceLines` at all
 * (there is nothing to aggregate), so "bottom products" means "sold the
 * least, but sold something": a product nobody ever invoiced is a catalogue
 * question, not a sales-performance one, and mixing the two in one ranked
 * list would bury every product that actually needs attention under an
 * undifferentiated pile of zeros.
 */
export function bottomProducts(
  invoiceLines: readonly InvoiceLineLike[],
  opts: { limit?: number } = {},
): TopProduct[] {
  const limit = opts.limit ?? DEFAULT_LIMIT
  const rows = [...aggregateByProduct(invoiceLines).values()].filter((r) => r.netRevenue > 0)
  rows.sort((a, b) => a.netRevenue - b.netRevenue)
  return rows.slice(0, limit)
}

// ---------------------------------------------------------------------------
// Branch / rep performance
// ---------------------------------------------------------------------------

export interface BranchPerformance {
  branchId: string
  netRevenue: number
  invoiceCount: number
}

/** `null` branch (factory-direct / unassigned) is grouped under `'unassigned'`. */
const UNASSIGNED_BRANCH = 'unassigned'

export function branchPerformance(
  invoices: readonly { branch_id: string | null; net_total: number }[],
): BranchPerformance[] {
  const byBranch = new Map<string, BranchPerformance>()
  for (const inv of invoices) {
    const branchId = inv.branch_id ?? UNASSIGNED_BRANCH
    const existing = byBranch.get(branchId)
    if (existing) {
      existing.netRevenue += inv.net_total
      existing.invoiceCount += 1
    } else {
      byBranch.set(branchId, { branchId, netRevenue: inv.net_total, invoiceCount: 1 })
    }
  }
  return [...byBranch.values()].sort((a, b) => b.netRevenue - a.netRevenue)
}

export interface RepPerformance {
  repUserId: string
  netRevenue: number
  invoiceCount: number
}

export function repPerformance(
  invoices: readonly { rep_user_id: string; net_total: number }[],
): RepPerformance[] {
  const byRep = new Map<string, RepPerformance>()
  for (const inv of invoices) {
    const existing = byRep.get(inv.rep_user_id)
    if (existing) {
      existing.netRevenue += inv.net_total
      existing.invoiceCount += 1
    } else {
      byRep.set(inv.rep_user_id, {
        repUserId: inv.rep_user_id,
        netRevenue: inv.net_total,
        invoiceCount: 1,
      })
    }
  }
  return [...byRep.values()].sort((a, b) => b.netRevenue - a.netRevenue)
}

// ---------------------------------------------------------------------------
// Gross margin
// ---------------------------------------------------------------------------

/**
 * `(netRevenue - cogs) / netRevenue`, guarded against divide-by-zero (→ 0).
 *
 * `cogs` is supplied by the caller, not computed here: a true cost-of-goods
 * figure needs the stock ledger's moving valuation rate per product, which is
 * out of scope for this pass (`IMPLEMENTATION_PLAN.md` §4.2/4.4 — this report
 * reads live ledgers, but full COGS valuation is a later story). Today the
 * dashboard approximates `cogs` from `product.base_price × qty` — a proxy the
 * caller assembles, not this function.
 */
export function grossMargin(netRevenue: number, cogs: number): number {
  if (netRevenue === 0) return 0
  return (netRevenue - cogs) / netRevenue
}

// ---------------------------------------------------------------------------
// Monthly sales trend
// ---------------------------------------------------------------------------

export interface MonthlyRevenue {
  /** `YYYY-MM`. */
  month: string
  netRevenue: number
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`
}

function addMonthsUtc(date: Date, delta: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + delta, 1))
}

/**
 * Buckets `invoices` by `YYYY-MM` (posting month) and fills any month with no
 * invoices with `0`, for the trailing `months`-wide window ending at the
 * latest invoice's month (or the current month when `invoices` is empty).
 * Sorted chronologically, oldest first.
 */
export function monthlySalesTrend(
  invoices: readonly { posting_datetime: string; net_total: number }[],
  months: number,
): MonthlyRevenue[] {
  const totalsByMonth = new Map<string, number>()
  let latest: Date | null = null
  for (const inv of invoices) {
    const posted = new Date(inv.posting_datetime)
    const key = monthKey(posted)
    totalsByMonth.set(key, (totalsByMonth.get(key) ?? 0) + inv.net_total)
    if (!latest || posted > latest) latest = posted
  }

  const windowEnd = latest ?? new Date()
  const endMonth = new Date(Date.UTC(windowEnd.getUTCFullYear(), windowEnd.getUTCMonth(), 1))

  const trend: MonthlyRevenue[] = []
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = addMonthsUtc(endMonth, -i)
    const key = monthKey(monthStart)
    trend.push({ month: key, netRevenue: totalsByMonth.get(key) ?? 0 })
  }
  return trend
}
