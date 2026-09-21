-- "Amend" support for submittable documents that post to the general ledger
-- (capital_contributions, capital_withdrawals, and — later — any other GL
-- document). The ledger stays append-only: nobody ever edits or deletes a
-- posted row. Instead, "editing" a submitted document is:
--   1. reverse_gl(voucher_no)  — flip its still-active GL rows to
--      is_cancelled = true, so trial_balance / account balances stop
--      counting them immediately (both the `trial_balance` RPC, 0015, and the
--      client `trialBalance()` reducer already filter on `is_cancelled`).
--   2. cancel_document(...)    — existing RPC, flips doc_status 1 -> 2.
--   3. a new linked Draft       — existing `createDraft` + `amended_from`
--      plumbing, already wired client-side.
-- This migration adds only the missing first step.

set check_function_bodies = off;

create or replace function public.reverse_gl(p_voucher_no text, p_reason text)
  returns jsonb
  language plpgsql security definer set search_path = public as $$
declare
  v_reason text := nullif(btrim(coalesce(p_reason, '')), '');
  v_count int;
begin
  perform public._require_staff();
  if not (public.has_role('chief_accountant') or public.has_role('system_admin')) then
    raise exception 'only the chief accountant or system admin may reverse a GL posting'
      using errcode = '42501';
  end if;
  if p_voucher_no is null or btrim(p_voucher_no) = '' then
    raise exception 'voucherNo is required' using errcode = '22023';
  end if;
  if v_reason is null then
    raise exception 'a reason is required to reverse a GL posting' using errcode = '22023';
  end if;

  update public.general_ledger_entries
    set is_cancelled = true
    where voucher_no = p_voucher_no
      and not coalesce(is_cancelled, false);
  get diagnostics v_count = row_count;

  if v_count > 0 then
    perform public._audit('reverse_gl', 'general_ledger_entries', p_voucher_no,
      jsonb_build_object('is_cancelled', false),
      jsonb_build_object('is_cancelled', true, 'entries', v_count, 'reason', v_reason));
  end if;

  return jsonb_build_object('voucherNo', p_voucher_no, 'reversed', v_count);
end;
$$;

revoke all on function public.reverse_gl(text, text) from public;
grant execute on function public.reverse_gl(text, text) to authenticated;
