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
import { tablesDbFromRequest } from '../../common/appwrite'
import { jsonHandler, type FnContext } from '../../common/handler'
import { runInTransaction } from '../../common/transaction'
import { allocateReferenceId, type AllocateInput } from '../../routes/allocate-reference-id'
import { cancelDocument, type CancelInput } from '../../routes/cancel-document'
import { postGl, type PostGlInput } from '../../routes/post-gl'
import { postStockLedger, type PostStockLedgerInput } from '../../routes/post-stock-ledger'
import { segregationGuard, type SegregationGuardInput } from '../../routes/segregation-guard'
import { submitDocument, type SubmitInput } from '../../routes/submit-document'

type Route = (context: FnContext) => Promise<unknown>

const routes: Record<string, Route> = {
  // A single atomic `incrementRowColumn` — no transaction needed.
  '/allocate-reference-id': jsonHandler<AllocateInput>(async ({ body, req }) =>
    allocateReferenceId(tablesDbFromRequest(req), body),
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
