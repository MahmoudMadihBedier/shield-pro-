/**
 * Bank statement lines (migration 0041) — an imported, mostly-read record of
 * the company's own bank statement. Not a submittable document: no
 * doc_status, no ledger, no approval — a plain paginated read plus a
 * reconciled flag toggled by a narrow RPC.
 *
 * `domain` is pure TypeScript — Zod only, no react / appwrite / vite.
 */
import { z } from 'zod'

const rowOptStr = z.string().nullish()
const rowOptNum = z.number().nullish()

/** Exactly what the `tablesDB` shim returns for a `bank_statement_lines` row. */
export const bankStatementLineRowSchema = z.object({
  $id: z.string(),
  $createdAt: z.string(),
  $updatedAt: z.string(),
  statement_date: z.string(),
  description: z.string(),
  reference: rowOptStr,
  debit: z.number(),
  credit: z.number(),
  balance: rowOptNum,
  reconciled: z.boolean(),
  reconciled_by: rowOptStr,
  reconciled_at: rowOptStr,
  imported_by: z.string(),
  batch_ref: z.string(),
})
export type BankStatementLine = z.infer<typeof bankStatementLineRowSchema>

/** The CSV import row shape (Plan §4.1). */
export const bankStatementImportRowSchema = z.object({
  statement_date: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'statement_date يجب أن يكون بصيغة YYYY-MM-DD'),
  description: z.string().trim().min(1, 'description مطلوب'),
  reference: z.string().trim().optional(),
  debit: z.coerce.number({ error: 'debit يجب أن يكون رقمًا' }).nonnegative('debit يجب ألا يكون سالبًا'),
  credit: z.coerce
    .number({ error: 'credit يجب أن يكون رقمًا' })
    .nonnegative('credit يجب ألا يكون سالبًا'),
  balance: z.coerce.number().optional(),
})
export type BankStatementImportRow = z.infer<typeof bankStatementImportRowSchema>
