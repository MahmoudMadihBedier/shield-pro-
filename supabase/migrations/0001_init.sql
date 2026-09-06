-- Shield Pro — Supabase schema (generated from scripts/supabase/schema.ts)
-- Regenerate:  pnpm tsx scripts/supabase/gen-schema.ts
-- Do not hand-edit; add follow-on migrations for changes.

set check_function_bodies = off;

-- updated_at trigger shared by every table
create or replace function public.set_updated_at() returns trigger
  language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ----- RBAC helpers (read the caller's own public.users profile) -------------
-- roles are stored as a comma/space separated slug string on public.users
-- (kept identical to the Appwrite model to bound migration churn).
create or replace function public.user_roles() returns text[]
  language sql stable security definer set search_path = public as $$
  select coalesce(
    string_to_array(regexp_replace(coalesce(u.roles, ''), '[[:space:]]+', ',', 'g'), ','),
    array[]::text[]
  )
  from public.users u
  where u.auth_user_id = auth.uid()::text
  limit 1
$$;

create or replace function public.has_role(p_role text) returns boolean
  language sql stable security definer set search_path = public as $$
  select p_role = any(public.user_roles())
$$;

create or replace function public.user_branch_id() returns text
  language sql stable security definer set search_path = public as $$
  select nullif(u.branch_id, '') from public.users u
  where u.auth_user_id = auth.uid()::text limit 1
$$;

-- ----- branch-scope read helpers (Plan §4.3) -------------------------------
-- Global-scope roles (mirror src/core/rbac.ts GLOBAL_SCOPE_ROLES) see all rows;
-- branch roles see only their own branch / warehouse / reps.
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


-- Branches (master)
CREATE TABLE IF NOT EXISTS public."branches" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "name_ar" text,
  "location" text,
  "sub_warehouse_id" text,
  "branch_accountant_id" text,
  "is_active" boolean DEFAULT true,
  CONSTRAINT "branches_name_uq" UNIQUE ("name")
);
CREATE TRIGGER "branches_set_updated_at" BEFORE UPDATE ON public."branches"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."branches" ENABLE ROW LEVEL SECURITY;

-- Warehouses (master)
CREATE TABLE IF NOT EXISTS public."warehouses" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('raw_store', 'factory_custody', 'main', 'sub', 'rep_custody')),
  "branch_id" text,
  "owner_user_id" text,
  "is_active" boolean DEFAULT true
);
CREATE INDEX IF NOT EXISTS "warehouses_kind_idx" ON public."warehouses" ("kind");
CREATE TRIGGER "warehouses_set_updated_at" BEFORE UPDATE ON public."warehouses"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."warehouses" ENABLE ROW LEVEL SECURITY;

-- Users (profile) (master)
CREATE TABLE IF NOT EXISTS public."users" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "auth_user_id" text NOT NULL,
  "full_name" text NOT NULL,
  "roles" text,
  "branch_id" text,
  "sub_warehouse_id" text,
  "job_grade" text,
  "is_active" boolean DEFAULT true,
  "base_salary" double precision DEFAULT 0 CHECK ("base_salary" >= 0),
  CONSTRAINT "users_auth_uq" UNIQUE ("auth_user_id")
);
CREATE INDEX IF NOT EXISTS "users_branch_idx" ON public."users" ("branch_id");
CREATE TRIGGER "users_set_updated_at" BEFORE UPDATE ON public."users"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;

-- Products (master)
CREATE TABLE IF NOT EXISTS public."products" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "name_ar" text,
  "uom" text NOT NULL,
  "base_price" double precision NOT NULL CHECK ("base_price" >= 0),
  "default_discount_pct" double precision DEFAULT 0 CHECK ("default_discount_pct" >= 0 AND "default_discount_pct" <= 100),
  "allowed_waste_pct" double precision DEFAULT 0 CHECK ("allowed_waste_pct" >= 0 AND "allowed_waste_pct" <= 100),
  "is_active" boolean DEFAULT true,
  CONSTRAINT "products_code_uq" UNIQUE ("code")
);
CREATE TRIGGER "products_set_updated_at" BEFORE UPDATE ON public."products"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."products" ENABLE ROW LEVEL SECURITY;

-- Product BOM lines (master)
CREATE TABLE IF NOT EXISTS public."product_bom" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "product_id" text NOT NULL,
  "raw_material_id" text NOT NULL,
  "qty_per_unit" double precision NOT NULL CHECK ("qty_per_unit" >= 0)
);
CREATE INDEX IF NOT EXISTS "bom_product_idx" ON public."product_bom" ("product_id");
CREATE TRIGGER "product_bom_set_updated_at" BEFORE UPDATE ON public."product_bom"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."product_bom" ENABLE ROW LEVEL SECURITY;

-- Raw materials (master)
CREATE TABLE IF NOT EXISTS public."raw_materials" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "uom" text NOT NULL,
  "purchase_price" double precision DEFAULT 0 CHECK ("purchase_price" >= 0),
  "preferred_supplier_id" text,
  "reorder_point" double precision DEFAULT 0 CHECK ("reorder_point" >= 0),
  CONSTRAINT "raw_materials_code_uq" UNIQUE ("code")
);
CREATE TRIGGER "raw_materials_set_updated_at" BEFORE UPDATE ON public."raw_materials"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."raw_materials" ENABLE ROW LEVEL SECURITY;

