-- Alternate selling units per product: a JSON array of { unit, factor, label? }
-- where factor = how many STOCK units make one sale unit (e.g. a carton of 12).
-- The product's own `uom` is always the implicit factor-1 base unit. Sales
-- invoice lines keep `qty` in base units (the stock + pricing key) and now also
-- record the chosen `sale_unit` + `sale_qty`. 0001 / schema.ts regenerated;
-- this adds the column on the provisioned project.

alter table public.products add column if not exists sale_units text;
