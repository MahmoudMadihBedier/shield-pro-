-- Story 2.7 — QC hold/release enforced server-side (the "enforcing function"
-- src/modules/manufacturing/domain/qc.ts always deferred). A production batch
-- can only be submitted once its qc_status is 'released', signed off by
-- someone other than its creator.
--
-- Also refactors the per-table submit gates (approval 2.2, credit 2.5, qc 2.7)
-- into one _submit_gates() helper so future gates don't re-emit the whole
-- submit_document body.

set check_function_bodies = off;

create or replace function public._submit_gates(p_table text, r jsonb) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  -- approval engine (Story 2.2)
  if not public._approval_cleared(p_table, r->>'reference_id') then
    if exists (select 1 from public.approval_requests
               where entity_ref = r->>'reference_id' and state = 'rejected') then
      raise exception 'this submission was rejected in approval review' using errcode = '42501';
    end if;
    raise exception 'this document is awaiting approval review and cannot be submitted yet'
      using errcode = '55000';
  end if;

  -- customer credit limit (Story 2.5)
  if p_table = 'sales_invoices' and not public._credit_cleared(r) then
    raise exception 'customer credit limit exceeded — a System Admin or Chief Accountant override is required'
      using errcode = '42501';
  end if;

  -- QC hold/release (Story 2.7)
  if p_table = 'production_batches' then
    if coalesce(r->>'qc_status', '') <> 'released' then
      raise exception 'this batch has not passed quality control (qc_status = %)',
        coalesce(nullif(r->>'qc_status', ''), 'unset') using errcode = '42501';
    end if;
    if nullif(r->>'qc_by', '') is null then
      raise exception 'quality control must be signed off before submission' using errcode = '42501';
    end if;
    if (r->>'qc_by') = (r->>'created_by') then
      raise exception 'segregation of duties violated: the batch creator may not sign off its own QC'
        using errcode = '42501';
    end if;
  end if;
end;
$$;

create or replace function public.submit_document(p_table text, p_row_id text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  posting timestamptz := now();
  ref text;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required to submit' using errcode = '42501';
  end if;
  if not public._is_submittable(p_table) then
    raise exception '"%" is not a submittable document table', p_table using errcode = '22023';
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table)
    into r using p_row_id;
  if r is null then
    raise exception '%/% does not exist', p_table, p_row_id using errcode = 'P0002';
  end if;

  if (r->>'doc_status')::int <> 0 then
    raise exception 'document is %', case (r->>'doc_status')::int when 1 then 'already submitted' else 'cancelled' end
      using errcode = '55000';
  end if;
  if not public._can_submit(p_table) then
    raise exception 'your role may not submit this document type' using errcode = '42501';
  end if;
  if not public._can_act_on_branch(r->>'branch_id') then
    raise exception 'this document belongs to another branch' using errcode = '42501';
  end if;
  perform public._assert_no_self_approval(r);
  perform public._submit_gates(p_table, r);

  execute format(
    'update public.%I set doc_status = 1, posting_datetime = $1 where id = $2', p_table
  ) using posting, p_row_id;

  ref := r->>'reference_id';
  perform public._audit('submit', p_table, ref,
    jsonb_build_object('doc_status', 0),
    jsonb_build_object('doc_status', 1, 'posting_datetime', posting, 'actorRoles', public.user_roles()));

  return jsonb_build_object('table', p_table, 'rowId', p_row_id, 'referenceId', ref,
                            'docStatus', 1, 'postingDatetime', posting);
end;
$$;

grant execute on function public.submit_document(text, text) to authenticated;