-- Suppliers (master)
CREATE TABLE IF NOT EXISTS public."suppliers" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "contact" text,
  "phone" text
);
CREATE TRIGGER "suppliers_set_updated_at" BEFORE UPDATE ON public."suppliers"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."suppliers" ENABLE ROW LEVEL SECURITY;

-- Customers (master)
CREATE TABLE IF NOT EXISTS public."customers" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "code" text NOT NULL,
  "name" text NOT NULL,
  "phone" text,
  "branch_id" text NOT NULL,
  "geo" text,
  "discount_pct" double precision DEFAULT 0 CHECK ("discount_pct" >= 0 AND "discount_pct" <= 100),
  "credit_limit" double precision DEFAULT 0 CHECK ("credit_limit" >= 0),
  "payment_terms_days" bigint DEFAULT 0 CHECK ("payment_terms_days" >= 0),
  "approval_state" text DEFAULT 'pending_approval' NOT NULL CHECK ("approval_state" IN ('approved', 'pending_approval')),
  "created_by" text,
  "portal_user_id" text,
  CONSTRAINT "customers_code_uq" UNIQUE ("code")
);
CREATE INDEX IF NOT EXISTS "customers_branch_idx" ON public."customers" ("branch_id");
CREATE INDEX IF NOT EXISTS "customers_approval_idx" ON public."customers" ("approval_state");
CREATE TRIGGER "customers_set_updated_at" BEFORE UPDATE ON public."customers"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."customers" ENABLE ROW LEVEL SECURITY;

