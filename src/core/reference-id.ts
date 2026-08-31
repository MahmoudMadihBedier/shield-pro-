/**
 * Human-readable, immutable reference IDs — the backbone of the traceability
 * chain (Business Process doc §4, Master Plan §1.1). Modelled on ERPNext's
 * "naming series" (e.g. `MAT-SLE-.YYYY.-.#####`).
 *
 * Format: `<PREFIX>-<YYYY>-<zero-padded sequence>`  e.g. `INV-2026-00042`.
 *
 * IMPORTANT: the sequence number MUST be allocated by a single server-side
 * authority (an Appwrite Function backed by an atomic counter row) so the
 * series is gap-free and non-reusable — an auditor treats a missing number as
 * a red flag. This module only formats/parses; it never invents a sequence.
 *
 * `core` has ZERO framework imports — plain TypeScript only.
 */

export const REFERENCE_PREFIXES = {
  PurchaseOrder: 'PO',
  StockReceipt: 'SR',
  ProductionRequest: 'PR',
  ProductionBatch: 'BATCH',
  WarehouseTransfer: 'TRF',
  RepStockIssue: 'ISS',
  SalesInvoice: 'INV',
  Receipt: 'REC',
  PaymentVoucher: 'PV',
  ReturnRequest: 'RET',
  WriteOff: 'WO',
  AdjustmentEntry: 'ADJ',
  StockLedgerEntry: 'SLE',
  GeneralLedgerEntry: 'GLE',
  StockCountSession: 'CNT',
  RepCloseout: 'CLZ',
} as const

export type ReferenceEntity = keyof typeof REFERENCE_PREFIXES
export type ReferencePrefix = (typeof REFERENCE_PREFIXES)[ReferenceEntity]

const SEQUENCE_PAD = 5

export function formatReferenceId(
  entity: ReferenceEntity,
  sequence: number,
  year: number = new Date().getUTCFullYear(),
): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(`reference sequence must be a positive integer, got ${sequence}`)
  }
  const prefix = REFERENCE_PREFIXES[entity]
  return `${prefix}-${year}-${String(sequence).padStart(SEQUENCE_PAD, '0')}`
}

export interface ParsedReferenceId {
  prefix: ReferencePrefix
  year: number
  sequence: number
}

const REFERENCE_RE = /^([A-Z]+)-(\d{4})-(\d+)$/

export function parseReferenceId(id: string): ParsedReferenceId | null {
  const match = REFERENCE_RE.exec(id)
  if (!match) return null
  const [, prefix, year, sequence] = match
  const known = (Object.values(REFERENCE_PREFIXES) as string[]).includes(prefix!)
  if (!known) return null
  return {
    prefix: prefix as ReferencePrefix,
    year: Number(year),
    sequence: Number(sequence),
  }
}

export function isReferenceId(value: string): boolean {
  return parseReferenceId(value) !== null
}
