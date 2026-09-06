-- Fix: `allocate_reference_id` raised 42702 "column reference "prefix" is
-- ambiguous" — the plpgsql variables `prefix` / `yr` collided with the
-- naming_series_counters.prefix / .year columns inside the INSERT ... ON
-- CONFLICT. Rename the locals with a v_ prefix and qualify the ON CONFLICT
-- SET target.

set check_function_bodies = off;

create or replace function public.allocate_reference_id(p_entity text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_prefix text := case p_entity
    when 'PurchaseOrder' then 'PO' when 'StockReceipt' then 'SR'
    when 'ProductionRequest' then 'PR' when 'ProductionBatch' then 'BATCH'
    when 'WarehouseTransfer' then 'TRF' when 'RepStockIssue' then 'ISS'
    when 'SalesInvoice' then 'INV' when 'Receipt' then 'REC'
    when 'PaymentVoucher' then 'PV' when 'ReturnRequest' then 'RET'
    when 'WriteOff' then 'WO' when 'AdjustmentEntry' then 'ADJ'
    when 'StockLedgerEntry' then 'SLE' when 'GeneralLedgerEntry' then 'GLE'
    when 'StockCountSession' then 'CNT' when 'RepCloseout' then 'CLZ'
    when 'PayrollRun' then 'PAY' else null end;
  v_yr int := extract(year from now())::int;
  v_seq int;
begin
  if auth.uid() is null then
    raise exception 'a signed-in caller is required' using errcode = '42501';
  end if;
  if array_length(public.user_roles(), 1) is null then
    raise exception 'this action is restricted to staff accounts' using errcode = '42501';
  end if;
  if v_prefix is null then
    raise exception 'unknown reference entity "%"', p_entity using errcode = '22023';
  end if;

  insert into public.naming_series_counters (id, prefix, year, next_value)
  values (v_prefix || '-' || v_yr, v_prefix, v_yr, 2)
  on conflict (prefix, year)
    do update set next_value = naming_series_counters.next_value + 1
  returning naming_series_counters.next_value - 1 into v_seq;

  return jsonb_build_object(
    'referenceId', v_prefix || '-' || v_yr || '-' || lpad(v_seq::text, 5, '0'),
    'prefix', v_prefix, 'year', v_yr, 'sequence', v_seq
  );
end;
$$;

grant execute on function public.allocate_reference_id(text) to authenticated;
