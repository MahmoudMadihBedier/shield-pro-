-- Story 2.5 — customer credit-limit hard block on sales-invoice submission.
--
-- A sale on account is blocked when  outstanding + this invoice > credit_limit
-- (exactly at the limit is allowed; credit_limit = 0 means "cash only").
-- The block is lifted only by a logged, segregation-of-duties-checked admin
-- override (record_credit_override) — the sale's own creator can never lift it.
--
-- Mirrors src/modules/accounting/domain/{aging,credit}.ts — keep in lockstep.
--   receivable payment methods: credit | partial | post_dated_cheque
--   outstanding = Σ submitted credit-side net_total − Σ submitted receipts

set check_function_bodies = off;

-- ----- check_customer_credit (read-only, for the form + the gate) -----
create or replace function public.check_customer_credit(
  p_customer_id text, p_new_amount numeric default 0
) returns jsonb
  language plpgsql stable security definer set search_path = public as $$
declare
  v_limit numeric;
  v_invoiced numeric;
  v_received numeric;
  v_outstanding numeric;
  v_projected numeric;
begin
  perform public._require_staff();
  if coalesce(btrim(p_customer_id), '') = '' then
    raise exception 'customer is required' using errcode = '22023';
  end if;

  select coalesce(credit_limit, 0) into v_limit from public.customers where id = p_customer_id;
  if v_limit is null then
    raise exception 'customer % does not exist', p_customer_id using errcode = 'P0002';
  end if;

  select coalesce(sum(net_total), 0) into v_invoiced
    from public.sales_invoices
    where customer_id = p_customer_id and doc_status = 1
      and payment_method in ('credit', 'partial', 'post_dated_cheque');

  select coalesce(sum(amount), 0) into v_received
    from public.receipts
    where customer_id = p_customer_id and doc_status = 1;

  v_outstanding := v_invoiced - v_received;
  v_projected := v_outstanding + coalesce(p_new_amount, 0);

  return jsonb_build_object(
    'ok', v_projected <= v_limit,
    'creditLimit', v_limit,
    'outstanding', v_outstanding,
    'available', v_limit - v_outstanding,
    'overBy', case when v_projected > v_limit then v_projected - v_limit else 0 end
  );
end;
$$;

-- ----- record_credit_override -------------------------------------
-- An admin (system_admin | chief_accountant) records a one-off override for a
-- specific over-limit invoice. SoD: not the invoice's own creator. Logged in
-- audit_log; submit_document reads that marker.
create or replace function public.record_credit_override(p_invoice_ref text, p_reason text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r public.sales_invoices%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_staff();
  if not (public.has_role('system_admin') or public.has_role('chief_accountant')) then
    raise exception 'only a System Admin or Chief Accountant may override a credit block'
      using errcode = '42501';
  end if;
  if v_reason is null then
    raise exception 'an override reason is required' using errcode = '22023';
  end if;

  select * into r from public.sales_invoices where reference_id = p_invoice_ref;
  if not found then
    raise exception 'sales invoice % does not exist', p_invoice_ref using errcode = 'P0002';
  end if;
  if r.created_by = auth.uid()::text then
    raise exception 'segregation of duties violated: the sale''s creator may not override its credit block'
      using errcode = '42501';
  end if;
  if r.doc_status <> 0 then
    raise exception 'a credit override only applies to a draft invoice' using errcode = '55000';
  end if;

  perform public._audit('credit_override', 'sales_invoices', p_invoice_ref, null,
    jsonb_build_object('reason', v_reason, 'overriddenBy', auth.uid()::text));

  return jsonb_build_object('ok', true, 'invoiceRef', p_invoice_ref);
end;
$$;

-- ----- _credit_cleared -----------------------------------------
create or replace function public._credit_cleared(p_invoice jsonb) returns boolean
  language plpgsql stable security definer set search_path = public as $$
declare
  v_credit jsonb;
begin
  -- only credit-side invoices can breach a limit
  if (p_invoice->>'payment_method') not in ('credit', 'partial', 'post_dated_cheque') then
    return true;
  end if;
  v_credit := public.check_customer_credit(
    p_invoice->>'customer_id', coalesce((p_invoice->>'net_total')::numeric, 0));
  if (v_credit->>'ok')::boolean then
    return true;
  end if;
  -- blocked unless a logged override exists for this invoice
  return exists (
    select 1 from public.audit_log
    where action = 'credit_override' and entity_ref = (p_invoice->>'reference_id')
  );
end;
$$;

-- ----- submit_document (v3 — credit gate for sales_invoices) ------------
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

  if not public._approval_cleared(p_table, r->>'reference_id') then
    if exists (select 1 from public.approval_requests
               where entity_ref = r->>'reference_id' and state = 'rejected') then
      raise exception 'this submission was rejected in approval review' using errcode = '42501';
    end if;
    raise exception 'this document is awaiting approval review and cannot be submitted yet'
      using errcode = '55000';
  end if;

  if p_table = 'sales_invoices' and not public._credit_cleared(r) then
    raise exception 'customer credit limit exceeded — a System Admin or Chief Accountant override is required'
      using errcode = '42501';
  end if;

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

grant execute on function public.check_customer_credit(text, numeric) to authenticated;
grant execute on function public.record_credit_override(text, text) to authenticated;
grant execute on function public._credit_cleared(jsonb) to authenticated;
grant execute on function public.submit_document(text, text) to authenticated;
