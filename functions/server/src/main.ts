/**
 * `shield-server` — the single deployed Appwrite Function. Every server-side
 * operation is a route on it, dispatched by URL path. One deployment keeps the
 * project inside the free-tier function cap and gives every operation the same
 * auth model (per-execution dynamic API key) and wire envelope.
 *
 * Routes (client sets `xpath`):
 *   POST /allocate-reference-id  { entity }                  → { referenceId, prefix, year, sequence }
 *   POST /submit-document        { table, rowId }            → { table, rowId, referenceId, docStatus, postingDatetime }
 *   POST /cancel-document        { table, rowId, reason }    → { table, rowId, referenceId, docStatus }
 *   POST /post-stock-ledger      { voucherType, voucherNo, postingDatetime, moves } → { voucherNo, entries, balances }
 *   POST /post-gl                { voucherType, voucherNo, postingDatetime, branchId?, lines } → { voucherNo, entries }
 *   POST /segregation-guard      { table, rowId }           → { violated, clean }
 *
 * Business logic lives in `functions/routes/*` as pure, unit-tested functions
 * that take a `TablesDB` — this file only wires the request to them.
 */
import { tablesDbFromRequest, usersServiceFromRequest } from '../../common/appwrite'
import { jsonHandler, type FnContext } from '../../common/handler'
import { runInTransaction } from '../../common/transaction'
import { allocateReferenceId, type AllocateInput } from '../../routes/allocate-reference-id'
import { cancelDocument, type CancelInput } from '../../routes/cancel-document'
import {
  decideApprovalRequest,
  type DecideApprovalInput,
} from '../../routes/decide-approval'
import { evaluateApproval, type EvaluateApprovalInput } from '../../routes/evaluate-approval'
import { fraudScan, type FraudScanInput } from '../../routes/fraud-scan'
import { postGl, type PostGlInput } from '../../routes/post-gl'
import {
  createPortalAccount,
  resetPortalPin,
  revokePortalAccess,
  type CreatePortalAccountInput,
  type ResetPortalPinInput,
  type RevokePortalAccessInput,
} from '../../routes/portal-account'
import {
  getPortalInvoiceDetail,
  getPortalMe,
  listPortalInvoices,
  listPortalReceipts,
  type GetPortalInvoiceDetailInput,
  type ListPortalInvoicesInput,
  type ListPortalReceiptsInput,
} from '../../routes/portal-data'
import { postStockLedger, type PostStockLedgerInput } from '../../routes/post-stock-ledger'
import {
  reviewFraudFlag,
  type ReviewFraudFlagInput,
} from '../../routes/review-fraud-flag'
import { segregationGuard, type SegregationGuardInput } from '../../routes/segregation-guard'
import { submitDocument, type SubmitInput } from '../../routes/submit-document'

type Route = (context: FnContext) => Promise<unknown>

const routes: Record<string, Route> = {
  // A single atomic `incrementRowColumn` — no transaction needed.
  '/allocate-reference-id': jsonHandler<AllocateInput>(async ({ body, req, caller }) =>
    allocateReferenceId(tablesDbFromRequest(req), body, caller),
  ),
  // Read-check-write + audit: wrapped so the transition and its audit row
  // commit together, and concurrent writers of the same row conflict.
  '/submit-document': jsonHandler<SubmitInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => submitDocument(db, body, caller)),
  ),
  '/cancel-document': jsonHandler<CancelInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => cancelDocument(db, body, caller)),
  ),
  '/post-stock-ledger': jsonHandler<PostStockLedgerInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => postStockLedger(db, body, caller)),
  ),
  '/post-gl': jsonHandler<PostGlInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => postGl(db, body, caller)),
  ),
  // Read-only pre-check — no transaction, no audit row.
  '/segregation-guard': jsonHandler<SegregationGuardInput>(async ({ body, req, caller }) =>
    segregationGuard(tablesDbFromRequest(req), body, caller),
  ),
  '/fraud-scan': jsonHandler<FraudScanInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => fraudScan(db, body, caller)),
  ),
  '/review-fraud-flag': jsonHandler<ReviewFraudFlagInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => reviewFraudFlag(db, body, caller)),
  ),
  // Read-then-write-once (idempotent replay on repeat evaluation) — no
  // conflicting concurrent writers to guard against, but wrapped anyway for a
  // consistent audit-atomicity story.
  '/evaluate-approval': jsonHandler<EvaluateApprovalInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => evaluateApproval(db, body, caller)),
  ),
  '/decide-approval': jsonHandler<DecideApprovalInput>(async ({ body, req, caller }) =>
    runInTransaction(tablesDbFromRequest(req), (db) => decideApprovalRequest(db, body, caller)),
  ),
  // CRM client portal (Phase 3). The `Users` service can't participate in a
  // TablesDB transaction, so these three stay un-transacted (see
  // `functions/routes/portal-account.ts`'s header comment).
  '/portal-account/create': jsonHandler<CreatePortalAccountInput>(async ({ body, req, caller }) =>
    createPortalAccount(tablesDbFromRequest(req), usersServiceFromRequest(req), body, caller),
  ),
  '/portal-account/reset': jsonHandler<ResetPortalPinInput>(async ({ body, req, caller }) =>
    resetPortalPin(tablesDbFromRequest(req), usersServiceFromRequest(req), body, caller),
  ),
  '/portal-account/revoke': jsonHandler<RevokePortalAccessInput>(async ({ body, req, caller }) =>
    revokePortalAccess(tablesDbFromRequest(req), usersServiceFromRequest(req), body, caller),
  ),
  // Read-only, customer-scoped — no transaction, no audit row.
  '/portal/me': jsonHandler(async ({ req, caller }) => getPortalMe(tablesDbFromRequest(req), caller)),
  '/portal/invoices': jsonHandler<ListPortalInvoicesInput>(async ({ body, req, caller }) =>
    listPortalInvoices(tablesDbFromRequest(req), body, caller),
  ),
  '/portal/invoice-detail': jsonHandler<GetPortalInvoiceDetailInput>(async ({ body, req, caller }) =>
    getPortalInvoiceDetail(tablesDbFromRequest(req), body, caller),
  ),
  '/portal/receipts': jsonHandler<ListPortalReceiptsInput>(async ({ body, req, caller }) =>
    listPortalReceipts(tablesDbFromRequest(req), body, caller),
  ),
}

function normalizePath(raw: string | undefined): string {
  const path = (raw ?? '/').split('?')[0] ?? '/'
  const trimmed = path.replace(/\/+$/, '')
  return trimmed === '' ? '/' : trimmed
}

export default async function main(context: FnContext): Promise<unknown> {
  const path = normalizePath(context.req.path)
  const route = routes[path]
  if (!route) {
    return context.res.json(
      {
        ok: false,
        error: {
          code: 'not_found',
          message: `no route for "${path}" — expected one of ${Object.keys(routes).join(', ')}`,
        },
      },
      404,
    )
  }
  return route(context)
}
