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
 *
 * Business logic lives in `functions/routes/*` as pure, unit-tested functions
 * that take a `TablesDB` — this file only wires the request to them.
 */
import { tablesDbFromRequest } from '../../common/appwrite'
import { jsonHandler, type FnContext } from '../../common/handler'
import { allocateReferenceId, type AllocateInput } from '../../routes/allocate-reference-id'
import { cancelDocument, type CancelInput } from '../../routes/cancel-document'
import { submitDocument, type SubmitInput } from '../../routes/submit-document'

type Route = (context: FnContext) => Promise<unknown>

const routes: Record<string, Route> = {
  '/allocate-reference-id': jsonHandler<AllocateInput>(async ({ body, req }) =>
    allocateReferenceId(tablesDbFromRequest(req), body),
  ),
  '/submit-document': jsonHandler<SubmitInput>(async ({ body, req, caller }) =>
    submitDocument(tablesDbFromRequest(req), body, caller),
  ),
  '/cancel-document': jsonHandler<CancelInput>(async ({ body, req, caller }) =>
    cancelDocument(tablesDbFromRequest(req), body, caller),
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
