-- Story 4.3 — branch-scoped SELECT visibility, enforced in RLS (not just the
-- UI). Global-scope roles (system_admin, chief_accountant,
-- main_warehouse_manager — mirror src/core/rbac.ts) see every row; a
-- branch-scoped role sees only rows for its own branch / warehouse / reps.
--
-- Supersedes the `USING (true)` read policies migration 0001 generated for
-- these 22 tables; 0001 (and gen-schema.ts) now emit the scoped form for a
-- from-scratch build, and this migration applies the delta to the already-
-- provisioned project. Catalog / reference / oversight tables (branches,
-- products, raw_materials, suppliers, users, approval_rules, fraud_flags,
-- audit_log, …) keep the staff-wide read.

set check_function_bodies = off;

-- ----- helpers -------------------------------------------------------------
create or replace function public._has_global_scope() returns boolean
  language sql stable security definer set search_path = public as $$
  select public.has_role('system_admin')
      or public.has_role('chief_accountant')
      or public.has_role('main_warehouse_manager')
$$;

create or replace function public._can_read_branch(p_branch text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public._has_global_scope()
      or p_branch is null or p_branch = ''
      or p_branch = public.user_branch_id()
$$;

create or replace function public._can_read_warehouse(p_wh text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public._has_global_scope()
      or p_wh is null or p_wh = ''
      or exists (select 1 from public.warehouses w
                 where w.id = p_wh and w.branch_id = public.user_branch_id())
$$;

create or replace function public._can_read_rep(p_rep text) returns boolean
  language sql stable security definer set search_path = public as $$
  select public._has_global_scope()
      or p_rep = auth.uid()::text
      or exists (select 1 from public.users u
                 where u.auth_user_id = p_rep and u.branch_id = public.user_branch_id())
$$;

-- ----- re-scope the read policies ---------------------------------------
do $$
declare
  r record;
begin
  for r in
    select * from (values
      ('warehouses',             '_can_read_branch(branch_id)'),
      ('customers',              '_can_read_branch(branch_id)'),
      ('purchase_orders',        '_can_read_branch(branch_id)'),
      ('stock_receipts',         '_can_read_branch(branch_id)'),
      ('production_requests',    '_can_read_branch(branch_id)'),
      ('production_batches',     '_can_read_branch(branch_id)'),
      ('warehouse_transfers',    '_can_read_branch(branch_id)'),
      ('rep_stock_issues',       '_can_read_branch(branch_id)'),
      ('sales_invoices',         '_can_read_branch(branch_id)'),
      ('receipts',               '_can_read_branch(branch_id)'),
      ('payment_vouchers',       '_can_read_branch(branch_id)'),
      ('return_requests',        '_can_read_branch(branch_id)'),
      ('write_offs',             '_can_read_branch(branch_id)'),
      ('stock_count_sessions',   '_can_read_branch(branch_id)'),
      ('rep_closeouts',          '_can_read_branch(branch_id)'),
      ('payroll_runs',           '_can_read_branch(branch_id)'),
      ('general_ledger_entries', '_can_read_branch(branch_id)'),
      ('approval_requests',      '_can_read_branch(branch_id)'),
      ('stock_ledger_entries',   '_can_read_warehouse(warehouse_id)'),
      ('bin_balances',           '_can_read_warehouse(warehouse_id)'),
      ('rep_stock_ledger',       '_can_read_rep(rep_user_id)'),
      ('rep_cash_ledger',        '_can_read_rep(rep_user_id)')
    ) as v(tbl, pred)
  loop
    execute format('drop policy if exists %I on public.%I', r.tbl || '_read', r.tbl);
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.%s)',
      r.tbl || '_read', r.tbl, r.pred);
  end loop;
end;
$$;
