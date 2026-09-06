/**
 * `portal-account` — admin-triggered lifecycle for a customer's CRM portal
 * auth account (create / reset / revoke). Replaces the Appwrite
 * `functions/routes/portal-account.ts` route.
 *
 * This is an Edge Function rather than a Postgres RPC because it must call the
 * Auth admin API (`auth.admin.*`), which SQL cannot reach. The portal
 * password IS the customer's PIN — Supabase Auth owns hashing / rate-limiting
 * / sessions. Shield Pro never persists a PIN: it is generated here, set on
 * the auth user, and returned to the calling admin exactly once.
 *
 * Body: { action: 'create' | 'reset' | 'revoke', customerId: string }
 * Success: 200 with the action's result object.
 * Failure: 4xx/5xx with { error: string }.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const PORTAL_EMAIL_DOMAIN = 'portal.shieldpro.local'
const PORTAL_ADMIN_ROLES = ['system_admin', 'branch_accountant', 'chief_accountant']
/** ~100 years — effectively permanent, until an admin lifts it via `create`/reset flow. */
const BAN_FOREVER = '876000h'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

function portalEmailForCode(code: string): string {
  return `${code.trim().toLowerCase()}@${PORTAL_EMAIL_DOMAIN}`
}

/** An 8-digit cryptographically-random PIN. */
function generatePin(): string {
  const n = crypto.getRandomValues(new Uint32Array(1))[0] % 100_000_000
  return String(n).padStart(8, '0')
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization') ?? ''
  if (!authHeader.startsWith('Bearer '))
    return json({ error: 'a signed-in staff caller is required' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { Authorization: authHeader } },
  })

  // --- identify + authorise the caller -------------------------------------
  const { data: userData, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'a signed-in staff caller is required' }, 401)
  const callerId = userData.user.id

  const { data: profile, error: profileErr } = await admin
    .from('users')
    .select('roles')
    .eq('auth_user_id', callerId)
    .maybeSingle()
  if (profileErr) return json({ error: profileErr.message }, 500)
  const roles = String(profile?.roles ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (roles.length === 0) return json({ error: 'this action is restricted to staff accounts' }, 403)
  if (!roles.some((r) => PORTAL_ADMIN_ROLES.includes(r))) {
    return json({ error: 'your role may not manage CRM portal accounts' }, 403)
  }

  // --- parse the request -------------------------------------------------
  let payload: { action?: string; customerId?: string }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const action = payload.action
  const customerId = String(payload.customerId ?? '')
  if (!customerId) return json({ error: 'customerId is required' }, 400)
  if (action !== 'create' && action !== 'reset' && action !== 'revoke') {
    return json({ error: 'action must be create, reset or revoke' }, 400)
  }

  // --- load the customer ------------------------------------------------
  const { data: customer, error: custErr } = await admin
    .from('customers')
    .select('id, code, name, portal_user_id')
    .eq('id', customerId)
    .maybeSingle()
  if (custErr) return json({ error: custErr.message }, 500)
  if (!customer) return json({ error: `customer ${customerId} does not exist` }, 404)
  const portalUserId: string | null =
    customer.portal_user_id && String(customer.portal_user_id).trim() !== ''
      ? String(customer.portal_user_id)
      : null

  async function audit(actionName: string, after: Record<string, unknown>) {
    await admin.from('audit_log').insert({
      actor_id: callerId,
      action: actionName,
      entity_type: 'customers',
      entity_ref: String(customer.code).slice(0, 32),
      before: 'null',
      after: JSON.stringify(after),
      created_at: new Date().toISOString(),
    })
  }

  // --- create ---------------------------------------------------------
  if (action === 'create') {
    if (portalUserId) {
      return json({ error: 'this customer already has a portal account — use reset instead' }, 409)
    }
    const pin = generatePin()
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: portalEmailForCode(customer.code),
      password: pin,
      email_confirm: true,
      user_metadata: { name: customer.name, portal_customer_id: customer.id },
    })
    if (createErr || !created.user)
      return json({ error: createErr?.message ?? 'could not create account' }, 500)

    const { error: linkErr } = await admin
      .from('customers')
      .update({ portal_user_id: created.user.id })
      .eq('id', customer.id)
    if (linkErr) {
      // roll back the orphaned auth user
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
      return json({ error: linkErr.message }, 500)
    }
    await audit('create_portal_account', { portalUserId: created.user.id })
    return json({ portalUserId: created.user.id, pin })
  }

  // --- reset ---------------------------------------------------------
  if (action === 'reset') {
    if (!portalUserId)
      return json({ error: 'this customer has no portal account — create one first' }, 400)
    const pin = generatePin()
    const { error: resetErr } = await admin.auth.admin.updateUserById(portalUserId, {
      password: pin,
      ban_duration: 'none',
    })
    if (resetErr) return json({ error: resetErr.message }, 500)
    await audit('reset_portal_pin', { portalUserId })
    return json({ pin })
  }

  // --- revoke -------------------------------------------------------
  if (!portalUserId) return json({ error: 'this customer has no portal account to revoke' }, 400)
  const { error: revokeErr } = await admin.auth.admin.updateUserById(portalUserId, {
    ban_duration: BAN_FOREVER,
  })
  if (revokeErr) return json({ error: revokeErr.message }, 500)
  await admin.auth.admin.signOut(portalUserId, 'global').catch(() => {})
  await audit('revoke_portal_access', { portalUserId })
  return json({ revoked: true })
})
