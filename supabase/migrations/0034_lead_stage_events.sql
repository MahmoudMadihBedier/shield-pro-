-- CRM leads — stage-change history, for the lead detail page's timeline
-- (Phase A of docs/CRM_PLAN.md). An append-only log written by the SAME
-- trigger that already guards + pins the stage transition (migration 0033),
-- not by the client — matches this schema's "ledgers/logs are server-written,
-- no direct client INSERT" rule (see stock_ledger_entries, audit_log).

set check_function_bodies = off;

create table if not exists public."lead_stage_events" (
  "id" text primary key default gen_random_uuid()::text,
  "lead_id" text not null,
  "from_stage" text,
  "to_stage" text not null,
  "reason" text,
  "changed_by" text not null,
  "changed_at" timestamptz not null default now(),
  "branch_id" text
);

create index if not exists "lead_stage_events_lead_idx" on public."lead_stage_events" ("lead_id");
create index if not exists "lead_stage_events_branch_idx" on public."lead_stage_events" ("branch_id");

alter table public."lead_stage_events" enable row level security;

-- Read-only to clients (branch-scoped, same rule as the lead itself); no
-- INSERT/UPDATE/DELETE policy at all — only the SECURITY DEFINER trigger
-- function below (running as table owner) can write.
drop policy if exists "lead_stage_events_read" on public."lead_stage_events";
create policy "lead_stage_events_read" on public."lead_stage_events" for select to authenticated
  using (public._can_read_branch(branch_id));

drop policy if exists "lead_stage_events_admin_override" on public."lead_stage_events";
create policy "lead_stage_events_admin_override" on public."lead_stage_events" for all to authenticated
  using (public.has_role('system_admin'))
  with check (public.has_role('system_admin'));

-- Re-point `leads_set_branch` to SECURITY DEFINER (needed to write the log
-- regardless of the caller's own INSERT rights on `lead_stage_events`) and
-- append one event per creation / validated stage change.
create or replace function public.leads_set_branch() returns trigger
  language plpgsql
  security definer
  set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.branch_id := public.user_branch_id();
    insert into public.lead_stage_events (lead_id, from_stage, to_stage, changed_by, branch_id)
      values (new.id, null, new.stage, new.created_by, new.branch_id);
    return new;
  end if;

  new.branch_id := old.branch_id;
  new.created_by := old.created_by;

  if new.stage is distinct from old.stage then
    if not public.has_role('system_admin') then
      if not (
        (old.stage = 'new' and new.stage in ('contacted', 'lost'))
        or (old.stage = 'contacted' and new.stage in ('qualified', 'lost'))
        or (old.stage = 'qualified' and new.stage in ('won', 'lost'))
      ) then
        raise exception 'invalid lead stage transition: % -> %', old.stage, new.stage
          using errcode = '55000';
      end if;
    end if;
    insert into public.lead_stage_events (lead_id, from_stage, to_stage, reason, changed_by, branch_id)
      values (new.id, old.stage, new.stage, new.lost_reason, auth.uid()::text, new.branch_id);
  end if;

  return new;
end;
$$;
