-- Fix audit-log attribution (performed_by) for payments and payment_events.
--
-- Problem: log_payments_changes / log_payment_events_changes set
--   performed_by := auth.uid()
-- which is NULL for writes made over the app's Prisma (pooled) connection — so
-- payments_log and payment_events_log never recorded WHO made a change.
--
-- Fix: carry the acting user through a transaction-local GUC (app.user_id) that
-- the triggers read, falling back to auth.uid(). register_payment_event sets it
-- from its p_performed_by argument (already the real user via getCurrentUserId),
-- so every proc-driven write — payment create, refund, voucher purchase &
-- redemption — is attributed automatically. Direct-Prisma writes (the remove-event
-- route, and the upcoming payment-date edit) set the same GUC in their own
-- transaction; that part lives in the app code (done after this migration).
--
-- Scope: only these two triggers were broken. voucher_uses_history already copies
-- the row's performed_by (COALESCE(NEW.performed_by, OLD.performed_by)); vouchers_history
-- and every other entity have no performed_by, so they are out of scope.
--
-- ┌──────────────────────────────────────────────────────────────────────────────┐
-- │ BEFORE RUNNING — verify security clauses.                                      │
-- │ If your current definitions are SECURITY DEFINER and/or have SET search_path,  │
-- │ KEEP them: add those same clauses to the headers below (and to your            │
-- │ register_payment_event when you re-deploy it). In Supabase you can see this in │
-- │ the function editor (the "Security" / "definer" setting), or via:              │
-- │   SELECT proname, prosecdef, proconfig FROM pg_proc                            │
-- │   WHERE proname IN ('register_payment_event','log_payments_changes',           │
-- │                     'log_payment_events_changes');                             │
-- │ (prosecdef = true means SECURITY DEFINER.)                                     │
-- └──────────────────────────────────────────────────────────────────────────────┘


-- 1) register_payment_event — IN-PLACE EDIT (kept as an instruction so your exact
--    argument list, defaults, and security clause are preserved).
--    Add this single line as the FIRST statement after BEGIN, then re-run your
--    existing CREATE OR REPLACE FUNCTION register_payment_event(...) unchanged
--    except for this line:
--
--        PERFORM set_config('app.user_id', COALESCE(p_performed_by::text, ''), true);
--
--    It must sit before the INSERT/UPDATE statements so the triggers on the
--    payments INSERT/UPDATE and the payment_events INSERT can read the value.


-- 2) log_payments_changes — read app.user_id, fall back to auth.uid().
CREATE OR REPLACE FUNCTION public.log_payments_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  user_id uuid := coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid());
begin
  if tg_op = 'DELETE' then
    insert into public.payments_log(payment_id, change_type, old_data, performed_by)
    values (old.id, 'DELETE', to_jsonb(old), user_id);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.payments_log(payment_id, change_type, old_data, new_data, performed_by)
    values (new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), user_id);
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.payments_log(payment_id, change_type, new_data, performed_by)
    values (new.id, 'INSERT', to_jsonb(new), user_id);
    return new;
  end if;
  return null;
end;
$$;


-- 3) log_payment_events_changes — same change.
CREATE OR REPLACE FUNCTION public.log_payment_events_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
declare
  user_id uuid := coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid());
begin
  if tg_op = 'DELETE' then
    insert into public.payment_events_log(payment_event_id, change_type, old_data, performed_by)
    values (old.id, 'DELETE', to_jsonb(old), user_id);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.payment_events_log(payment_event_id, change_type, old_data, new_data, performed_by)
    values (new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), user_id);
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.payment_events_log(payment_event_id, change_type, new_data, performed_by)
    values (new.id, 'INSERT', to_jsonb(new), user_id);
    return new;
  end if;
  return null;
end;
$$;
