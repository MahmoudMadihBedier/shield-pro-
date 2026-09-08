/**
 * `staff-account` — System-Admin lifecycle for a staff member's login:
 * create (auth user + `public.users` profile), update (profile fields + email),
 * and reset-password. An Edge Function rather than a Postgres RPC because it
 * calls the Auth admin API (`auth.admin.*`) which SQL cannot reach.
 *
 * Body: { action: 'create' | 'update' | 'reset-password', ... }
 *   create:         { email, password, fullName, roles: string[], branchId?, subWarehouseId?, jobGrade? }
 *   update:         { userId, fullName, email, roles: string[], branchId?, subWarehouseId?, jobGrade?, isActive }
 *   reset-password: { userId, password }
 *
 * Success: 200 with the action's result. Failure: 4xx/5xx with { error }.
 * Every action appends to audit_log.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!

const VALID_ROLES = new Set([
  'system_admin',
  'factory_manager',
  'raw_store_keeper',
  'main_warehouse_manager',
  'sub_warehouse_manager',
  'sales_rep',
  'branch_accountant',
  'factory_accountant',
  'purchasing_accountant',
  'main_warehouse_accountant',
  'chief_accountant',
])
const BAN_FOREVER = '876000h'

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function cleanRoles(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return [...new Set(input.map((r) => String(r).trim()).filter((r) => VALID_ROLES.has(r)))]
}

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
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

  // --- authorise: caller must be a System Admin --------------------------
  const { data: userData, error: userErr } = await asCaller.auth.getUser()
  if (userErr || !userData.user) return json({ error: 'a signed-in staff caller is required' }, 401)
  const callerId = userData.user.id

  const { data: callerProfile, error: profileErr } = await admin
    .from('users')
    .select('roles')
    .eq('auth_user_id', callerId)
    .maybeSingle()
  if (profileErr) return json({ error: profileErr.message }, 500)
  const callerRoles = String(callerProfile?.roles ?? '')
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (!callerRoles.includes('system_admin')) {
    return json({ error: 'only a System Admin may manage staff accounts' }, 403)
  }

  let payload: Record<string, unknown>
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'invalid JSON body' }, 400)
  }
  const action = payload.action

  async function audit(name: string, entityRef: string, after: Record<string, unknown>) {
    await admin.from('audit_log').insert({
      actor_id: callerId,
      action: name,
      entity_type: 'users',
      entity_ref: entityRef.slice(0, 32),
      before: 'null',
      after: JSON.stringify(after),
      created_at: new Date().toISOString(),
    })
  }

  // ----------------------------------------------------------------- create
  if (action === 'create') {
    const email = str(payload.email).toLowerCase()
    const password = str(payload.password)
    const fullName = str(payload.fullName)
    const roles = cleanRoles(payload.roles)
    if (!email || !password || !fullName) {
      return json({ error: 'email, password and fullName are required' }, 400)
    }
    if (password.length < 8) return json({ error: 'password must be at least 8 characters' }, 400)
    if (roles.length === 0) return json({ error: 'at least one valid role is required' }, 400)

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name: fullName },
    })
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? 'could not create the auth account' }, 500)
    }

    const { data: inserted, error: insErr } = await admin
      .from('users')
      .insert({
        auth_user_id: created.user.id,
        full_name: fullName,
        roles: roles.join(' '),
        branch_id: str(payload.branchId) || null,
        sub_warehouse_id: str(payload.subWarehouseId) || null,
        job_grade: str(payload.jobGrade) || null,
        is_active: true,
      })
      .select('id')
      .single()
    if (insErr || !inserted) {
      await admin.auth.admin.deleteUser(created.user.id).catch(() => {})
      return json({ error: insErr?.message ?? 'could not create the profile' }, 500)
    }

    await audit('create_staff_account', email, { userId: inserted.id, roles, email })
    return json({ userId: inserted.id, authUserId: created.user.id })
  }

  // --------------------------------------------------------- update / reset
  const userId = str(payload.userId)
  if (!userId) return json({ error: 'userId is required' }, 400)

  const { data: target, error: targetErr } = await admin
    .from('users')
    .select('id, auth_user_id, full_name')
    .eq('id', userId)
    .maybeSingle()
  if (targetErr) return json({ error: targetErr.message }, 500)
  if (!target) return json({ error: `user ${userId} does not exist` }, 404)
  const authUserId = String(target.auth_user_id)

  if (action === 'reset-password') {
    const password = str(payload.password)
    if (password.length < 8) return json({ error: 'password must be at least 8 characters' }, 400)
    const { error } = await admin.auth.admin.updateUserById(authUserId, {
      password,
      ban_duration: 'none',
    })
    if (error) return json({ error: error.message }, 500)
    await audit('reset_staff_password', target.full_name ?? userId, { userId })
    return json({ ok: true })
  }

  if (action === 'update') {
    const fullName = str(payload.fullName)
    const email = str(payload.email).toLowerCase()
    const roles = cleanRoles(payload.roles)
    if (!fullName) return json({ error: 'fullName is required' }, 400)
    if (roles.length === 0) return json({ error: 'at least one valid role is required' }, 400)
    const isActive = payload.isActive !== false

    // Friendly early error for the obvious case. The authoritative, atomic
    // guarantee is the `enforce_active_system_admin` trigger (migration 0022) —
    // it also covers two admins editing each other concurrently.
    if (authUserId === callerId && (!isActive || !roles.includes('system_admin'))) {
      return json(
        { error: 'you cannot deactivate your own account or remove your own System Admin role' },
        400,
      )
    }

    const { error: updErr } = await admin
      .from('users')
      .update({
        full_name: fullName,
        roles: roles.join(' '),
        branch_id: str(payload.branchId) || null,
        sub_warehouse_id: str(payload.subWarehouseId) || null,
        job_grade: str(payload.jobGrade) || null,
        is_active: isActive,
      })
      .eq('id', userId)
    if (updErr) {
      // The `enforce_active_system_admin` trigger (migrations 0022/0023).
      if (updErr.code === '23514' || /System Admin must remain/i.test(updErr.message)) {
        return json({ error: 'at least one active System Admin must remain' }, 409)
      }
      return json({ error: updErr.message }, 500)
    }

    if (email) {
      const { error: emailErr } = await admin.auth.admin.updateUserById(authUserId, { email })
      if (emailErr)
        return json({ error: `profile saved, but email change failed: ${emailErr.message}` }, 500)
    }
    // deactivation also blocks login; reactivation lifts the ban
    const { error: banErr } = await admin.auth.admin.updateUserById(authUserId, {
      ban_duration: isActive ? 'none' : BAN_FOREVER,
    })
    if (banErr)
      return json(
        { error: `profile saved, but sign-in state change failed: ${banErr.message}` },
        500,
      )
    if (!isActive) await admin.auth.admin.signOut(authUserId, 'global').catch(() => {})

    await audit('update_staff_account', fullName, { userId, roles, isActive })
    return json({ ok: true })
  }

  return json({ error: 'action must be create, update or reset-password' }, 400)
})
