/**
 * Build a `node-appwrite` client for a Function execution.
 *
 * Auth is Appwrite's per-execution **dynamic API key**: when a Function declares
 * `scopes`, Appwrite injects a short-lived key in the `x-appwrite-key` request
 * header. Nothing is stored in the Function's env — there is no long-lived
 * secret to leak. Endpoint + project come from the runtime-provided vars.
 */
import { Client, TablesDB, Users } from 'node-appwrite'

export const DATABASE_ID = 'shield_pro'

interface RequestLike {
  headers: Record<string, string | undefined>
}

/** Build the per-execution `node-appwrite` client every service wrapper below shares. */
function clientFromRequest(req: RequestLike): Client {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID
  const apiKey = req.headers['x-appwrite-key'] ?? ''

  if (!endpoint || !project) {
    throw new Error('APPWRITE_FUNCTION_API_ENDPOINT / APPWRITE_FUNCTION_PROJECT_ID are not set')
  }
  if (!apiKey) {
    throw new Error('missing x-appwrite-key header — the Function has no scopes granted')
  }

  return new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
}

export function tablesDbFromRequest(req: RequestLike): TablesDB {
  return new TablesDB(clientFromRequest(req))
}

/**
 * `node-appwrite`'s `Users` service, scoped to this execution's dynamic API
 * key (the Function's `users.read` / `users.write` / `sessions.write`
 * scopes). Used by the `portal-account` routes to create/reset/revoke a
 * customer's CRM portal Auth account.
 */
export function usersServiceFromRequest(req: RequestLike): Users {
  return new Users(clientFromRequest(req))
}
