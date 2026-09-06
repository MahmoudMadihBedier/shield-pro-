-- System Admin = full operational authority (nظام_ادارة_…docx §2 defines the
-- role as "owner / god-mode"). The admin can now do anything an employee does:
--   * exempt from segregation-of-duties checks (self-approve, self-QC-sign,
--     self-credit-override),
--   * exempt from the submit gates (approval / credit / QC),
--   * UPDATE any document row regardless of creator or doc_status (via a new
--     per-table admin-override RLS policy),
--   * force a status change on any status-bearing document through
--     admin_set_status(), with a mandatory reason, fully audited.
--
-- Immutable ledgers, audit_log and the control tables stay admin-read-only —
-- their integrity is the backbone and is maintained only by SECURITY DEFINER
-- functions. Every admin action here still appends to audit_log.

set check_function_bodies = off;

-- ----- SoD bypass for the admin ---------------------------------------
create or replace function public._assert_no_self_approval(r jsonb) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if public.has_role('system_admin') then
    return; -- the owner role is the ultimate authority; SoD does not apply
  end if;
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

-- submit gates: the admin bypasses approval / credit / QC entirely.
create or replace function public._submit_gates(p_table text, r jsonb) returns void
  language plpgsql stable security definer set search_path = public as $$
begin
  if public.has_role('system_admin') then
    return;
  end if;

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

-- decide_approval: the admin may resolve its own request.
create or replace function public.decide_approval(
  p_request_id text, p_decision text, p_reason text
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r public.approval_requests%rowtype;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_staff();
  if p_decision <> 'approved' and p_decision <> 'rejected' then
    raise exception 'decision must be "approved" or "rejected"' using errcode = '22023';
  end if;

  select * into r from public.approval_requests where id = p_request_id;
  if not found then
    raise exception 'approval_requests/% does not exist', p_request_id using errcode = 'P0002';
  end if;
  if r.state <> 'pending' then
    raise exception 'approval request is already "%"', r.state using errcode = '55000';
  end if;
  if not public.has_role('system_admin')
     and r.requested_by is not null and r.requested_by = auth.uid()::text then
    raise exception 'segregation of duties violated: the requester may not approve this'
      using errcode = '42501';
  end if;

  update public.approval_requests
    set state = p_decision, decided_by = auth.uid()::text, decision_reason = v_reason
    where id = p_request_id;

  perform public._audit('decide_approval', coalesce(r.entity_type, 'approval_requests'),
    coalesce(r.entity_ref, p_request_id),
    jsonb_build_object('state', 'pending'),
    jsonb_build_object('state', p_decision, 'decidedBy', auth.uid()::text, 'reason', v_reason));

  return jsonb_build_object(
    '$id', p_request_id, 'entityType', coalesce(r.entity_type, ''),
    'entityRef', coalesce(r.entity_ref, ''), 'branchId', r.branch_id,
    'requestedBy', coalesce(r.requested_by, ''), 'state', p_decision,
    'decidedBy', auth.uid()::text, 'decisionReason', v_reason);
end;
$$;

-- record_credit_override: the admin may override its own invoice.
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
  if not public.has_role('system_admin') and r.created_by = auth.uid()::text then
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

-- ----- admin_set_status: force a status on any workflow document ------
create or replace function public.admin_set_status(
  p_table text, p_row_id text, p_patch jsonb, p_reason text
) returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  allowed text[] := array['doc_status', 'status', 'qc_status', 'approval_state',
                          'confirmed_by', 'qc_by', 'approved_by', 'decided_by', 'requested_by'];
  extra_tables text[] := array['customers', 'rep_stock_issues', 'production_requests',
                               'warehouse_transfers', 'return_requests',
                               'stock_count_sessions', 'rep_closeouts', 'attendance_records'];
  k text;
  sets text[] := array[]::text[];
  r_before jsonb;
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may force a status change' using errcode = '42501';
  end if;
  if not public._is_submittable(p_table) and not (p_table = any(extra_tables)) then
    raise exception '"%" is not a status-bearing table', p_table using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'a reason is required for an admin status override' using errcode = '22023';
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table)
    into r_before using p_row_id;
  if r_before is null then
    raise exception '%/% does not exist', p_table, p_row_id using errcode = 'P0002';
  end if;

  for k in select jsonb_object_keys(p_patch) loop
    if not (k = any(allowed)) then
      raise exception 'field "%" cannot be set via admin_set_status', k using errcode = '42501';
    end if;
    sets := sets || format('%I = %L', k, p_patch->>k);
  end loop;
  if array_length(sets, 1) is null then
    raise exception 'no recognised fields to set' using errcode = '22023';
  end if;

  execute format('update public.%I set %s where id = %L',
                 p_table, array_to_string(sets, ', '), p_row_id);

  perform public._audit('admin_set_status', p_table,
    coalesce(r_before->>'reference_id', p_row_id),
    r_before,
    jsonb_build_object('patch', p_patch, 'reason', v_reason, 'by', auth.uid()::text));

  return jsonb_build_object('table', p_table, 'rowId', p_row_id, 'patch', p_patch);
end;
$$;

grant execute on function public.admin_set_status(text, text, jsonb, text) to authenticated;

-- ----- admin-override RLS write on every workflow document -----------
do $$
declare
  t text;
begin
  -- customers already has customers_admin_write (FOR ALL, system_admin).
  foreach t in array array[
    'purchase_orders','stock_receipts','production_requests','production_batches',
    'warehouse_transfers','rep_stock_issues','sales_invoices','receipts',
    'payment_vouchers','return_requests','write_offs','stock_count_sessions',
    'rep_closeouts','payroll_runs','attendance_records'
  ]
  loop
    execute format('drop policy if exists %I on public.%I', t || '_admin_override', t);
    execute format(
      'create policy %I on public.%I for all to authenticated '
      || 'using (public.has_role(''system_admin'')) with check (public.has_role(''system_admin''))',
      t || '_admin_override', t);
  end loop;
end;
$$;
