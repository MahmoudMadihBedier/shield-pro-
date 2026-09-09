/**
 * Read repo for the inventory valuation report. No new query surface: the
 * `inventory_valuation` RPC (migration 0025) aggregates over `bin_balances` ×
 * the stock ledger, warehouse-scoped server-side. Zod-checks the payload
 * before the domain trusts it (`claude.md` B.2).
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { fetchInventoryValuation } from '@/infrastructure/appwrite/functions'

import type { ValuationReport } from '../domain/valuation'

const rowSchema = z.object({
  productId: z.string(),
  warehouseId: z.string(),
  qty: z.number().finite(),
  unitCost: z.number().finite(),
  value: z.number().finite(),
  hasCost: z.boolean().default(true),
})
const reportSchema = z.object({
  rows: z.array(rowSchema),
  totalValue: z.number().finite(),
  lineCount: z.number().int().nonnegative(),
  uncostedLineCount: z.number().int().nonnegative().default(0),
})

export async function inventoryValuation(): Promise<Result<ValuationReport>> {
  const res = await fetchInventoryValuation()
  if (!res.ok) return res

  const parsed = reportSchema.safeParse(res.value)
  if (!parsed.success) {
    return err(
      appError('server', 'تعذّر إعداد تقييم المخزون — بيانات غير متوقعة من الخادم.', {
        detail: parsed.error.message,
      }),
    )
  }
  return ok(parsed.data)
}
