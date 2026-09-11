-- CRM — leads / opportunity pipeline. A prospective customer not yet in
-- `customers`, tracked through a stage pipeline (new → contacted → qualified
-- → won / lost). Conversion to a real `customers` row is a manual step done
-- from the Customers screen (mandatory fields — geo, code, credit terms — are
-- a business decision, not something to default silently); the lead can then
-- be linked back via `converted_customer_id`.
--
-- `branch_id` is forced from the CALLER's own branch (`user_branch_id()`) by a
-- BEFORE trigger — never trusted from the client. Unlike `crm_activities` /
-- `crm_followups` there is no customer row yet to derive it from.

set check_function_bodies = off;

create table if not exists public."leads" (
  "id" text primary key default gen_random_uuid()::text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "name" text not null,
  "phone" text,
  "email" text,
  "source" text check (
    "source" in ('referral', 'walk_in', 'call', 'whatsapp', 'social', 'other')
  ),
  "stage" text not null default 'new' check (
    "stage" in ('new', 'contacted', 'qualified', 'won', 'lost')
  ),
  "estimated_value" double precision check ("estimated_value" >= 0),
  "notes" text,
  -- auth_user_id of the staff member this lead is assigned to.
  "assigned_to" text not null,
  "created_by" text not null,
  "branch_id" text,
  "converted_customer_id" text,
  "lost_reason" text
);

create index if not exists "leads_stage_idx" on public."leads" ("stage");
create index if not exists "leads_branch_idx" on public."leads" ("branch_id");
create index if not exists "leads_assigned_idx" on public."leads" ("assigned_to");

drop trigger if exists "leads_set_updated_at" on public."leads";
create trigger "leads_set_updated_at" before update on public."leads"
  for each row execute function public.set_updated_at();

-- Force branch_id from the caller at creation; make it immutable afterwards
-- (an UPDATE always resets it to OLD.branch_id, whatever the client sent) —
-- otherwise the creator/assignee UPDATE policy below would let a client spoof
-- branch_id on an edit, same class of gap `crm_activities` (0029) had on INSERT.
create or replace function public.leads_set_branch() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.branch_id := public.user_branch_id();
  else
    new.branch_id := old.branch_id;
  end if;
  return new;
end;
$$;

drop trigger if exists "leads_branch" on public."leads";
create trigger "leads_branch" before insert or update on public."leads"
  for each row execute function public.leads_set_branch();

alter table public."leads" enable row level security;

drop policy if exists "leads_read" on public."leads";
create policy "leads_read" on public."leads" for select to authenticated
  using (public._can_read_branch(branch_id));

drop policy if exists "leads_insert" on public."leads";
create policy "leads_insert" on public."leads" for insert to authenticated
  with check (created_by = auth.uid()::text);

-- The creator or the assignee may update (advance stage, reassign, convert);
-- `branch_id` is immutable post-creation via the trigger above, so no branch
-- check is needed in this WITH CHECK.
drop policy if exists "leads_update" on public."leads";
create policy "leads_update" on public."leads" for update to authenticated
  using (created_by = auth.uid()::text or assigned_to = auth.uid()::text)
  with check (created_by = auth.uid()::text or assigned_to = auth.uid()::text);

drop policy if exists "leads_delete_own" on public."leads";
create policy "leads_delete_own" on public."leads" for delete to authenticated
  using (created_by = auth.uid()::text);

drop policy if exists "leads_admin_override" on public."leads";
create policy "leads_admin_override" on public."leads" for all to authenticated
  using (public.has_role('system_admin'))
  with check (public.has_role('system_admin'));
