-- CRM — customer follow-up tasks/reminders. A staff-facing, branch-scoped
-- to-do tied to a customer: "call back on <date>", assigned to a staff member,
-- open until marked done or cancelled. Not a submittable document.
--
-- `branch_id` is forced from the linked customer by a BEFORE trigger (never
-- trusted from the client) — same pattern and same reasoning as
-- `crm_activities` (migration 0029): a client-supplied branch_id could be sent
-- as null, and `_can_read_branch(null)` is true for everyone.

set check_function_bodies = off;

create table if not exists public."crm_followups" (
  "id" text primary key default gen_random_uuid()::text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "customer_id" text not null,
  "title" text not null,
  "notes" text,
  "due_date" date not null,
  -- auth_user_id of the staff member this follow-up is assigned to.
  "assigned_to" text not null,
  "status" text not null default 'open' check ("status" in ('open', 'done', 'cancelled')),
  "created_by" text not null,
  "branch_id" text,
  "done_at" timestamptz,
  "done_by" text
);

create index if not exists "crm_followups_customer_idx" on public."crm_followups" ("customer_id");
create index if not exists "crm_followups_branch_idx" on public."crm_followups" ("branch_id");
create index if not exists "crm_followups_assigned_idx" on public."crm_followups" ("assigned_to");
create index if not exists "crm_followups_due_idx" on public."crm_followups" ("due_date");

drop trigger if exists "crm_followups_set_updated_at" on public."crm_followups";
create trigger "crm_followups_set_updated_at" before update on public."crm_followups"
  for each row execute function public.set_updated_at();

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
  return new;
end;
$$;

drop trigger if exists "crm_followups_branch" on public."crm_followups";
create trigger "crm_followups_branch" before insert or update on public."crm_followups"
  for each row execute function public.crm_followups_set_branch();

alter table public."crm_followups" enable row level security;

drop policy if exists "crm_followups_read" on public."crm_followups";
create policy "crm_followups_read" on public."crm_followups" for select to authenticated
  using (public._can_read_branch(branch_id));

drop policy if exists "crm_followups_insert" on public."crm_followups";
create policy "crm_followups_insert" on public."crm_followups" for insert to authenticated
  with check (created_by = auth.uid()::text and public._can_read_branch(branch_id));

-- The creator or the assignee may update (e.g. mark done); both are common
-- workflow actors and neither should need an admin override for that.
drop policy if exists "crm_followups_update" on public."crm_followups";
create policy "crm_followups_update" on public."crm_followups" for update to authenticated
  using (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
  with check (
    (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
    and public._can_read_branch(branch_id)
  );

drop policy if exists "crm_followups_delete_own" on public."crm_followups";
create policy "crm_followups_delete_own" on public."crm_followups" for delete to authenticated
  using (created_by = auth.uid()::text);

drop policy if exists "crm_followups_admin_override" on public."crm_followups";
create policy "crm_followups_admin_override" on public."crm_followups" for all to authenticated
  using (public.has_role('system_admin'))
  with check (public.has_role('system_admin'));