-- Purchase orders (document)
CREATE TABLE IF NOT EXISTS public."purchase_orders" (
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
  "supplier_id" text NOT NULL,
  "lines" text,
  "total_value" double precision DEFAULT 0 CHECK ("total_value" >= 0),
  CONSTRAINT "purchase_orders_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "purchase_orders_branch_idx" ON public."purchase_orders" ("branch_id");
CREATE INDEX IF NOT EXISTS "purchase_orders_status_idx" ON public."purchase_orders" ("doc_status");
CREATE INDEX IF NOT EXISTS "purchase_orders_posting_idx" ON public."purchase_orders" ("posting_datetime");
CREATE TRIGGER "purchase_orders_set_updated_at" BEFORE UPDATE ON public."purchase_orders"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."purchase_orders" ENABLE ROW LEVEL SECURITY;

-- Raw-material receipts (document)
CREATE TABLE IF NOT EXISTS public."stock_receipts" (
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
  "purchase_order_ref" text NOT NULL,
  "supplier_lot_number" text,
  "lines" text,
  CONSTRAINT "stock_receipts_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "stock_receipts_branch_idx" ON public."stock_receipts" ("branch_id");
CREATE INDEX IF NOT EXISTS "stock_receipts_status_idx" ON public."stock_receipts" ("doc_status");
CREATE INDEX IF NOT EXISTS "stock_receipts_posting_idx" ON public."stock_receipts" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "stock_receipts_po_idx" ON public."stock_receipts" ("purchase_order_ref");
CREATE TRIGGER "stock_receipts_set_updated_at" BEFORE UPDATE ON public."stock_receipts"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."stock_receipts" ENABLE ROW LEVEL SECURITY;

-- Production requests (document)
CREATE TABLE IF NOT EXISTS public."production_requests" (
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
  "product_id" text NOT NULL,
  "planned_qty" double precision NOT NULL CHECK ("planned_qty" >= 0),
  "required_materials" text,
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected', 'issued')),
  CONSTRAINT "production_requests_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "production_requests_branch_idx" ON public."production_requests" ("branch_id");
CREATE INDEX IF NOT EXISTS "production_requests_status_idx" ON public."production_requests" ("doc_status");
CREATE INDEX IF NOT EXISTS "production_requests_posting_idx" ON public."production_requests" ("posting_datetime");
CREATE TRIGGER "production_requests_set_updated_at" BEFORE UPDATE ON public."production_requests"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."production_requests" ENABLE ROW LEVEL SECURITY;

-- Production batches (document)
CREATE TABLE IF NOT EXISTS public."production_batches" (
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
  "production_request_ref" text,
  "product_id" text NOT NULL,
  "lot_number" text NOT NULL,
  "produced_qty" double precision NOT NULL CHECK ("produced_qty" >= 0),
  "waste_qty" double precision DEFAULT 0 CHECK ("waste_qty" >= 0),
  "raw_material_lots" text,
  "expected_cost" double precision DEFAULT 0,
  "expected_profit" double precision DEFAULT 0,
  "qc_status" text DEFAULT 'pending_qc' NOT NULL CHECK ("qc_status" IN ('pending_qc', 'released', 'rejected')),
  "qc_by" text,
  "expiry_date" text,
  CONSTRAINT "production_batches_reference_id_uq" UNIQUE ("reference_id"),
  CONSTRAINT "batches_lot_uq" UNIQUE ("lot_number")
);
CREATE INDEX IF NOT EXISTS "production_batches_branch_idx" ON public."production_batches" ("branch_id");
CREATE INDEX IF NOT EXISTS "production_batches_status_idx" ON public."production_batches" ("doc_status");
CREATE INDEX IF NOT EXISTS "production_batches_posting_idx" ON public."production_batches" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "batches_qc_idx" ON public."production_batches" ("qc_status");
CREATE TRIGGER "production_batches_set_updated_at" BEFORE UPDATE ON public."production_batches"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."production_batches" ENABLE ROW LEVEL SECURITY;

-- Warehouse transfers (document)
CREATE TABLE IF NOT EXISTS public."warehouse_transfers" (
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
  "from_warehouse_id" text NOT NULL,
  "to_warehouse_id" text NOT NULL,
  "lines" text,
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected', 'executed', 'received')),
  "requested_by" text,
  "approved_by" text,
  "sent_by" text,
  "confirmed_received_by" text,
  CONSTRAINT "warehouse_transfers_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "warehouse_transfers_branch_idx" ON public."warehouse_transfers" ("branch_id");
CREATE INDEX IF NOT EXISTS "warehouse_transfers_status_idx" ON public."warehouse_transfers" ("doc_status");
CREATE INDEX IF NOT EXISTS "warehouse_transfers_posting_idx" ON public."warehouse_transfers" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "transfers_status_idx" ON public."warehouse_transfers" ("status");
CREATE TRIGGER "warehouse_transfers_set_updated_at" BEFORE UPDATE ON public."warehouse_transfers"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."warehouse_transfers" ENABLE ROW LEVEL SECURITY;

-- Rep stock issues (document)
CREATE TABLE IF NOT EXISTS public."rep_stock_issues" (
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
  "sub_warehouse_id" text NOT NULL,
  "rep_user_id" text NOT NULL,
  "lines" text,
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected', 'issued')),
  "requested_by" text,
  "approved_by" text,
  CONSTRAINT "rep_stock_issues_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "rep_stock_issues_branch_idx" ON public."rep_stock_issues" ("branch_id");
CREATE INDEX IF NOT EXISTS "rep_stock_issues_status_idx" ON public."rep_stock_issues" ("doc_status");
CREATE INDEX IF NOT EXISTS "rep_stock_issues_posting_idx" ON public."rep_stock_issues" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "rep_issues_rep_idx" ON public."rep_stock_issues" ("rep_user_id");
CREATE TRIGGER "rep_stock_issues_set_updated_at" BEFORE UPDATE ON public."rep_stock_issues"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."rep_stock_issues" ENABLE ROW LEVEL SECURITY;

-- Sales invoices (document)
CREATE TABLE IF NOT EXISTS public."sales_invoices" (
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
  "customer_id" text NOT NULL,
  "rep_user_id" text NOT NULL,
  "lines" text,
  "gross_total" double precision NOT NULL CHECK ("gross_total" >= 0),
  "discount_total" double precision DEFAULT 0 CHECK ("discount_total" >= 0),
  "net_total" double precision NOT NULL CHECK ("net_total" >= 0),
  "payment_method" text NOT NULL CHECK ("payment_method" IN ('cash', 'credit', 'bank_transfer', 'partial', 'post_dated_cheque')),
  "cash_amount" double precision DEFAULT 0 CHECK ("cash_amount" >= 0),
  "credit_amount" double precision DEFAULT 0 CHECK ("credit_amount" >= 0),
  "bank_reference" text,
  "geo" text NOT NULL,
  "sold_by" text,
  "cashup_confirmed_by" text,
  CONSTRAINT "sales_invoices_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "sales_invoices_branch_idx" ON public."sales_invoices" ("branch_id");
CREATE INDEX IF NOT EXISTS "sales_invoices_status_idx" ON public."sales_invoices" ("doc_status");
CREATE INDEX IF NOT EXISTS "sales_invoices_posting_idx" ON public."sales_invoices" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "invoices_customer_idx" ON public."sales_invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS "invoices_rep_idx" ON public."sales_invoices" ("rep_user_id");
CREATE INDEX IF NOT EXISTS "invoices_payment_idx" ON public."sales_invoices" ("payment_method");
CREATE TRIGGER "sales_invoices_set_updated_at" BEFORE UPDATE ON public."sales_invoices"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."sales_invoices" ENABLE ROW LEVEL SECURITY;

-- Collections / receipts (document)
CREATE TABLE IF NOT EXISTS public."receipts" (
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
  "invoice_ref" text NOT NULL,
  "customer_id" text NOT NULL,
  "amount" double precision NOT NULL CHECK ("amount" >= 0),
  "method" text NOT NULL CHECK ("method" IN ('cash', 'bank_transfer', 'post_dated_cheque')),
  "evidence_file_id" text,
  "collected_by" text,
  CONSTRAINT "receipts_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "receipts_branch_idx" ON public."receipts" ("branch_id");
CREATE INDEX IF NOT EXISTS "receipts_status_idx" ON public."receipts" ("doc_status");
CREATE INDEX IF NOT EXISTS "receipts_posting_idx" ON public."receipts" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "receipts_invoice_idx" ON public."receipts" ("invoice_ref");
CREATE TRIGGER "receipts_set_updated_at" BEFORE UPDATE ON public."receipts"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."receipts" ENABLE ROW LEVEL SECURITY;

-- Payment vouchers (document)
CREATE TABLE IF NOT EXISTS public."payment_vouchers" (
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
  "direction" text NOT NULL CHECK ("direction" IN ('receipt', 'payment')),
  "amount" double precision NOT NULL CHECK ("amount" >= 0),
  "reason" text NOT NULL,
  "counterparty" text,
  "treasury_account" text,
  "evidence_file_id" text,
  CONSTRAINT "payment_vouchers_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "payment_vouchers_branch_idx" ON public."payment_vouchers" ("branch_id");
CREATE INDEX IF NOT EXISTS "payment_vouchers_status_idx" ON public."payment_vouchers" ("doc_status");
CREATE INDEX IF NOT EXISTS "payment_vouchers_posting_idx" ON public."payment_vouchers" ("posting_datetime");
CREATE TRIGGER "payment_vouchers_set_updated_at" BEFORE UPDATE ON public."payment_vouchers"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."payment_vouchers" ENABLE ROW LEVEL SECURITY;

-- Return requests (document)
CREATE TABLE IF NOT EXISTS public."return_requests" (
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
  "origin_ref" text NOT NULL,
  "lines" text,
  "reason" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL CHECK ("status" IN ('pending', 'approved', 'rejected')),
  "requested_by" text,
  "approved_by" text,
  CONSTRAINT "return_requests_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "return_requests_branch_idx" ON public."return_requests" ("branch_id");
CREATE INDEX IF NOT EXISTS "return_requests_status_idx" ON public."return_requests" ("doc_status");
CREATE INDEX IF NOT EXISTS "return_requests_posting_idx" ON public."return_requests" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "returns_origin_idx" ON public."return_requests" ("origin_ref");
CREATE TRIGGER "return_requests_set_updated_at" BEFORE UPDATE ON public."return_requests"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."return_requests" ENABLE ROW LEVEL SECURITY;

-- Write-offs / damages (document)
CREATE TABLE IF NOT EXISTS public."write_offs" (
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
  "warehouse_id" text NOT NULL,
  "lines" text,
  "kind" text NOT NULL CHECK ("kind" IN ('damage', 'loss', 'scrap')),
  "reason" text NOT NULL,
  "requested_by" text,
  "approved_by" text,
  CONSTRAINT "write_offs_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "write_offs_branch_idx" ON public."write_offs" ("branch_id");
CREATE INDEX IF NOT EXISTS "write_offs_status_idx" ON public."write_offs" ("doc_status");
CREATE INDEX IF NOT EXISTS "write_offs_posting_idx" ON public."write_offs" ("posting_datetime");
CREATE TRIGGER "write_offs_set_updated_at" BEFORE UPDATE ON public."write_offs"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."write_offs" ENABLE ROW LEVEL SECURITY;

-- Stock count sessions (document)
CREATE TABLE IF NOT EXISTS public."stock_count_sessions" (
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
  "warehouse_id" text NOT NULL,
  "counts" text,
  "variances" text,
  "status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'submitted', 'signed_off')),
  "signed_off_by" text,
  CONSTRAINT "stock_count_sessions_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "stock_count_sessions_branch_idx" ON public."stock_count_sessions" ("branch_id");
CREATE INDEX IF NOT EXISTS "stock_count_sessions_status_idx" ON public."stock_count_sessions" ("doc_status");
CREATE INDEX IF NOT EXISTS "stock_count_sessions_posting_idx" ON public."stock_count_sessions" ("posting_datetime");
CREATE TRIGGER "stock_count_sessions_set_updated_at" BEFORE UPDATE ON public."stock_count_sessions"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."stock_count_sessions" ENABLE ROW LEVEL SECURITY;

-- Rep daily close-outs (document)
CREATE TABLE IF NOT EXISTS public."rep_closeouts" (
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
  "rep_user_id" text NOT NULL,
  "business_date" text NOT NULL,
  "expected" text,
  "actual" text,
  "stock_variance" double precision DEFAULT 0,
  "cash_variance" double precision DEFAULT 0,
  "status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'submitted', 'confirmed', 'flagged')),
  "confirmed_by" text,
  CONSTRAINT "rep_closeouts_reference_id_uq" UNIQUE ("reference_id"),
  CONSTRAINT "closeouts_rep_date_uq" UNIQUE ("rep_user_id", "business_date")
);
CREATE INDEX IF NOT EXISTS "rep_closeouts_branch_idx" ON public."rep_closeouts" ("branch_id");
CREATE INDEX IF NOT EXISTS "rep_closeouts_status_idx" ON public."rep_closeouts" ("doc_status");
CREATE INDEX IF NOT EXISTS "rep_closeouts_posting_idx" ON public."rep_closeouts" ("posting_datetime");
CREATE TRIGGER "rep_closeouts_set_updated_at" BEFORE UPDATE ON public."rep_closeouts"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."rep_closeouts" ENABLE ROW LEVEL SECURITY;

-- Payroll runs (document)
CREATE TABLE IF NOT EXISTS public."payroll_runs" (
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
  "pay_period_start" text NOT NULL,
  "pay_period_end" text NOT NULL,
  "lines" text,
  "total_net_pay" double precision DEFAULT 0 CHECK ("total_net_pay" >= 0),
  CONSTRAINT "payroll_runs_reference_id_uq" UNIQUE ("reference_id")
);
CREATE INDEX IF NOT EXISTS "payroll_runs_branch_idx" ON public."payroll_runs" ("branch_id");
CREATE INDEX IF NOT EXISTS "payroll_runs_status_idx" ON public."payroll_runs" ("doc_status");
CREATE INDEX IF NOT EXISTS "payroll_runs_posting_idx" ON public."payroll_runs" ("posting_datetime");
CREATE INDEX IF NOT EXISTS "payroll_period_idx" ON public."payroll_runs" ("pay_period_start");
CREATE TRIGGER "payroll_runs_set_updated_at" BEFORE UPDATE ON public."payroll_runs"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."payroll_runs" ENABLE ROW LEVEL SECURITY;

-- Attendance records (attendance)
CREATE TABLE IF NOT EXISTS public."attendance_records" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "user_id" text NOT NULL,
  "date" text NOT NULL,
  "check_in" timestamptz,
  "check_out" timestamptz,
  "status" text DEFAULT 'present' NOT NULL CHECK ("status" IN ('present', 'absent', 'leave', 'half_day')),
  "notes" text,
  "branch_id" text,
  "created_by" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  CONSTRAINT "attendance_user_date_uq" UNIQUE ("user_id", "date")
);
CREATE INDEX IF NOT EXISTS "attendance_branch_idx" ON public."attendance_records" ("branch_id");
CREATE TRIGGER "attendance_records_set_updated_at" BEFORE UPDATE ON public."attendance_records"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."attendance_records" ENABLE ROW LEVEL SECURITY;

-- Incentive rules (master)
CREATE TABLE IF NOT EXISTS public."incentive_rules" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "name" text NOT NULL,
  "kind" text NOT NULL CHECK ("kind" IN ('sales_commission', 'production_bonus', 'attendance_bonus')),
  "predicate" text,
  "amount_or_pct" double precision DEFAULT 0 CHECK ("amount_or_pct" >= 0),
  "is_active" boolean DEFAULT true
);
CREATE TRIGGER "incentive_rules_set_updated_at" BEFORE UPDATE ON public."incentive_rules"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."incentive_rules" ENABLE ROW LEVEL SECURITY;

-- Stock ledger entries (ledger)
CREATE TABLE IF NOT EXISTS public."stock_ledger_entries" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "voucher_type" text NOT NULL,
  "voucher_no" text NOT NULL,
  "product_id" text NOT NULL,
  "warehouse_id" text NOT NULL,
  "lot_number" text,
  "qty_change" double precision NOT NULL,
  "qty_after" double precision NOT NULL,
  "valuation_rate" double precision DEFAULT 0,
  "posting_datetime" timestamptz NOT NULL,
  "is_cancelled" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "sle_voucher_idx" ON public."stock_ledger_entries" ("voucher_no");
CREATE INDEX IF NOT EXISTS "sle_item_wh_idx" ON public."stock_ledger_entries" ("product_id", "warehouse_id");
CREATE INDEX IF NOT EXISTS "sle_posting_idx" ON public."stock_ledger_entries" ("posting_datetime");
CREATE TRIGGER "stock_ledger_entries_set_updated_at" BEFORE UPDATE ON public."stock_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."stock_ledger_entries" ENABLE ROW LEVEL SECURITY;

-- General ledger entries (ledger)
CREATE TABLE IF NOT EXISTS public."general_ledger_entries" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "voucher_type" text NOT NULL,
  "voucher_no" text NOT NULL,
  "account" text NOT NULL,
  "branch_id" text,
  "debit" double precision DEFAULT 0 CHECK ("debit" >= 0),
  "credit" double precision DEFAULT 0 CHECK ("credit" >= 0),
  "posting_datetime" timestamptz NOT NULL,
  "is_cancelled" boolean DEFAULT false
);
CREATE INDEX IF NOT EXISTS "gle_voucher_idx" ON public."general_ledger_entries" ("voucher_no");
CREATE INDEX IF NOT EXISTS "gle_account_idx" ON public."general_ledger_entries" ("account");
CREATE TRIGGER "general_ledger_entries_set_updated_at" BEFORE UPDATE ON public."general_ledger_entries"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."general_ledger_entries" ENABLE ROW LEVEL SECURITY;

-- Rep stock ledger (ledger)
CREATE TABLE IF NOT EXISTS public."rep_stock_ledger" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "rep_user_id" text NOT NULL,
  "product_id" text NOT NULL,
  "voucher_no" text NOT NULL,
  "qty_change" double precision NOT NULL,
  "qty_after" double precision NOT NULL,
  "posting_datetime" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "rsl_rep_item_idx" ON public."rep_stock_ledger" ("rep_user_id", "product_id");
CREATE TRIGGER "rep_stock_ledger_set_updated_at" BEFORE UPDATE ON public."rep_stock_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."rep_stock_ledger" ENABLE ROW LEVEL SECURITY;

-- Rep cash ledger (ledger)
CREATE TABLE IF NOT EXISTS public."rep_cash_ledger" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "rep_user_id" text NOT NULL,
  "voucher_no" text NOT NULL,
  "method" text CHECK ("method" IN ('cash', 'bank_transfer', 'post_dated_cheque')),
  "amount_change" double precision NOT NULL,
  "amount_after" double precision NOT NULL,
  "posting_datetime" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "rcl_rep_idx" ON public."rep_cash_ledger" ("rep_user_id");
CREATE TRIGGER "rep_cash_ledger_set_updated_at" BEFORE UPDATE ON public."rep_cash_ledger"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."rep_cash_ledger" ENABLE ROW LEVEL SECURITY;

-- Bin balances (projection) (ledger)
CREATE TABLE IF NOT EXISTS public."bin_balances" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "product_id" text NOT NULL,
  "warehouse_id" text NOT NULL,
  "qty" double precision DEFAULT 0 NOT NULL,
  "updated_datetime" timestamptz NOT NULL,
  CONSTRAINT "bin_item_wh_uq" UNIQUE ("product_id", "warehouse_id")
);
CREATE TRIGGER "bin_balances_set_updated_at" BEFORE UPDATE ON public."bin_balances"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."bin_balances" ENABLE ROW LEVEL SECURITY;

-- Approval requests (control)
CREATE TABLE IF NOT EXISTS public."approval_requests" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "entity_type" text NOT NULL,
  "entity_ref" text NOT NULL,
  "branch_id" text,
  "requested_by" text NOT NULL,
  "state" text DEFAULT 'pending' NOT NULL CHECK ("state" IN ('pending', 'auto_approved', 'approved', 'rejected')),
  "decided_by" text,
  "decision_reason" text,
  "created_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "approvals_state_idx" ON public."approval_requests" ("state");
CREATE INDEX IF NOT EXISTS "approvals_entity_idx" ON public."approval_requests" ("entity_ref");
CREATE TRIGGER "approval_requests_set_updated_at" BEFORE UPDATE ON public."approval_requests"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."approval_requests" ENABLE ROW LEVEL SECURITY;

-- Approval rules (master)
CREATE TABLE IF NOT EXISTS public."approval_rules" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "movement_type" text NOT NULL,
  "predicate" text NOT NULL,
  "action" text NOT NULL CHECK ("action" IN ('auto_approve', 'force_manual')),
  "priority" bigint DEFAULT 100,
  "is_active" boolean DEFAULT true
);
CREATE TRIGGER "approval_rules_set_updated_at" BEFORE UPDATE ON public."approval_rules"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."approval_rules" ENABLE ROW LEVEL SECURITY;

-- Approval rule evaluations (control)
CREATE TABLE IF NOT EXISTS public."approval_rule_log" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "movement_type" text NOT NULL,
  "entity_ref" text NOT NULL,
  "actor_id" text,
  "rule_matched" text,
  "outcome" text NOT NULL,
  "created_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "rule_log_entity_idx" ON public."approval_rule_log" ("entity_ref");
CREATE TRIGGER "approval_rule_log_set_updated_at" BEFORE UPDATE ON public."approval_rule_log"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."approval_rule_log" ENABLE ROW LEVEL SECURITY;

-- Fraud flags (control)
CREATE TABLE IF NOT EXISTS public."fraud_flags" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "kind" text NOT NULL CHECK ("kind" IN ('round_tripping', 'repeated_movement', 'high_reversal_ratio')),
  "subject_type" text NOT NULL,
  "subject_id" text NOT NULL,
  "detail" text,
  "status" text DEFAULT 'open' NOT NULL CHECK ("status" IN ('open', 'reviewed', 'dismissed')),
  "created_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "fraud_status_idx" ON public."fraud_flags" ("status");
CREATE TRIGGER "fraud_flags_set_updated_at" BEFORE UPDATE ON public."fraud_flags"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."fraud_flags" ENABLE ROW LEVEL SECURITY;

-- Notifications (notifications)
CREATE TABLE IF NOT EXISTS public."notifications" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "recipient_user_id" text NOT NULL,
  "kind" text NOT NULL,
  "title" text NOT NULL,
  "body" text,
  "entity_ref" text,
  "is_read" boolean DEFAULT false,
  "created_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "notif_recipient_idx" ON public."notifications" ("recipient_user_id");
CREATE INDEX IF NOT EXISTS "notif_read_idx" ON public."notifications" ("is_read");
CREATE TRIGGER "notifications_set_updated_at" BEFORE UPDATE ON public."notifications"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."notifications" ENABLE ROW LEVEL SECURITY;

-- Audit log (control)
CREATE TABLE IF NOT EXISTS public."audit_log" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "actor_id" text NOT NULL,
  "action" text NOT NULL,
  "entity_type" text NOT NULL,
  "entity_ref" text NOT NULL,
  "before" text,
  "after" text,
  "created_at" timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS "audit_entity_idx" ON public."audit_log" ("entity_ref");
CREATE INDEX IF NOT EXISTS "audit_actor_idx" ON public."audit_log" ("actor_id");
CREATE INDEX IF NOT EXISTS "audit_created_idx" ON public."audit_log" ("created_at");
CREATE TRIGGER "audit_log_set_updated_at" BEFORE UPDATE ON public."audit_log"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."audit_log" ENABLE ROW LEVEL SECURITY;

-- Naming series counters (master)
CREATE TABLE IF NOT EXISTS public."naming_series_counters" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  "prefix" text NOT NULL,
  "year" bigint NOT NULL CHECK ("year" >= 2000 AND "year" <= 9999),
  "next_value" bigint DEFAULT 1 NOT NULL CHECK ("next_value" >= 1),
  CONSTRAINT "naming_prefix_year_uq" UNIQUE ("prefix", "year")
);
CREATE TRIGGER "naming_series_counters_set_updated_at" BEFORE UPDATE ON public."naming_series_counters"
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
ALTER TABLE public."naming_series_counters" ENABLE ROW LEVEL SECURITY;

-- RLS: branches (master)
CREATE POLICY "branches_read" ON public."branches" FOR SELECT TO authenticated USING (true);
CREATE POLICY "branches_admin_write" ON public."branches" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: warehouses (master)
CREATE POLICY "warehouses_read" ON public."warehouses" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "warehouses_admin_write" ON public."warehouses" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: users (master)
CREATE POLICY "users_read" ON public."users" FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_admin_write" ON public."users" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: products (master)
CREATE POLICY "products_read" ON public."products" FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_write" ON public."products" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: product_bom (master)
CREATE POLICY "product_bom_read" ON public."product_bom" FOR SELECT TO authenticated USING (true);
CREATE POLICY "product_bom_admin_write" ON public."product_bom" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: raw_materials (master)
CREATE POLICY "raw_materials_read" ON public."raw_materials" FOR SELECT TO authenticated USING (true);
CREATE POLICY "raw_materials_admin_write" ON public."raw_materials" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: suppliers (master)
CREATE POLICY "suppliers_read" ON public."suppliers" FOR SELECT TO authenticated USING (true);
CREATE POLICY "suppliers_admin_write" ON public."suppliers" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: customers (master)
CREATE POLICY "customers_read" ON public."customers" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "customers_admin_write" ON public."customers" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: purchase_orders (document)
CREATE POLICY "purchase_orders_read" ON public."purchase_orders" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "purchase_orders_create_draft" ON public."purchase_orders" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "purchase_orders_update_draft" ON public."purchase_orders" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "purchase_orders_admin_override" ON public."purchase_orders" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: stock_receipts (document)
CREATE POLICY "stock_receipts_read" ON public."stock_receipts" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "stock_receipts_create_draft" ON public."stock_receipts" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "stock_receipts_update_draft" ON public."stock_receipts" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "stock_receipts_admin_override" ON public."stock_receipts" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: production_requests (document)
CREATE POLICY "production_requests_read" ON public."production_requests" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "production_requests_create_draft" ON public."production_requests" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "production_requests_update_draft" ON public."production_requests" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "production_requests_admin_override" ON public."production_requests" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: production_batches (document)
CREATE POLICY "production_batches_read" ON public."production_batches" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "production_batches_create_draft" ON public."production_batches" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "production_batches_update_draft" ON public."production_batches" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "production_batches_admin_override" ON public."production_batches" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: warehouse_transfers (document)
CREATE POLICY "warehouse_transfers_read" ON public."warehouse_transfers" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "warehouse_transfers_create_draft" ON public."warehouse_transfers" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "warehouse_transfers_update_draft" ON public."warehouse_transfers" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "warehouse_transfers_admin_override" ON public."warehouse_transfers" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: rep_stock_issues (document)
CREATE POLICY "rep_stock_issues_read" ON public."rep_stock_issues" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "rep_stock_issues_create_draft" ON public."rep_stock_issues" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "rep_stock_issues_update_draft" ON public."rep_stock_issues" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "rep_stock_issues_admin_override" ON public."rep_stock_issues" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: sales_invoices (document)
CREATE POLICY "sales_invoices_read" ON public."sales_invoices" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "sales_invoices_create_draft" ON public."sales_invoices" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "sales_invoices_update_draft" ON public."sales_invoices" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "sales_invoices_admin_override" ON public."sales_invoices" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: receipts (document)
CREATE POLICY "receipts_read" ON public."receipts" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "receipts_create_draft" ON public."receipts" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "receipts_update_draft" ON public."receipts" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "receipts_admin_override" ON public."receipts" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: payment_vouchers (document)
CREATE POLICY "payment_vouchers_read" ON public."payment_vouchers" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "payment_vouchers_create_draft" ON public."payment_vouchers" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "payment_vouchers_update_draft" ON public."payment_vouchers" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "payment_vouchers_admin_override" ON public."payment_vouchers" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: return_requests (document)
CREATE POLICY "return_requests_read" ON public."return_requests" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "return_requests_create_draft" ON public."return_requests" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "return_requests_update_draft" ON public."return_requests" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "return_requests_admin_override" ON public."return_requests" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: write_offs (document)
CREATE POLICY "write_offs_read" ON public."write_offs" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "write_offs_create_draft" ON public."write_offs" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "write_offs_update_draft" ON public."write_offs" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "write_offs_admin_override" ON public."write_offs" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: stock_count_sessions (document)
CREATE POLICY "stock_count_sessions_read" ON public."stock_count_sessions" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "stock_count_sessions_create_draft" ON public."stock_count_sessions" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "stock_count_sessions_update_draft" ON public."stock_count_sessions" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "stock_count_sessions_admin_override" ON public."stock_count_sessions" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: rep_closeouts (document)
CREATE POLICY "rep_closeouts_read" ON public."rep_closeouts" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "rep_closeouts_create_draft" ON public."rep_closeouts" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "rep_closeouts_update_draft" ON public."rep_closeouts" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "rep_closeouts_admin_override" ON public."rep_closeouts" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: payroll_runs (document)
CREATE POLICY "payroll_runs_read" ON public."payroll_runs" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));
CREATE POLICY "payroll_runs_create_draft" ON public."payroll_runs" FOR INSERT TO authenticated
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "payroll_runs_update_draft" ON public."payroll_runs" FOR UPDATE TO authenticated
  USING (doc_status = 0 AND created_by = auth.uid()::text)
  WITH CHECK (doc_status = 0 AND created_by = auth.uid()::text);
CREATE POLICY "payroll_runs_admin_override" ON public."payroll_runs" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: attendance_records (attendance)
CREATE POLICY "attendance_records_read" ON public."attendance_records" FOR SELECT TO authenticated USING (true);
CREATE POLICY "attendance_records_insert" ON public."attendance_records" FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid()::text);
CREATE POLICY "attendance_records_update_own" ON public."attendance_records" FOR UPDATE TO authenticated
  USING (created_by = auth.uid()::text) WITH CHECK (created_by = auth.uid()::text);
CREATE POLICY "attendance_records_admin_override" ON public."attendance_records" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: incentive_rules (master)
CREATE POLICY "incentive_rules_read" ON public."incentive_rules" FOR SELECT TO authenticated USING (true);
CREATE POLICY "incentive_rules_admin_write" ON public."incentive_rules" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: stock_ledger_entries (ledger)
CREATE POLICY "stock_ledger_entries_read" ON public."stock_ledger_entries" FOR SELECT TO authenticated USING (public._can_read_warehouse(warehouse_id));

-- RLS: general_ledger_entries (ledger)
CREATE POLICY "general_ledger_entries_read" ON public."general_ledger_entries" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));

