-- Fix: _assert_no_self_approval (migration 0002) carried a dead
--   `foreach a slice 1 in array pairs loop ... end loop`
-- with `a` declared as scalar `text` — which raises 42804 "FOREACH ... SLICE
-- loop variable must be of an array type" at runtime. It was latent until
-- submit_document first reached it with a real row. Drop the dead loop and its
-- unused locals; the four explicit SoD checks below it are unchanged.

set check_function_bodies = off;

create or replace function public._assert_no_self_approval(r jsonb) returns void
  language plpgsql immutable as $$
begin
  if (r->>'requested_by') is not null and (r->>'requested_by') <> ''
     and (r->>'requested_by') = (r->>'approved_by') then
    raise exception 'segregation of duties violated: requester may not approve' using errcode = '42501';
  end if;
  if (r->>'sent_by') is not null and (r->>'sent_by') <> ''
     and (r->>'sent_by') = (r->>'confirmed_received_by') then
    raise exception 'segregation of duties violated: sender may not confirm receipt' using errcode = '42501';
  end if;
  if (r->>'sold_by') is not null and (r->>'sold_by') <> ''
     and (r->>'sold_by') = (r->>'cashup_confirmed_by') then
    raise exception 'segregation of duties violated: seller may not confirm cash-up' using errcode = '42501';
  end if;
  if (r ? 'approved_by')
     and (r->>'created_by') is not null and (r->>'created_by') <> ''
     and (r->>'created_by') = (r->>'approved_by') then
    raise exception 'segregation of duties violated: entry author may not approve' using errcode = '42501';
  end if;
end;
$$;
