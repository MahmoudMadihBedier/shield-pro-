-- Warehouses get an optional "lat,lng" location (same format as customers /
-- sales invoices). 0001 / schema.ts regenerated to match; this adds the column
-- to the already-provisioned project.

alter table public.warehouses add column if not exists geo text;