-- RLS: rep_stock_ledger (ledger)
CREATE POLICY "rep_stock_ledger_read" ON public."rep_stock_ledger" FOR SELECT TO authenticated USING (public._can_read_rep(rep_user_id));

-- RLS: rep_cash_ledger (ledger)
CREATE POLICY "rep_cash_ledger_read" ON public."rep_cash_ledger" FOR SELECT TO authenticated USING (public._can_read_rep(rep_user_id));

-- RLS: bin_balances (ledger)
CREATE POLICY "bin_balances_read" ON public."bin_balances" FOR SELECT TO authenticated USING (public._can_read_warehouse(warehouse_id));

-- RLS: approval_requests (control)
CREATE POLICY "approval_requests_read" ON public."approval_requests" FOR SELECT TO authenticated USING (public._can_read_branch(branch_id));

-- RLS: approval_rules (master)
CREATE POLICY "approval_rules_read" ON public."approval_rules" FOR SELECT TO authenticated USING (true);
CREATE POLICY "approval_rules_admin_write" ON public."approval_rules" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- RLS: approval_rule_log (control)
CREATE POLICY "approval_rule_log_read" ON public."approval_rule_log" FOR SELECT TO authenticated USING (true);

-- RLS: fraud_flags (control)
CREATE POLICY "fraud_flags_read" ON public."fraud_flags" FOR SELECT TO authenticated USING (true);

