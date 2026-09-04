/**
 * Customer receivables aging (Implementation Plan Phase 2, Story 2.5).
 *
 * Buckets are `0-30 / 31-60 / 61-90 / 90+` days, measured from an invoice's
 * `posting_datetime` to an `asOf` date. `customerAging` reduces a customer's
 * submitted invoices and receipts into one outstanding balance plus the
 * per-bucket split of the still-unpaid remainder.
 *
 * Model decisions (documented here — they are the single source, sales imports
 * this):
 *  - Only `doc_status === 1` (Submitted) invoices count. Drafts and Cancelled
 *    invoices never enter receivables.
 *  - Only invoices whose `payment_method` is one of
 *    {@link RECEIVABLE_INVOICE_METHODS} create a receivable ("credit-side").
 *    A fully-cash / bank-transfer invoice is settled at the point of sale and
 *    is excluded. A `partial` invoice counts in full here because this module
 *    reads only `net_total`, not the split — err toward showing more exposure.
 *  - Receipts are applied oldest-invoice-first (FIFO) so the *aged* remainder
 *    lands in the correct bucket. `outstanding` itself is simply
 *    `Σ net_total − Σ receipts` and may go negative if a customer overpaid.
 *  - `oldestDays` is the age of the oldest invoice that still has an unpaid
 *    remainder, or `0` when the customer is square.
 *
 * Pure — no framework imports.
 */

export const AGING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const
export type AgingBucket = (typeof AGING_BUCKETS)[number]

/** Invoice payment methods that put the balance on the customer's account. */
export const RECEIVABLE_INVOICE_METHODS = ['credit', 'partial', 'post_dated_cheque'] as const

const RECEIVABLE_METHOD_SET: ReadonlySet<string> = new Set(RECEIVABLE_INVOICE_METHODS)

const SUBMITTED = 1
const MS_PER_DAY = 86_400_000

/** Which bucket a given whole-day age falls in. Non-positive ages → `0-30`. */
export function bucketFor(daysOutstanding: number): AgingBucket {
  if (daysOutstanding <= 30) return '0-30'
  if (daysOutstanding <= 60) return '31-60'
  if (daysOutstanding <= 90) return '61-90'
  return '90+'
}

/** The minimal invoice shape aging needs (a subset of `invoiceForAgingSchema`). */
export interface AgingInvoice {
  customer_id: string
  net_total: number
  payment_method: string
  posting_datetime: string
  doc_status: number
}

/** The minimal receipt shape aging needs. */
export interface AgingReceipt {
  customer_id: string
  amount: number
}

export interface CustomerAging {
  customerId: string
  /** `Σ credit-side net_total − Σ receipts`. May be negative (overpaid). */
  outstanding: number
  /** The unpaid remainder split by age bucket. Sums to `max(outstanding, 0)`. */
  buckets: Record<AgingBucket, number>
  /** Age in whole days of the oldest still-unpaid invoice; `0` when square. */
  oldestDays: number
}

function emptyBuckets(): Record<AgingBucket, number> {
  return { '0-30': 0, '31-60': 0, '61-90': 0, '90+': 0 }
}

function daysBetween(from: Date, to: Date): number {
  return Math.floor((to.getTime() - from.getTime()) / MS_PER_DAY)
}

/**
 * Per-customer aging as of `asOf`. Returns one entry per customer that has at
 * least one qualifying invoice or receipt, sorted by `customerId` for
 * deterministic output.
 */
export function customerAging(
  invoices: readonly AgingInvoice[],
  receipts: readonly AgingReceipt[],
  asOf: Date,
): CustomerAging[] {
  const invoicesByCustomer = new Map<string, AgingInvoice[]>()
  for (const inv of invoices) {
    if (inv.doc_status !== SUBMITTED) continue
    if (!RECEIVABLE_METHOD_SET.has(inv.payment_method)) continue
    const list = invoicesByCustomer.get(inv.customer_id) ?? []
    list.push(inv)
    invoicesByCustomer.set(inv.customer_id, list)
  }

  const receiptsByCustomer = new Map<string, number>()
  for (const rec of receipts) {
    receiptsByCustomer.set(
      rec.customer_id,
      (receiptsByCustomer.get(rec.customer_id) ?? 0) + rec.amount,
    )
  }

  const customerIds = new Set<string>([...invoicesByCustomer.keys(), ...receiptsByCustomer.keys()])

  const result: CustomerAging[] = []
  for (const customerId of [...customerIds].sort()) {
    const custInvoices = [...(invoicesByCustomer.get(customerId) ?? [])].sort((a, b) =>
      a.posting_datetime.localeCompare(b.posting_datetime),
    )
    const totalInvoiced = custInvoices.reduce((sum, inv) => sum + inv.net_total, 0)
    const totalReceipts = receiptsByCustomer.get(customerId) ?? 0

    const buckets = emptyBuckets()
    let remainingReceipts = totalReceipts
    let oldestDays = 0

    for (const inv of custInvoices) {
      const applied = Math.min(remainingReceipts, inv.net_total)
      remainingReceipts -= applied
      const unpaid = inv.net_total - applied
      if (unpaid <= 0) continue
      const age = daysBetween(new Date(inv.posting_datetime), asOf)
      buckets[bucketFor(age)] += unpaid
      if (age > oldestDays) oldestDays = age
    }

    result.push({
      customerId,
      outstanding: totalInvoiced - totalReceipts,
      buckets,
      oldestDays,
    })
  }

  return result
}

/** Σ of the three overdue buckets (everything past 30 days). */
export function overdueTotal(aging: Pick<CustomerAging, 'buckets'>): number {
  return aging.buckets['31-60'] + aging.buckets['61-90'] + aging.buckets['90+']
}
