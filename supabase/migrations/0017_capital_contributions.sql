-- Capital contributions — owner / investor capital brought into the business,
-- as cash or an existing asset (vehicle, property, equipment). A submittable
-- document; on submit the client posts a GL entry (debit asset_account, credit
-- 3000 Owner's Capital) via post_gl.
--
-- 0001 / schema.ts already define the table for a from-scratch build; this adds
-- it (+ registers it in the submit RPCs and seeds the CAP counter) on the
-- already-provisioned project.

set check_function_bodies = off;

CREATE TABLE IF NOT EXISTS public."capital_contributions" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "reference_id" text NOT NULL,
  "doc_status" bigint DEFAULT 0 NOT NULL CHECK ("doc_status" >= 0 AND "doc_status" <= 2),
  "branch_id" text,
  "created_by" text NOT NULL,
  "amended_from" text,
  "posting_datetime" timestamptz NOT NULL,
  "remarks" text,
  "contributor" text NOT NULL,
  "asset_type" text NOT NULL CHECK ("asset_type" IN ('cash', 'vehicle', 'property', 'equipment', 'other')),
  "description" text,
  "amount" double precision NOT NULL CHECK ("amount" >= 0),
  "asset_account" text NOT NULL,
  CONSTRAINT "capital_contributions_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "capital_contributions_branch_idx" ON public."capital_contributions" ("branch_id");
CREATE INDEX IF NOT EXISTS "capital_contributions_status_idx" ON public."capital_contributions" ("doc_status");
CREATE INDEX IF NOT EXISTS "capital_contributions_posting_idx" ON public."capital_contributions" ("posting_datetime");
DROP TRIGGER IF EXISTS "capital_contributions_set_updated_at" ON public."capital_contributions";
CREATE TRIGGER "capital_contributions_set_updated_at" BEFORE UPDATE ON public."capital_contributions"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."capital_contributions" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capital_contributions_read" ON public."capital_contributions";
CREATE POLICY "capital_contributions_read" ON public."capital_contributions" FOR SELECT TO authenticated
  USING (public._can_read_branch(branch_id));
DROP POLICY IF EXISTS "capital_contributions_create_draft" ON public."capital_contributions";
CREATE POLICY "capital_contributions_create_draft" ON public."capital_contributions" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
DROP POLICY IF EXISTS "capital_contributions_update_draft" ON public."capital_contributions";
CREATE POLICY "capital_contributions_update_draft" ON public."capital_contributions" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
DROP POLICY IF EXISTS "capital_contributions_admin_override" ON public."capital_contributions";
CREATE POLICY "capital_contributions_admin_override" ON public."capital_contributions" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- register with the submit RPCs
create or replace function public._is_submittable(p_table text) returns boolean
  language sql immutable as $$
  select p_table = any(array[
    'purchase_orders','stock_receipts','production_requests','production_batches',
    'warehouse_transfers','rep_stock_issues','sales_invoices','receipts',
    'payment_vouchers','return_requests','write_offs','stock_count_sessions',
    'rep_closeouts','payroll_runs','capital_contributions'
  ])
$$;

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
    when 'capital_contributions' then array['chief_accountant','system_admin']
    else array['system_admin']
  end
$$;

-- CAP reference prefix
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
    when 'PayrollRun' then 'PAY' when 'CapitalContribution' then 'CAP'
    else null end;
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

insert into public.naming_series_counters (id, prefix, year, next_value)
values ('CAP-' || extract(year from now())::int, 'CAP', extract(year from now())::int, 1)
on conflict (prefix, year) do nothing;

grant execute on function public.allocate_reference_id(text) to authenticated;
