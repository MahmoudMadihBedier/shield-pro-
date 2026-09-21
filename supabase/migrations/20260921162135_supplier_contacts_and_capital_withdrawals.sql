-- Two independent additions, bundled because they were requested together:
--
-- 1. Suppliers gain `tax_id` / `description` / `notes`, plus a real child
--    table `supplier_contacts` (one supplier -> many contact people), instead
--    of the single free-text `contact` string. Master data: read-all,
--    write-system_admin, same as `suppliers` itself.
--
-- 2. `capital_withdrawals` — the reverse of `capital_contributions`
--    (migration 0017): the owner/investor takes cash out. Posts
--    Dr Drawings (contra-equity) / Cr source_account, never a direct edit to
--    Owner's Capital — standard accounting practice, and consistent with the
--    ledger being append-only (a correction is a new offsetting entry, never
--    an edit to a past one). Same submittable-document shape, same
--    chief_accountant/system_admin-only submit tier as capital_contributions.
--
-- 0001/schema.ts already define both for a from-scratch build; this applies
-- the delta on the already-provisioned project.

set check_function_bodies = off;

-- ----- 1. suppliers + supplier_contacts -------------------------------------

alter table public.suppliers add column if not exists "tax_id" text;
alter table public.suppliers add column if not exists "description" text;
alter table public.suppliers add column if not exists "notes" text;

CREATE TABLE IF NOT EXISTS public."supplier_contacts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "supplier_id" text NOT NULL,
  "contact_name" text NOT NULL,
  "role_title" text,
  "phone" text,
  "email" text,
  "is_primary" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "supplier_contacts_supplier_idx" ON public."supplier_contacts" ("supplier_id");
DROP TRIGGER IF EXISTS "supplier_contacts_set_updated_at" ON public."supplier_contacts";
CREATE TRIGGER "supplier_contacts_set_updated_at" BEFORE UPDATE ON public."supplier_contacts"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."supplier_contacts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supplier_contacts_read" ON public."supplier_contacts";
CREATE POLICY "supplier_contacts_read" ON public."supplier_contacts" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "supplier_contacts_admin_write" ON public."supplier_contacts";
CREATE POLICY "supplier_contacts_admin_write" ON public."supplier_contacts" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- ----- 2. capital_withdrawals ------------------------------------------------

CREATE TABLE IF NOT EXISTS public."capital_withdrawals" (
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
  "withdrawn_by" text NOT NULL,
  "method" text NOT NULL CHECK ("method" IN ('cash', 'bank_transfer')),
  "reason" text,
  "amount" double precision NOT NULL CHECK ("amount" >= 0),
  "source_account" text NOT NULL,
  CONSTRAINT "capital_withdrawals_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "capital_withdrawals_branch_idx" ON public."capital_withdrawals" ("branch_id");
CREATE INDEX IF NOT EXISTS "capital_withdrawals_status_idx" ON public."capital_withdrawals" ("doc_status");
CREATE INDEX IF NOT EXISTS "capital_withdrawals_posting_idx" ON public."capital_withdrawals" ("posting_datetime");
DROP TRIGGER IF EXISTS "capital_withdrawals_set_updated_at" ON public."capital_withdrawals";
CREATE TRIGGER "capital_withdrawals_set_updated_at" BEFORE UPDATE ON public."capital_withdrawals"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."capital_withdrawals" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "capital_withdrawals_read" ON public."capital_withdrawals";
CREATE POLICY "capital_withdrawals_read" ON public."capital_withdrawals" FOR SELECT TO authenticated
  USING (public._can_read_branch(branch_id));
DROP POLICY IF EXISTS "capital_withdrawals_create_draft" ON public."capital_withdrawals";
CREATE POLICY "capital_withdrawals_create_draft" ON public."capital_withdrawals" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
DROP POLICY IF EXISTS "capital_withdrawals_update_draft" ON public."capital_withdrawals";
CREATE POLICY "capital_withdrawals_update_draft" ON public."capital_withdrawals" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
DROP POLICY IF EXISTS "capital_withdrawals_admin_override" ON public."capital_withdrawals";
CREATE POLICY "capital_withdrawals_admin_override" ON public."capital_withdrawals" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- register with the submit RPCs (same tier as capital_contributions — senior
-- accountant / admin only, money-movement affecting the equity accounts)
create or replace function public._is_submittable(p_table text) returns boolean
  language sql immutable as $$
  select p_table = any(array[
    'purchase_orders','stock_receipts','production_requests','production_batches',
    'warehouse_transfers','rep_stock_issues','sales_invoices','receipts',
    'payment_vouchers','return_requests','write_offs','stock_count_sessions',
    'rep_closeouts','payroll_runs','capital_contributions','capital_withdrawals'
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
    when 'capital_withdrawals'   then array['chief_accountant','system_admin']
    else array['system_admin']
  end
$$;

-- CAPW reference prefix
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
    when 'CapitalWithdrawal' then 'CAPW'
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
values ('CAPW-' || extract(year from now())::int, 'CAPW', extract(year from now())::int, 1)
on conflict (prefix, year) do nothing;

grant execute on function public.allocate_reference_id(text) to authenticated;
