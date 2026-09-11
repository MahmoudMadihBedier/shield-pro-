-- Code-review fixes on the CRM leads/follow-ups slices (0030, 0031), now that
-- both are live:
--
-- 1. Ownership hijack: `leads_update` / `crm_followups_update` let the
--    ASSIGNEE (not just the creator) update any column, including
--    `created_by` — an assignee could rewrite `created_by` to themselves and
--    then pass the creator-only DELETE policy on a row they never created.
--    Fixed by pinning `created_by` immutable on UPDATE (same trigger that
--    already pins `branch_id`), the same way ledgers pin `created_by` at
--    the row level elsewhere in this schema.
-- 2. Branch bypass: `leads_update`'s USING/WITH CHECK never checked
--    `_can_read_branch(branch_id)` — a staff member outside a lead's branch
--    could still UPDATE it via `assigned_to = auth.uid()` (a direct
--    PostgREST PATCH, not just the UI, which never surfaces such a lead in
--    the first place). `crm_followups_update` had the check only in
--    WITH CHECK, not USING — added there too for the same defense-in-depth
--    reason (not separately exploitable there, since `crm_followups_set_branch`
--    re-derives branch_id from customer_id on every UPDATE, but explicit is
--    safer than relying on that being true forever).

set check_function_bodies = off;

-- ----- leads: pin created_by, add branch check to update -------------------
create or replace function public.leads_set_branch() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.branch_id := public.user_branch_id();
  else
    new.branch_id := old.branch_id;
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop policy if exists "leads_update" on public."leads";
create policy "leads_update" on public."leads" for update to authenticated
  using (
    (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
    and public._can_read_branch(branch_id)
  )
  with check (
    (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
    and public._can_read_branch(branch_id)
  );

-- ----- crm_followups: pin created_by, add branch check to USING ------------
create or replace function public.crm_followups_set_branch() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  select c.branch_id into new.branch_id
  from public.customers c
  where c.id = new.customer_id;
  if not found then
    raise exception 'customer % does not exist', new.customer_id using errcode = '23503';
  end if;
  if TG_OP = 'UPDATE' then
    new.created_by := old.created_by;
  end if;
  return new;
end;
$$;

drop policy if exists "crm_followups_update" on public."crm_followups";
create policy "crm_followups_update" on public."crm_followups" for update to authenticated
  using (
    (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
    and public._can_read_branch(branch_id)
  )
  with check (
    (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
    and public._can_read_branch(branch_id)
  );
