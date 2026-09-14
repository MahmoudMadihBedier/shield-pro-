-- Three independent fixes, bundled because they were reported together:
--
-- 1. Customer access wasn't rep-scoped — any sales_rep in a branch could see
--    every customer in that branch, not just the ones assigned to them.
--    `customers.assigned_rep_user_id` (nullable) + a narrowed `customers_read`
--    policy: an unassigned customer stays branch-wide visible (safe rollout —
--    nothing breaks for existing data), an assigned one is locked to that rep
--    plus branch/chief accountant + system admin. `assign_customer_rep` is the
--    only way to set it (System Admin / Branch Accountant / Chief Accountant),
--    matching the `admin_set_status` pattern — never a direct client write.
--    0001/schema.ts regenerated to match; this applies the delta.
--
-- 2. No barcode field existed anywhere — `products.barcode`, optional, unique
--    when set (Postgres allows multiple NULLs so unbarcoded products never
--    collide).
--
-- 3. CRM activity log had no location capture — `crm_activities.geo`,
--    optional "lat,lng" (same shape/validation as `core/geo.ts`), for a
--    "visit" logged from the field.

alter table public.products add column if not exists "barcode" text;
create unique index if not exists "products_barcode_uq" on public.products ("barcode");

alter table public.customers add column if not exists "assigned_rep_user_id" text;
create index if not exists "customers_rep_idx" on public.customers ("assigned_rep_user_id");

alter table public.crm_activities add column if not exists "geo" text;

create or replace function public._is_rep_restricted() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role('sales_rep')
      and not public._has_global_scope()
      and not public.has_role('branch_accountant')
$$;

drop policy if exists "customers_read" on public.customers;
create policy "customers_read" on public.customers for select to authenticated using (
  public._can_read_branch(branch_id)
  and (
    "assigned_rep_user_id" is null
    or "assigned_rep_user_id" = auth.uid()::text
    or not public._is_rep_restricted()
  )
);

-- Assign (or clear, with a null rep) a customer's rep. Narrow, audited RPC —
-- deliberately not a blanket customer-write grant for accountants.
create or replace function public.assign_customer_rep(p_customer_id text, p_rep_user_id text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r_before jsonb;
  r_after jsonb;
begin
  perform public._require_staff();
  if not (public.has_role('system_admin') or public.has_role('branch_accountant')
          or public.has_role('chief_accountant')) then
    raise exception 'only an admin or accountant may assign a customer to a rep'
      using errcode = '42501';
  end if;

  select to_jsonb(t) into r_before from public.customers t where t.id = p_customer_id;
  if r_before is null then
    raise exception 'customer % does not exist', p_customer_id using errcode = 'P0002';
  end if;
  if not public._can_read_branch(r_before->>'branch_id') then
    raise exception 'customer % is outside your branch scope', p_customer_id
      using errcode = '42501';
  end if;

  if p_rep_user_id is not null and not exists (
    select 1 from public.users u
    where u.auth_user_id = p_rep_user_id
      and u.branch_id = r_before->>'branch_id'
      and 'sales_rep' = any(
        string_to_array(regexp_replace(coalesce(u.roles, ''), '[[:space:]]+', ',', 'g'), ',')
      )
  ) then
    raise exception 'rep % is not a sales rep in this customer''s branch', p_rep_user_id
      using errcode = '22023';
  end if;

  update public.customers set "assigned_rep_user_id" = p_rep_user_id, updated_at = now()
  where id = p_customer_id
  returning to_jsonb(customers.*) into r_after;

  perform public._audit('assign_customer_rep', 'customers', p_customer_id, r_before, r_after);
  return r_after;
end;
$$;

revoke all on function public.assign_customer_rep(text, text) from public;
grant execute on function public.assign_customer_rep(text, text) to authenticated;
