-- Shield Pro — core server-side logic as SECURITY DEFINER RPC functions.
-- Replaces the Appwrite `shield-server` routes: allocate-reference-id,
-- submit-document, cancel-document. Postgres gives us atomic increments and
-- real transactions natively, so these are simpler + safer than the Edge/
-- Function equivalents. Callable from the client via `supabase.rpc(...)`.

set check_function_bodies = off;

-- ----- seed the naming-series counters (one per prefix, current year) -------
insert into public.naming_series_counters (id, prefix, year, next_value)
select p, p, extract(year from now())::int, 1
from unnest(array[
  'PO','SR','PR','BATCH','TRF','ISS','INV','REC','PV','RET','WO','ADJ',
  'SLE','GLE','CNT','CLZ','PAY'
]) as p
on conflict (prefix, year) do nothing;

-- ----- helpers -------------------------------------------------------------

-- The submittable document tables (mirror src/core/document.ts).
create or replace function public._is_submittable(p_table text) returns boolean
  language sql immutable as $$
  select p_table = any(array[
    'purchase_orders','stock_receipts','production_requests','production_batches',
    'warehouse_transfers','rep_stock_issues','sales_invoices','receipts',
    'payment_vouchers','return_requests','write_offs','stock_count_sessions',
    'rep_closeouts','payroll_runs'
  ])
$$;

-- Which roles may submit/cancel a given table (mirror src/core/access.ts).
create or replace function public._submit_roles(p_table text) returns text[]
  language sql immutable as $$
  select case p_table
    when 'purchase_orders'      then array['purchasing_accountant','system_admin']
    when 'stock_receipts'       then array['raw_store_keeper','system_admin']
    when 'production_requests'  then array['factory_manager','factory_accountant','system_admin']
    when 'production_batches'   then array['factory_manager','factory_accountant','system_admin']
    when 'warehouse_transfers'  then array['main_warehouse_manager','sub_warehouse_manager','system_admin']
    when 'rep_stock_issues'     then array['sub_warehouse_manager','system_admin']
    when 'sales_invoices'       then array['sales_rep','branch_accountant','system_admin']
    when 'receipts'             then array['sales_rep','branch_accountant','system_admin']
    when 'payment_vouchers'     then array['branch_accountant','chief_accountant','system_admin']
    when 'return_requests'      then array['branch_accountant','system_admin']
    when 'write_offs'           then array['main_warehouse_manager','sub_warehouse_manager','system_admin']
    when 'stock_count_sessions' then array['main_warehouse_manager','sub_warehouse_manager','system_admin']
    when 'rep_closeouts'        then array['branch_accountant','system_admin']
    when 'payroll_runs'         then array['chief_accountant','system_admin']
    else array['system_admin']
  end
$$;

