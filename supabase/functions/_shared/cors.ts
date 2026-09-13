/**
 * CORS headers shared by every Edge Function the browser calls directly
 * (`supabase.functions.invoke(...)` from `src/infrastructure/appwrite/
 * functions.ts`). Supabase's Edge Runtime does NOT add these automatically —
 * every function must set them itself, on every response, including error
 * responses, or the browser blocks the request as a failed CORS preflight
 * before the function's own logic ever runs. That failure surfaces to the
 * SDK as a generic `FunctionsFetchError` with no body to read, which
 * `mapAppwriteError` (having nothing more specific to go on) reports as
 * "Something went wrong." — indistinguishable, client-side, from the
 * function actually crashing. Confirmed by hand: an `OPTIONS` preflight
 * against the deployed `portal-account` function returned 405 with no
 * `Access-Control-*` headers at all before this fix.
 *
 * The app is not a public API — access is already gated by the caller's
 * Supabase JWT (checked inside each function) — so a wildcard origin is
 * fine here; it does not widen who can act, only who can *reach* the
 * function to find out they're unauthorized.
 */
export const CORS_HEADERS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
}

/** `OPTIONS` preflight short-circuit — call this before any other request handling. */
export function handleCorsPreflight(req: Request): Response | null {
  return req.method === 'OPTIONS' ? new Response(null, { status: 204, headers: CORS_HEADERS }) : null
}
