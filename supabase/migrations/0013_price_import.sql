-- Phase 4.1 — supplier price-list import. A System Admin uploads a CSV of
-- `code,purchase_price`; this updates `raw_materials.purchase_price` by code,
-- skips unknown / invalid rows, and audits the batch.

set check_function_bodies = off;

create or replace function public.import_raw_material_prices(p_rows jsonb)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_row jsonb;
  v_code text;
  v_price numeric;
  v_applied int := 0;
  v_skipped int := 0;
  v_missing text[] := array[]::text[];
begin
  perform public._require_staff();
  if not public.has_role('system_admin') then
    raise exception 'only a System Admin may import a price list' using errcode = '42501';
  end if;

  for v_row in select value from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb)) loop
    v_code := btrim(coalesce(v_row->>'code', ''));
    v_price := nullif(v_row->>'purchase_price', '')::numeric;
    if v_code = '' or v_price is null or v_price < 0 then
      v_skipped := v_skipped + 1;
      continue;
    end if;
    update public.raw_materials set purchase_price = v_price where code = v_code;
    if found then
      v_applied := v_applied + 1;
    else
      v_skipped := v_skipped + 1;
      v_missing := v_missing || v_code;
    end if;
  end loop;

  perform public._audit('import_raw_material_prices', 'raw_materials',
    'batch-' || to_char(now(), 'YYYY-MM-DD"T"HH24:MI:SS'),
    null,
    jsonb_build_object('applied', v_applied, 'skipped', v_skipped, 'missing', to_jsonb(v_missing)));

  return jsonb_build_object('applied', v_applied, 'skipped', v_skipped,
                            'missing', to_jsonb(v_missing));
end;
$$;

grant execute on function public.import_raw_material_prices(jsonb) to authenticated;
