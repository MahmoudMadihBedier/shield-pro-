-- The chart of accounts — the single source of truth every GL-posting module
-- now validates account references against, instead of three modules each
-- typing their own free-text account strings (accounting/sales/returns).
-- `code` is the id already live in `general_ledger_entries.account` for
-- every account below — this migration only gives those existing strings a
-- home, a type, and a display number; it renames nothing, so historical
-- postings keep aggregating correctly.
--
-- 0001/schema.ts already define the table for a from-scratch build; this
-- creates it + seeds it on the already-provisioned project.

set check_function_bodies = off;

CREATE TABLE IF NOT EXISTS public."chart_of_accounts" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "code" text NOT NULL,
  "account_number" text NOT NULL,
  "name" text NOT NULL,
  "name_ar" text,
  "account_type" text NOT NULL CHECK ("account_type" IN ('asset', 'liability', 'equity', 'income', 'expense')),
  "is_active" boolean DEFAULT true,
  CONSTRAINT "chart_of_accounts_code_uq" UNIQUE ("code"),
  CONSTRAINT "chart_of_accounts_number_uq" UNIQUE ("account_number")
);
CREATE INDEX IF NOT EXISTS "chart_of_accounts_type_idx" ON public."chart_of_accounts" ("account_type");
DROP TRIGGER IF EXISTS "chart_of_accounts_set_updated_at" ON public."chart_of_accounts";
CREATE TRIGGER "chart_of_accounts_set_updated_at" BEFORE UPDATE ON public."chart_of_accounts"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."chart_of_accounts" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chart_of_accounts_read" ON public."chart_of_accounts";
CREATE POLICY "chart_of_accounts_read" ON public."chart_of_accounts" FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "chart_of_accounts_admin_write" ON public."chart_of_accounts";
CREATE POLICY "chart_of_accounts_admin_write" ON public."chart_of_accounts" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- Seed: every account id already referenced by gl.ts / sales / returns today.
insert into public.chart_of_accounts (id, code, account_number, name, name_ar, account_type, is_active)
values
  (gen_random_uuid()::text, 'cash',                  '1000', 'Cash',                    'نقد',                          'asset',     true),
  (gen_random_uuid()::text, 'bank',                  '1010', 'Bank',                    'البنك',                        'asset',     true),
  (gen_random_uuid()::text, 'treasury',              '1020', 'Treasury',                'الخزينة',                      'asset',     true),
  (gen_random_uuid()::text, 'accounts_receivable',   '1100', 'Accounts Receivable',     'حسابات مدينة (عملاء)',          'asset',     true),
  (gen_random_uuid()::text, 'fixed_assets_vehicles',  '1500', 'Fixed Assets — Vehicles', 'أصول ثابتة — مركبات',          'asset',     true),
  (gen_random_uuid()::text, 'fixed_assets_property',  '1510', 'Fixed Assets — Property', 'أصول ثابتة — عقارات',          'asset',     true),
  (gen_random_uuid()::text, 'fixed_assets_equipment', '1520', 'Fixed Assets — Equipment','أصول ثابتة — معدات',           'asset',     true),
  (gen_random_uuid()::text, 'fixed_assets_other',     '1590', 'Fixed Assets — Other',    'أصول ثابتة — أخرى',            'asset',     true),
  (gen_random_uuid()::text, 'accounts_payable',      '2000', 'Accounts Payable',        'حسابات دائنة (موردون)',         'liability', true),
  (gen_random_uuid()::text, 'owners_capital',        '3000', 'Owner''s Capital',        'رأس مال الملاك',                'equity',    true),
  (gen_random_uuid()::text, 'owners_drawings',       '3010', 'Owner''s Drawings',       'مسحوبات الملاك',                'equity',    true),
  (gen_random_uuid()::text, 'sales_revenue',         '4000', 'Sales Revenue',           'إيرادات المبيعات',              'income',    true),
  (gen_random_uuid()::text, 'sales_returns',         '4900', 'Sales Returns',           'مرتجعات المبيعات',              'income',    true),
  (gen_random_uuid()::text, 'other',                 '4910', 'Other Income',            'إيرادات أخرى',                  'income',    true),
  (gen_random_uuid()::text, 'expense',               '5000', 'Expenses',                'مصروفات',                       'expense',   true)
on conflict (code) do nothing;

-- ----- trial_balance: now also returns each row's account_type ------------
-- Additive only (new key on each row) — every existing caller ignores it.
create or replace function public.trial_balance(
  p_from timestamptz default null, p_to timestamptz default null
) returns jsonb
  language sql stable security definer set search_path = public as $$
  with r as (
    select account, sum(debit) as debit, sum(credit) as credit
    from public.general_ledger_entries
    where not coalesce(is_cancelled, false)
      and (p_from is null or posting_datetime >= p_from)
      and (p_to is null or posting_datetime <= p_to)
      and public._can_read_branch(branch_id)
    group by account
  )
  select jsonb_build_object(
    'rows', coalesce(jsonb_agg(jsonb_build_object(
      'account', r.account, 'debit', r.debit, 'credit', r.credit, 'balance', r.debit - r.credit,
      'accountType', coa.account_type
    ) order by r.account), '[]'::jsonb),
    'totalDebit', coalesce(sum(r.debit), 0),
    'totalCredit', coalesce(sum(r.credit), 0)
  )
  from r
  left join public.chart_of_accounts coa on coa.code = r.account;
$$;

grant execute on function public.trial_balance(timestamptz, timestamptz) to authenticated;
