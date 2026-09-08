-- COSMETIC ONLY. Renames the change-attribution columns in the three remaining log/history
-- tables so every table follows one rule with no exceptions:
--
--   Live tables            performed_by  = who did the thing this row represents
--   History/log tables     changed_by / changed_at = who changed the record, and when
--
-- (changed_by / changed_at also pair with the change_type column every history table already has.)
--
-- This adds no new facts. Its one real payoff: a payment_events_log row currently holds TWO
-- different values called performed_by, meaning two different people —
--
--     SELECT performed_by,               -- who made this change
--            new_data->>'performed_by'   -- who performed the payment event
--     FROM payment_events_log;
--
-- — in the table you reach for first when tracing a payment mistake. After this, the column is
-- changed_by and the JSON key stays performed_by, so they can never be confused again.
--
-- Applied SEPARATELY from the functional migration on purpose: if payments misbehave after this,
-- you know with certainty that this was the cause, and reverting is just renaming back.


-- ─────────────────────────────────────────────────────────────────────────────
-- WHAT IS AND ISN'T AT RISK
-- ─────────────────────────────────────────────────────────────────────────────
-- Postgres stores views, indexes, constraints and RLS policies as PARSED TREES that reference
-- columns by internal id, so a RENAME propagates to all of them automatically — nothing to do.
--
-- plpgsql function bodies are stored as TEXT and are never reparsed. They are the ENTIRE risk
-- surface: a function still naming the old column keeps compiling and fails at RUNTIME. Since
-- these are triggers on the money path, a missed one means every payment write starts failing.
--
-- Which is why STEP 2 renames and replaces the functions in ONE transaction — there is no window
-- in which a trigger references a column that no longer exists.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Find every function that mentions these column names
-- ─────────────────────────────────────────────────────────────────────────────

SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~ 'performed_(by|at)'
ORDER BY 1, 2;

-- Expect six hits. ONLY THREE OF THEM CHANGE. Read this table before editing anything:
--
--   CHANGE   log_payments_changes         — names payments_log.performed_by in 3 INSERTs
--                                           (performed_at comes from the column DEFAULT)
--   CHANGE   log_payment_events_changes   — names payment_events_log.performed_by in 3 INSERTs
--                                           (performed_at comes from the column DEFAULT)
--   CHANGE   log_voucher_changes          — names BOTH vouchers_history.performed_at and
--                                           performed_by, in a single INSERT
--
--   LEAVE    log_voucher_uses_changes     — already uses changed_by/changed_at (migration 1).
--                                           Its performed_by line copies voucher_uses.performed_by
--                                           (whose redemption it was) and MUST stay as it is.
--   LEAVE    register_payment_event       — p_performed_by writes payment_events.performed_by,
--                                           a LIVE table column that keeps its name.
--   LEAVE    register_voucher_use         — p_performed_by writes voucher_uses.performed_by, ditto.
--
-- The distinction that matters: rename the columns of the three LOG tables. Never touch a
-- NEW./OLD./p_ reference that reads or writes a LIVE table's performed_by.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Nothing to hand-edit
-- ─────────────────────────────────────────────────────────────────────────────
-- All three replacements are written out in full in STEP 2, reproduced from their current
-- definitions (attributes included) with only the column names changed. Nothing to dump, copy
-- or retype — which removes the two ways this step could go wrong: dropping an attribute on
-- CREATE OR REPLACE, and missing one of the repeated occurrences.
--
-- The three functions are NOT alike, which is why they had to be handled individually:
--
--   log_payments_changes        3 INSERTs (DELETE/UPDATE/INSERT branches), each naming
--   log_payment_events_changes  performed_by — three occurrences per function. NEITHER names
--                               performed_at: that column is filled by its own DEFAULT now(),
--                               and a DEFAULT follows the column through a rename automatically.
--                               So performed_at needs no function change at all here.
--                               Both carry SECURITY DEFINER.
--
--   log_voucher_changes         1 INSERT, naming BOTH performed_at and performed_by explicitly
--                               (it passes now() itself). Has NO SECURITY DEFINER.
--
-- Leave the `user_id` local variable alone in all three: it is a plpgsql variable, not a column,
-- and its name is unrelated to this rename.
--
-- If you would rather verify against the live definitions before running STEP 2:
--
--   SELECT pg_get_functiondef(p.oid)
--   FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--   WHERE n.nspname = 'public'
--     AND p.proname IN ('log_payments_changes','log_payment_events_changes','log_voucher_changes');


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Rename and replace, atomically
-- ─────────────────────────────────────────────────────────────────────────────
-- Run the whole block as ONE transaction. If any statement fails, nothing applies and the
-- database is untouched — no half-renamed state, no broken trigger.

BEGIN;

ALTER TABLE public.payments_log        RENAME COLUMN performed_at TO changed_at;
ALTER TABLE public.payments_log        RENAME COLUMN performed_by TO changed_by;

ALTER TABLE public.payment_events_log  RENAME COLUMN performed_at TO changed_at;
ALTER TABLE public.payment_events_log  RENAME COLUMN performed_by TO changed_by;

ALTER TABLE public.vouchers_history    RENAME COLUMN performed_at TO changed_at;
ALTER TABLE public.vouchers_history    RENAME COLUMN performed_by TO changed_by;

