/**
 * `payroll_runs` — a submittable document (Draft → Submitted → Cancelled).
 * Lifecycle (`createDraft` / `submit` / `cancel`) goes through the shared
 * `makeDocumentRepo` factory (`@/shared/documents`), same as every other
 * business document in the app.
 */
import { makeDocumentRepo, type DocumentRepo } from '@/shared/documents'

import { payrollRunRowSchema, type PayrollRunRow } from '../domain/schemas'

/** The plain field bag `createDraft` writes — `lines` already JSON-serialised. */
export interface PayrollRunWriteFields extends Record<string, unknown> {
  pay_period_start: string
  pay_period_end: string
  lines: string
  total_net_pay: number
}

export const payrollRunsRepo: DocumentRepo<PayrollRunRow, PayrollRunWriteFields> = makeDocumentRepo({
  entity: 'PayrollRun',
  rowSchema: payrollRunRowSchema,
})
