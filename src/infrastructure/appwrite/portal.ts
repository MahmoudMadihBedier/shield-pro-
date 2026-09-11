/**
 * Data layer for the CRM **client portal** — every call runs on the dedicated
 * `portalSupabase` client (its own `storageKey`), so a customer session never
 * collides with a staff session in the same browser.
 *
 * Auth: the customer's PIN is the password on a synthetic
 * `<code>@portal.shieldpro.local` account (created by the `portal-account` Edge
 * Function). Reads go through the `portal_*` SECURITY DEFINER RPCs (migration
 * 0005), which resolve the caller's own `customers` row by
 * `portal_user_id = auth.uid()` — never from an argument.
 *
 * Everything returns a `Result<T, AppError>`; raw Supabase errors never escape.
 */
import { z } from 'zod'

import { appError } from '@/core/errors'
import { err, ok, type Result } from '@/core/result'

import { portalSupabase } from './client'
import { mapAppwriteError } from './errors'
import type {
  PortalInvoiceDetailResult,
  PortalInvoiceListPayload,
  PortalInvoiceListResult,
  PortalMeResult,
  PortalReceiptListPayload,
  PortalReceiptListResult,
} from './functions'

// --- auth ------------------------------------------------------------------

export async function portalSignIn(email: string, password: string): Promise<Result<null>> {
  try {
    const { error } = await portalSupabase.auth.signInWithPassword({ email, password })
    if (error) return err(mapAppwriteError(error))
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

export async function portalSignOut(): Promise<Result<null>> {
  try {
    const { error } = await portalSupabase.auth.signOut()
    if (error) return err(mapAppwriteError(error))
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/**
 * Change the signed-in customer's PIN. Supabase's `updateUser` does not verify
 * the current password, so re-authenticate first — a stolen-but-unlocked
 * session must not be able to silently change the PIN.
 */
export async function portalUpdatePin(nextPin: string, currentPin: string): Promise<Result<null>> {
  try {
    const { data } = await portalSupabase.auth.getUser()
    const email = data.user?.email
    if (!email) return err(appError('unauthorized', 'انتهت الجلسة. سجّل الدخول من جديد.'))

    const { error: reauth } = await portalSupabase.auth.signInWithPassword({
      email,
      password: currentPin,
    })
    if (reauth) return err(mapAppwriteError(reauth))

    const { error } = await portalSupabase.auth.updateUser({ password: nextPin })
    if (error) return err(mapAppwriteError(error))
    return ok(null)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

// --- reads (portal_* RPCs) ----------------------------------------------

async function portalRpc<T>(fn: string, args: Record<string, unknown>): Promise<Result<T>> {
  try {
    const { data, error } = await portalSupabase.rpc(fn, args)
    if (error) return err(mapAppwriteError(error))
    return ok(data as T)
  } catch (e) {
    return err(mapAppwriteError(e))
  }
}

/** The signed-in customer's own profile, or a `not_found` error if no link. */
export async function portalMe(): Promise<Result<PortalMeResult>> {
  const res = await portalRpc<PortalMeResult | null>('portal_me', {})
  if (!res.ok) return res
  if (res.value == null) {
    return err(appError('forbidden', 'لا يوجد حساب عميل مرتبط بهذه الجلسة.'))
  }
  return ok(res.value)
}

export function portalInvoices(
  payload: PortalInvoiceListPayload = {},
): Promise<Result<PortalInvoiceListResult>> {
  return portalRpc<PortalInvoiceListResult>('portal_invoices', {
    p_page: payload.page ?? 0,
    p_page_size: payload.pageSize ?? null,
  })
}

export function portalInvoiceDetail(invoiceId: string): Promise<Result<PortalInvoiceDetailResult>> {
  return portalRpc<PortalInvoiceDetailResult>('portal_invoice_detail', { p_invoice_id: invoiceId })
}

export function portalReceipts(
  payload: PortalReceiptListPayload = {},
): Promise<Result<PortalReceiptListResult>> {
  return portalRpc<PortalReceiptListResult>('portal_receipts', {
    p_page: payload.page ?? 0,
    p_page_size: payload.pageSize ?? null,
  })
}

// --- account statement (portal_statement RPC, migration 0028) -------------

const statementRowSchema = z.object({
  date: z.string(),
  kind: z.enum(['invoice', 'return', 'receipt']),
  reference: z.string(),
  debit: z.number().finite(),
  credit: z.number().finite(),
  balance: z.number().finite(),
})
const statementSchema = z.object({
  rows: z.array(statementRowSchema),
  totalDebit: z.number().finite(),
  totalCredit: z.number().finite(),
  closingBalance: z.number().finite(),
})
export type PortalStatementRow = z.infer<typeof statementRowSchema>
export type PortalStatementResult = z.infer<typeof statementSchema>

/**
 * The signed-in customer's full running-balance account statement — computed
 * server-side over the whole history (credit-side invoices as debits, return
 * credit notes and submitted receipts as credits), so it never depends on the
 * newest-100 page cap of the list reads.
 */
export async function portalStatement(): Promise<Result<PortalStatementResult>> {
  const res = await portalRpc<unknown>('portal_statement', {})
  if (!res.ok) return res
  const parsed = statementSchema.safeParse(res.value)
  if (!parsed.success) {
    return err(
      appError('server', 'تعذّر إعداد كشف الحساب — بيانات غير متوقعة من الخادم.', {
        detail: parsed.error.message,
      }),
    )
  }
  return ok(parsed.data)
}