-- Two of the three are ready to run as-is: identical to their current definitions (attributes
-- included) with performed_by -> changed_by in each of the three INSERT column lists.

CREATE OR REPLACE FUNCTION public.log_payments_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  user_id uuid := coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid());
begin
  if tg_op = 'DELETE' then
    insert into public.payments_log(payment_id, change_type, old_data, changed_by)
    values (old.id, 'DELETE', to_jsonb(old), user_id);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.payments_log(payment_id, change_type, old_data, new_data, changed_by)
    values (new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), user_id);
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.payments_log(payment_id, change_type, new_data, changed_by)
    values (new.id, 'INSERT', to_jsonb(new), user_id);
    return new;
  end if;
  return null;
end;
$function$;

CREATE OR REPLACE FUNCTION public.log_payment_events_changes()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
declare
  user_id uuid := coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid());
begin
  if tg_op = 'DELETE' then
    insert into public.payment_events_log(payment_event_id, change_type, old_data, changed_by)
    values (old.id, 'DELETE', to_jsonb(old), user_id);
    return old;
  elsif tg_op = 'UPDATE' then
    insert into public.payment_events_log(payment_event_id, change_type, old_data, new_data, changed_by)
    values (new.id, 'UPDATE', to_jsonb(old), to_jsonb(new), user_id);
    return new;
  elsif tg_op = 'INSERT' then
    insert into public.payment_events_log(payment_event_id, change_type, new_data, changed_by)
    values (new.id, 'INSERT', to_jsonb(new), user_id);
    return new;
  end if;
  return null;
end;
$function$;

-- Note: this one has NO SECURITY DEFINER, unlike the two above. That is reproduced faithfully
-- from its current definition — do not "helpfully" add it here.

CREATE OR REPLACE FUNCTION public.log_voucher_changes()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  INSERT INTO public.vouchers_history (
    id,
    voucher_id,
    buyer_id,
    recipient_id,
    code,
    balance,
    notes,
    source,
    external_reference,
    created_at,
    updated_at,
    expiration_date,
    deleted_at,
    change_type,
    changed_at,
    changed_by
  )
  VALUES (
    gen_random_uuid(),
    COALESCE(NEW.id, OLD.id),
    COALESCE(NEW.buyer_id, OLD.buyer_id),
    COALESCE(NEW.recipient_id, OLD.recipient_id),
    COALESCE(NEW.code, OLD.code),
    COALESCE(NEW.balance, OLD.balance),
    COALESCE(NEW.notes, OLD.notes),
    COALESCE(NEW.source, OLD.source),
    COALESCE(NEW.external_reference, OLD.external_reference),
    COALESCE(NEW.created_at, OLD.created_at),
    COALESCE(NEW.updated_at, OLD.updated_at),
    COALESCE(NEW.expiration_date, OLD.expiration_date),
    COALESCE(NEW.deleted_at, OLD.deleted_at),
    TG_OP::change_type,
    now(),
    coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
  );

  RETURN NULL;
END;$function$;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Verify
-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. No function anywhere still writes the renamed columns. This should return ONLY
--     log_voucher_uses_changes, register_payment_event and register_voucher_use — the three
--     that legitimately reference a LIVE table's performed_by.

SELECT n.nspname, p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname NOT IN ('pg_catalog', 'information_schema')
  AND p.prokind = 'f'
  AND pg_get_functiondef(p.oid) ~ 'performed_(by|at)'
ORDER BY 1, 2;

-- 3b. Columns landed, and the live tables kept theirs:

SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name IN ('performed_at', 'performed_by', 'changed_at', 'changed_by')
ORDER BY table_name, column_name;

-- Expected final state:
--   payment_events         performed_by                          (live — kept)
--   payment_events_log     changed_at, changed_by                (renamed)
--   payments_log           changed_at, changed_by                (renamed)
--   voucher_uses           performed_by                          (live — kept)
--   voucher_uses_history   changed_at, changed_by, performed_by  (both — by design)
--   vouchers_history       changed_at, changed_by                (renamed)

-- 3c. THE TEST THAT ACTUALLY MATTERS — the triggers still fire. Do this in the app immediately,
--     because a broken trigger only shows up at runtime:
--       1. Add a payment to a booking          -> exercises log_payments_changes + log_payment_events_changes
--       2. Pay a booking with a voucher        -> exercises log_voucher_changes + log_voucher_uses_changes
--     Both must succeed, and each should leave a row with a populated changed_by:

SELECT 'payment_events_log' AS src, change_type::text, changed_at, changed_by FROM public.payment_events_log ORDER BY changed_at DESC LIMIT 3;
SELECT 'vouchers_history'   AS src, change_type::text, changed_at, changed_by FROM public.vouchers_history   ORDER BY changed_at DESC LIMIT 3;


-- ─────────────────────────────────────────────────────────────────────────────
-- ROLLBACK, if needed
-- ─────────────────────────────────────────────────────────────────────────────
-- Rename the six columns back and re-apply the three original function definitions you dumped in
-- STEP 1 (keep that output until you have verified 3c). Nothing else is affected — no application
-- code reads these tables.
