/**
 * Build a `node-appwrite` client for a Function execution.
 *
 * Auth is Appwrite's per-execution **dynamic API key**: when a Function declares
 * `scopes`, Appwrite injects a short-lived key in the `x-appwrite-key` request
 * header. Nothing is stored in the Function's env — there is no long-lived
 * secret to leak. Endpoint + project come from the runtime-provided vars.
 */
import { Client, TablesDB } from 'node-appwrite'

export const DATABASE_ID = 'shield_pro'

interface RequestLike {
  headers: Record<string, string | undefined>
}

export function tablesDbFromRequest(req: RequestLike): TablesDB {
  const endpoint = process.env.APPWRITE_FUNCTION_API_ENDPOINT
  const project = process.env.APPWRITE_FUNCTION_PROJECT_ID
  const apiKey = req.headers['x-appwrite-key'] ?? ''

  if (!endpoint || !project) {
    throw new Error('APPWRITE_FUNCTION_API_ENDPOINT / APPWRITE_FUNCTION_PROJECT_ID are not set')
  }
  if (!apiKey) {
    throw new Error('missing x-appwrite-key header — the Function has no scopes granted')
  }

  const client = new Client().setEndpoint(endpoint).setProject(project).setKey(apiKey)
  return new TablesDB(client)
}
