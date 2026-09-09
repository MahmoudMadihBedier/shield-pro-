-- CRM — customer activity log. A staff-facing, branch-scoped, append-mostly
-- record of interactions with an existing customer (call / visit / WhatsApp /
-- complaint / …). Not a submittable document: no doc_status, no ledger, no
-- approval — just a timeline on the customer detail page.
--
-- `branch_id` is copied from the customer at write time so the row is
-- branch-scoped the same way every other customer-linked table is. A rep files
-- only against a customer they can already see (`_can_read_branch`), and edits
-- only their own entries; the System Admin can edit/delete anything.
--
-- Incremental migration (schema.ts is not the source of truth for tables added
-- after 0015 — see 0017).

set check_function_bodies = off;

create table if not exists public."crm_activities" (
  "id" text primary key default gen_random_uuid()::text,
  "created_at" timestamptz not null default now(),
  "updated_at" timestamptz not null default now(),
  "customer_id" text not null,
  "kind" text not null check (
    "kind" in ('call', 'visit', 'whatsapp', 'email', 'meeting', 'complaint', 'note')
  ),
  "subject" text not null,
  "note" text,
  "occurred_at" timestamptz not null default now(),
  "outcome" text check ("outcome" in ('positive', 'neutral', 'negative', 'follow_up')),
  "created_by" text not null,
  "branch_id" text
);

create index if not exists "crm_activities_customer_idx" on public."crm_activities" ("customer_id");
create index if not exists "crm_activities_branch_idx" on public."crm_activities" ("branch_id");
create index if not exists "crm_activities_occurred_idx" on public."crm_activities" ("occurred_at");

drop trigger if exists "crm_activities_set_updated_at" on public."crm_activities";
create trigger "crm_activities_set_updated_at" before update on public."crm_activities"
  for each row execute function public.set_updated_at();

alter table public."crm_activities" enable row level security;

drop policy if exists "crm_activities_read" on public."crm_activities";
create policy "crm_activities_read" on public."crm_activities" for select to authenticated
  using (public._can_read_branch(branch_id));

drop policy if exists "crm_activities_insert" on public."crm_activities";
create policy "crm_activities_insert" on public."crm_activities" for insert to authenticated
  with check (created_by = auth.uid()::text and public._can_read_branch(branch_id));

drop policy if exists "crm_activities_update_own" on public."crm_activities";
create policy "crm_activities_update_own" on public."crm_activities" for update to authenticated
  using (created_by = auth.uid()::text)
  with check (created_by = auth.uid()::text and public._can_read_branch(branch_id));

drop policy if exists "crm_activities_delete_own" on public."crm_activities";
create policy "crm_activities_delete_own" on public."crm_activities" for delete to authenticated
  using (created_by = auth.uid()::text);

drop policy if exists "crm_activities_admin_override" on public."crm_activities";
create policy "crm_activities_admin_override" on public."crm_activities" for all to authenticated
  using (public.has_role('system_admin'))
  with check (public.has_role('system_admin'));
