-- Multi-rep attribution on sales invoices and purchase orders: a JSON array of
-- { user_id, branch_id }. `sales_invoices.rep_user_id` stays the primary rep
-- (custody + rep-ledger key); `reps` is additional attribution / commission
-- data. 0001 / schema.ts regenerated; this adds the column on the provisioned
-- project.

alter table public.sales_invoices add column if not exists reps text;
alter table public.purchase_orders add column if not exists reps text;
