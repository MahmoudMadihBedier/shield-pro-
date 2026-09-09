/**
 * Read repo for the supplier-performance report. No new query surface: the
 * `supplier_performance` RPC (migration 0027) aggregates over `purchase_orders`
 * branch-scoped server-side. Zod-checks the payload before the domain trusts
 * it (`claude.md` B.2).
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'
import { fetchSupplierPerformance } from '@/infrastructure/appwrite/functions'

import type { SupplierPerformanceReport } from '../domain/supplier-performance'

const rowSchema = z.object({
  supplierId: z.string(),
  supplierName: z.string(),
  orderCount: z.number().int().nonnegative(),
  submittedValue: z.number().finite(),
  avgOrderValue: z.number().finite(),
  cancelledCount: z.number().int().nonnegative(),
  cancelRate: z.number().finite(),
  firstOrderAt: z.string().nullable(),
  lastOrderAt: z.string().nullable(),
})
const reportSchema = z.object({
  rows: z.array(rowSchema),
  totalSpend: z.number().finite(),
  supplierCount: z.number().int().nonnegative(),
})

export async function supplierPerformance(): Promise<Result<SupplierPerformanceReport>> {
  const res = await fetchSupplierPerformance()
  if (!res.ok) return res

  const parsed = reportSchema.safeParse(res.value)
  if (!parsed.success) {
    return err(
      appError('server', 'تعذّر إعداد تقرير أداء الموردين — بيانات غير متوقعة من الخادم.', {
        detail: parsed.error.message,
      }),
    )
  }
  return ok(parsed.data)
}