create or replace function public._can_submit(p_table text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role('system_admin')
      or exists (select 1 from unnest(public._submit_roles(p_table)) r
                 where r = any(public.user_roles()))
$$;

-- Global-scope roles (mirror src/core/rbac.ts GLOBAL_SCOPE_ROLES).
create or replace function public._has_global_scope() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role('system_admin')
      or public.has_role('chief_accountant')
      or public.has_role('main_warehouse_manager')
$$;

create or replace function public._can_act_on_branch(p_branch text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public._has_global_scope()
      or p_branch is null or p_branch = ''
      or p_branch = public.user_branch_id()
$$;

-- Segregation of duties: the 4 actor-pair rules from src/core/segregation.ts.
-- Raises when both sides of a rule are present and equal.
create or replace function public._assert_no_self_approval(r jsonb) returns void
  language plpgsql immutable as $$
declare
  pairs text[][] := array[
    array['requested_by','approved_by'],
    array['sent_by','confirmed_received_by'],
    array['sold_by','cashup_confirmed_by'],
    array['created_by','approved_by']
  ];
  a text; b text; av text; bv text;
begin
  foreach a slice 1 in array pairs loop
    -- (unused: plpgsql can't slice easily; do it explicitly below)
    null;
  end loop;
  -- explicit checks
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
  if (r->>'created_by') is not null and (r->>'created_by') <> ''
     and (r->>'created_by') = (r->>'approved_by')
     and (r ? 'approved_by') then
    raise exception 'segregation of duties violated: entry author may not approve' using errcode = '42501';
  end if;
end;
$$;

create or replace function public._audit(
  p_action text, p_entity_type text, p_entity_ref text, p_before jsonb, p_after jsonb
) returns void
  language sql security definer set search_path = public as $$
  insert into public.audit_log (id, actor_id, action, entity_type, entity_ref, before, after, created_at)
  values (gen_random_uuid()::text,
          coalesce(auth.uid()::text, 'system'),
          left(p_action, 48), left(p_entity_type, 32), left(p_entity_ref, 32),
          coalesce(p_before::text, 'null'), coalesce(p_after::text, 'null'), now())
$$;

-- ----- allocate_reference_id --------------------------------------------------
-- Atomic, gap-free. p_entity is a REFERENCE_PREFIXES key (e.g. 'SalesInvoice').
create or replace function public.allocate_reference_id(p_entity text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  prefix text := case p_entity
    when 'PurchaseOrder' then 'PO' when 'StockReceipt' then 'SR'
    when 'ProductionRequest' then 'PR' when 'ProductionBatch' then 'BATCH'
    when 'WarehouseTransfer' then 'TRF' when 'RepStockIssue' then 'ISS'
    when 'SalesInvoice' then 'INV' when 'Receipt' then 'REC'
    when 'PaymentVoucher' then 'PV' when 'ReturnRequest' then 'RET'
    when 'WriteOff' then 'WO' when 'AdjustmentEntry' then 'ADJ'
    when 'StockLedgerEntry' then 'SLE' when 'GeneralLedgerEntry' then 'GLE'
    when 'StockCountSession' then 'CNT' when 'RepCloseout' then 'CLZ'
    when 'PayrollRun' then 'PAY' else null end;
  yr int := extract(year from now())::int;
  seq int;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;
  if array_length(public.user_roles(), 1) is null then
    raise exception 'this action is restricted to staff accounts' using errcode = '42501';
  end if;
  if prefix is null then
    raise exception 'unknown reference entity "%"', p_entity using errcode = '22023';
  end if;

  insert into public.naming_series_counters (id, prefix, year, next_value)
  values (prefix || '-' || yr, prefix, yr, 2)
  on conflict (prefix, year) do update set next_value = naming_series_counters.next_value + 1
  returning next_value - 1 into seq;

  return jsonb_build_object(
    'referenceId', prefix || '-' || yr || '-' || lpad(seq::text, 5, '0'),
    'prefix', prefix, 'year', yr, 'sequence', seq
  );
end;
$$;

-- ----- submit_document ------------------------------------------------------
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

-- ----- cancel_document ----------------------------------------------------
create or replace function public.cancel_document(p_table text, p_row_id text, p_reason text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  ref text;
  new_remarks text;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required to cancel' using errcode = '42501';
  end if;
  if not public._is_submittable(p_table) then
    raise exception '"%" is not a submittable document table', p_table using errcode = '22023';
  end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'a cancellation reason is required' using errcode = '22023';
  end if;

  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table)
    into r using p_row_id;
  if r is null then
    raise exception '%/% does not exist', p_table, p_row_id using errcode = 'P0002';
  end if;

  if (r->>'doc_status')::int <> 1 then
    raise exception '%', case (r->>'doc_status')::int
      when 0 then 'a draft cannot be cancelled — delete it instead'
      else 'document is already cancelled' end using errcode = '55000';
  end if;
  if not public._can_submit(p_table) then
    raise exception 'your role may not cancel this document type' using errcode = '42501';
  end if;
  if not public._can_act_on_branch(r->>'branch_id') then
    raise exception 'this document belongs to another branch' using errcode = '42501';
  end if;
  perform public._assert_no_self_approval(r);

  new_remarks := left(
    concat_ws(E'\n', 'Cancelled by ' || coalesce(auth.uid()::text,'system') || ': ' || btrim(p_reason),
                     nullif(r->>'remarks','')),
    2000);

  execute format('update public.%I set doc_status = 2, remarks = $1 where id = $2', p_table)
    using new_remarks, p_row_id;

  ref := r->>'reference_id';
  perform public._audit('cancel', p_table, ref,
    jsonb_build_object('doc_status', 1),
    jsonb_build_object('doc_status', 2, 'reason', btrim(p_reason), 'actorRoles', public.user_roles()));

  return jsonb_build_object('table', p_table, 'rowId', p_row_id, 'referenceId', ref, 'docStatus', 2);
end;
$$;

-- ----- segregation_guard (read-only pre-check) -----------------------------
create or replace function public.segregation_guard(p_table text, p_row_id text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  r jsonb;
  violated text[] := array[]::text[];
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;
  if not public._is_submittable(p_table) then
    raise exception '"%" is not a submittable document table', p_table using errcode = '22023';
  end if;
  execute format('select to_jsonb(t) from public.%I t where t.id = $1', p_table)
    into r using p_row_id;
  if r is null then
    raise exception '%/% does not exist', p_table, p_row_id using errcode = 'P0002';
  end if;

  if nullif(r->>'requested_by','') is not null and (r->>'requested_by') = (r->>'approved_by')
    then violated := violated || 'requested-vs-approved'; end if;
  if nullif(r->>'sent_by','') is not null and (r->>'sent_by') = (r->>'confirmed_received_by')
    then violated := violated || 'sent-vs-received'; end if;
  if nullif(r->>'sold_by','') is not null and (r->>'sold_by') = (r->>'cashup_confirmed_by')
    then violated := violated || 'sold-vs-cashup'; end if;

  return jsonb_build_object('violated', to_jsonb(violated), 'clean', array_length(violated,1) is null);
end;
$$;

-- Expose to the client role.
grant execute on function public.allocate_reference_id(text) to authenticated;
grant execute on function public.submit_document(text, text) to authenticated;
grant execute on function public.cancel_document(text, text, text) to authenticated;
grant execute on function public.segregation_guard(text, text) to authenticated;
