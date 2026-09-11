-- Server-side guard for the leads pipeline's stage machine (mirrors
-- src/modules/crm/domain/lead.ts's `LEAD_STAGE_TRANSITIONS` — keep in
-- lockstep). Without this, RLS alone lets the creator/assignee move a lead to
-- ANY stage via a direct PATCH, bypassing the client's filtered dropdown —
-- the same "server is authoritative, UI is only an affordance" rule every
-- other workflow in this schema follows (claude.md A.6). System Admin is
-- exempt, same god-mode carve-out as `_submit_gates` (migration 0014).

set check_function_bodies = off;

create or replace function public.leads_set_branch() returns trigger
  language plpgsql
  set search_path = public
as $$
begin
  if TG_OP = 'INSERT' then
    new.branch_id := public.user_branch_id();
    return new;
  end if;

  new.branch_id := old.branch_id;
  new.created_by := old.created_by;

  if new.stage is distinct from old.stage and not public.has_role('system_admin') then
    if not (
      (old.stage = 'new' and new.stage in ('contacted', 'lost'))
      or (old.stage = 'contacted' and new.stage in ('qualified', 'lost'))
      or (old.stage = 'qualified' and new.stage in ('won', 'lost'))
    ) then
      raise exception 'invalid lead stage transition: % -> %', old.stage, new.stage
        using errcode = '55000';
    end if;
  end if;

  return new;
end;
$$;
