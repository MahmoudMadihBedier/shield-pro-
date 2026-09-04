/**
 * `/post-stock-ledger` — the ONLY writer of `stock_ledger_entries` and the
 * `bin_balances` projection (Implementation Plan §4.3, Phase 1 Story 1.3).
 *
 * Ledgers are append-only: a voucher is posted exactly once. A second call with
 * the same `voucher_no` is a `conflict`, never a silent re-post or overwrite —
 * reversing a posting is a fresh, separately-vouchered entry (a later story).
 *
 * For each move we read the current `bin_balances` row for
 * `(product_id, warehouse_id)`, compute `qty_after` with the shared
 * `nextQtyAfter` guard (stock can never go negative), append one immutable SLE
 * row, then upsert the bin projection. Every call appends to `audit_log`.
 */
import { ID, Query, type TablesDB } from 'node-appwrite'

import { DATABASE_ID } from '../common/appwrite'
import { requireStaffCaller } from '../common/caller'
import { FnError } from '../common/handler'
import { appendAudit } from '../common/audit'
import { LedgerError, nextQtyAfter } from '@/core/ledger'

const SLE_TABLE = 'stock_ledger_entries'
const BIN_TABLE = 'bin_balances'

export interface StockMove {
  productId: string
  warehouseId: string
  lotNumber?: string | null
  qtyChange: number
  valuationRate?: number
}

export interface PostStockLedgerInput {
  voucherType: string
  voucherNo: string
  postingDatetime: string
  moves: StockMove[]
}

export interface PostStockLedgerOutput {
  voucherNo: string
  entries: number
  balances: Array<{ productId: string; warehouseId: string; qtyAfter: number }>
}

/** A `voucher_no` is already present in `table` → the voucher was posted before. */
async function alreadyPosted(tablesDB: TablesDB, table: string, voucherNo: string): Promise<boolean> {
  const found = await tablesDB.listRows({
    databaseId: DATABASE_ID,
    tableId: table,
    queries: [Query.equal('voucher_no', voucherNo), Query.limit(1)],
  })
  return (found.total ?? found.rows?.length ?? 0) > 0
}

export async function postStockLedger(
  tablesDB: TablesDB,
  input: PostStockLedgerInput,
  caller: string | null,
  now: Date = new Date(),
): Promise<PostStockLedgerOutput> {
  const voucherType = String(input?.voucherType ?? '').trim()
  const voucherNo = String(input?.voucherNo ?? '').trim()
  const postingDatetime = String(input?.postingDatetime ?? '').trim()
  const moves = Array.isArray(input?.moves) ? input.moves : []

  if (!caller) throw new FnError('unauthorized', 'a signed-in caller is required')
  await requireStaffCaller(tablesDB, caller)

  if (!voucherType) throw new FnError('validation', 'voucherType is required')
  if (!voucherNo) throw new FnError('validation', 'voucherNo is required')
  if (!postingDatetime) throw new FnError('validation', 'postingDatetime is required')
  if (moves.length === 0) throw new FnError('validation', 'at least one stock move is required')

  if (await alreadyPosted(tablesDB, SLE_TABLE, voucherNo)) {
    throw new FnError('conflict', `stock ledger already has entries for voucher "${voucherNo}"`)
  }

  const balances: PostStockLedgerOutput['balances'] = []

  for (const move of moves) {
    const productId = String(move?.productId ?? '').trim()
    const warehouseId = String(move?.warehouseId ?? '').trim()
    const qtyChange = Number(move?.qtyChange)
    const valuationRate = Number(move?.valuationRate ?? 0)
    const lotNumber = move?.lotNumber ?? null

    if (!productId || !warehouseId) {
      throw new FnError('validation', 'every move needs a productId and a warehouseId')
    }
    if (!Number.isFinite(qtyChange) || qtyChange === 0) {
      throw new FnError('validation', `move for ${productId}/${warehouseId} has an invalid qtyChange`)
    }
    if (!Number.isFinite(valuationRate) || valuationRate < 0) {
      throw new FnError(
        'validation',
        `move for ${productId}/${warehouseId} has an invalid valuationRate`,
      )
    }

    const bins = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId: BIN_TABLE,
      queries: [
        Query.equal('product_id', productId),
        Query.equal('warehouse_id', warehouseId),
        Query.limit(1),
      ],
    })
    const binRow = bins.rows?.[0] as { $id: string; qty: number } | undefined
    const currentQty = binRow ? Number(binRow.qty) : 0

    let qtyAfter: number
    try {
      qtyAfter = nextQtyAfter(currentQty, qtyChange)
    } catch (e) {
      if (e instanceof LedgerError) throw new FnError('validation', e.message)
      throw e
    }

    await tablesDB.createRow({
      databaseId: DATABASE_ID,
      tableId: SLE_TABLE,
      rowId: ID.unique(),
      data: {
        voucher_type: voucherType,
        voucher_no: voucherNo,
        product_id: productId,
        warehouse_id: warehouseId,
        lot_number: lotNumber,
        qty_change: qtyChange,
        qty_after: qtyAfter,
        valuation_rate: valuationRate,
        posting_datetime: postingDatetime,
        is_cancelled: false,
      },
    })

    const updatedDatetime = now.toISOString()
    if (binRow) {
      await tablesDB.updateRow({
        databaseId: DATABASE_ID,
        tableId: BIN_TABLE,
        rowId: binRow.$id,
        data: { qty: qtyAfter, updated_datetime: updatedDatetime },
      })
    } else {
      await tablesDB.createRow({
        databaseId: DATABASE_ID,
        tableId: BIN_TABLE,
        rowId: ID.unique(),
        data: {
          product_id: productId,
          warehouse_id: warehouseId,
          qty: qtyAfter,
          updated_datetime: updatedDatetime,
        },
      })
    }

    balances.push({ productId, warehouseId, qtyAfter })
  }

  await appendAudit(tablesDB, {
    actorId: caller,
    action: 'post_stock_ledger',
    entityType: SLE_TABLE,
    entityRef: voucherNo,
    after: { voucherType, entries: moves.length, balances },
  })

  return { voucherNo, entries: moves.length, balances }
}