-- RLS: notifications (notifications)
CREATE POLICY "notifications_read_own" ON public."notifications" FOR SELECT TO authenticated
  USING (recipient_user_id = auth.uid()::text);
CREATE POLICY "notifications_mark_read" ON public."notifications" FOR UPDATE TO authenticated
  USING (recipient_user_id = auth.uid()::text) WITH CHECK (recipient_user_id = auth.uid()::text);

-- RLS: audit_log (control)
CREATE POLICY "audit_log_read" ON public."audit_log" FOR SELECT TO authenticated USING (true);

-- RLS: naming_series_counters (master)
CREATE POLICY "naming_series_counters_read" ON public."naming_series_counters" FOR SELECT TO authenticated USING (true);
CREATE POLICY "naming_series_counters_admin_write" ON public."naming_series_counters" FOR ALL TO authenticated
  USING (public.has_role('system_admin')) WITH CHECK (public.has_role('system_admin'));

-- ----- CRM portal: customer sees only its own documents ---------------------
create policy "sales_invoices_portal_read" on public."sales_invoices"
  for select to authenticated
  using (customer_id in (select id from public.customers where portal_user_id = auth.uid()::text));
create policy "receipts_portal_read" on public."receipts"
  for select to authenticated
  using (customer_id in (select id from public.customers where portal_user_id = auth.uid()::text));

-- ----- public.users: a user sees + edits its own profile row ----------------
create policy "users_read_self" on public."users"
  for select to authenticated using (auth_user_id = auth.uid()::text);
create policy "users_update_self" on public."users"
  for update to authenticated using (auth_user_id = auth.uid()::text)
  with check (auth_user_id = auth.uid()::text);

