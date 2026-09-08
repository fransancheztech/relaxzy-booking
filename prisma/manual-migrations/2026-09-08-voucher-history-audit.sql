-- Give vouchers_history a real audit trail: WHEN a voucher change happened and WHO made it.
--
-- Why: vouchers_history only mirrors the voucher's own columns, so it has no independent record
-- of when a change occurred. `vouchers.created_at` is app-supplied (the receptionist picks the
-- sale date) and `vouchers.updated_at` is clobbered by the balance UPDATE that runs right after
-- creation and by every later redemption. Result: today there is no way to answer "who created
-- this voucher, and when was it actually keyed in?".
--
-- This mirrors the performed_at / performed_by pair that payment_events_log already has, and
-- reuses the transaction-local GUC pattern from 2026-07-08-performed-by-audit.sql (auth.uid()
-- is always NULL under Prisma's pooled connection, so the app must pass the user explicitly).


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Verify the trigger actually fires on INSERT (run this FIRST)
-- ─────────────────────────────────────────────────────────────────────────────
-- The whole point is auditing voucher *creation*. If trigger_log_voucher_changes only fires on
-- UPDATE/DELETE, no history row is written at creation and the new columns won't help.
-- Expect to see INSERT OR UPDATE OR DELETE in the definition.

SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.vouchers'::regclass
  AND NOT tgisinternal;

-- If INSERT is missing, recreate the trigger to include it, e.g.:
--   DROP TRIGGER IF EXISTS trigger_log_voucher_changes ON public.vouchers;
--   CREATE TRIGGER trigger_log_voucher_changes
--     AFTER INSERT OR UPDATE OR DELETE ON public.vouchers
--     FOR EACH ROW EXECUTE FUNCTION public.log_voucher_changes();


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Add the two columns
-- ─────────────────────────────────────────────────────────────────────────────
-- Deliberately TWO statements. `ADD COLUMN ... DEFAULT now()` would backfill every existing
-- history row with the migration timestamp — a lie about when those changes happened. Adding
-- the column bare leaves old rows NULL (honestly "unknown, predates this column"), and the
-- separate SET DEFAULT then applies to new rows only.

ALTER TABLE public.vouchers_history
  ADD COLUMN IF NOT EXISTS performed_at timestamptz,
  ADD COLUMN IF NOT EXISTS performed_by uuid;

ALTER TABLE public.vouchers_history
  ALTER COLUMN performed_at SET DEFAULT now();

-- Both stay NULLABLE: performed_at because old rows are genuinely unknown, performed_by because
-- a change can legitimately have no attributable user (a direct SQL fix, a future cron job).
-- The trigger below always supplies performed_at, so the DEFAULT is only a safety net for any
-- other insert path into this table.

-- Optional but recommended — you trace by "what happened recently", and this table only grows:
CREATE INDEX IF NOT EXISTS vouchers_history_performed_at_idx
  ON public.vouchers_history (performed_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — IN-PLACE EDIT to log_voucher_changes()
-- ─────────────────────────────────────────────────────────────────────────────
-- ┌────────────────────────────────────────────────────────────────────────────┐
-- │ Keep the function's existing header and attributes exactly as they are —    │
-- │ LANGUAGE plpgsql, RETURNS trigger, and any SECURITY DEFINER / SET           │
-- │ search_path. CREATE OR REPLACE rewrites the WHOLE definition, so anything   │
-- │ you omit is silently lost (SECURITY DEFINER would revert to INVOKER).       │
-- │ Change ONLY the two spots below, then re-run its CREATE OR REPLACE.         │
-- │                                                                             │
-- │ The trigger itself needs NO change — it stays bound across a REPLACE.       │
-- └────────────────────────────────────────────────────────────────────────────┘
--
-- 2a. In the INSERT column list, add two columns after `change_type`:
--
--         expiration_date,
--         deleted_at,
--         change_type,
--         performed_at,      -- <-- add
--         performed_by       -- <-- add
--       )
--
-- 2b. In the VALUES list, add the two matching values after `TG_OP::change_type`:
--
--         COALESCE(NEW.expiration_date, OLD.expiration_date),
--         COALESCE(NEW.deleted_at, OLD.deleted_at),
--         TG_OP::change_type,
--         now(),                                                                    -- <-- add
--         coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())  -- <-- add
--       );
--
-- Notes on those two values:
--   * now() is the real wall-clock moment the row changed — independent of the app-supplied
--     vouchers.created_at, which is the business *sale* date the receptionist may back-date.
--   * The performed_by expression is the same one already used by log_payments_changes and
--     log_payment_events_changes: prefer the transaction-local GUC the app sets, and fall back
--     to auth.uid() for changes made directly in Supabase with an authenticated session.
--     current_setting(..., true) returns NULL rather than erroring when the GUC is unset, so
--     this can never break a voucher write.
--
-- For reference, the resulting body (header intentionally omitted — keep yours):
--
--   BEGIN
--     INSERT INTO public.vouchers_history (
--       id, voucher_id, buyer_id, recipient_id, code, balance, notes, source,
--       external_reference, created_at, updated_at, expiration_date, deleted_at, change_type,
--       performed_at, performed_by
--     )
--     VALUES (
--       gen_random_uuid(),
--       COALESCE(NEW.id, OLD.id),
--       COALESCE(NEW.buyer_id, OLD.buyer_id),
--       COALESCE(NEW.recipient_id, OLD.recipient_id),
--       COALESCE(NEW.code, OLD.code),
--       COALESCE(NEW.balance, OLD.balance),
--       COALESCE(NEW.notes, OLD.notes),
--       COALESCE(NEW.source, OLD.source),
--       COALESCE(NEW.external_reference, OLD.external_reference),
--       COALESCE(NEW.created_at, OLD.created_at),
--       COALESCE(NEW.updated_at, OLD.updated_at),
--       COALESCE(NEW.expiration_date, OLD.expiration_date),
--       COALESCE(NEW.deleted_at, OLD.deleted_at),
--       TG_OP::change_type,
--       now(),
--       coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())
--     );
--
--     RETURN NULL;
--   END;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Verify
-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Columns exist, nullable, with the default on performed_at only:

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'vouchers_history'
  AND column_name IN ('performed_at', 'performed_by');

-- 3b. Smoke test: create a voucher in the app, then confirm a fresh history row appears with a
--     populated performed_at. performed_by stays NULL until the app-side follow-ups below ship.

SELECT voucher_id, code, change_type, performed_at, performed_by, created_at
FROM public.vouchers_history
ORDER BY performed_at DESC NULLS LAST
LIMIT 5;


-- ─────────────────────────────────────────────────────────────────────────────
-- APP-SIDE FOLLOW-UPS (after `prisma db pull` + `prisma generate`)
-- ─────────────────────────────────────────────────────────────────────────────
-- performed_at works immediately. performed_by needs each voucher write path to set the GUC
-- inside its transaction, exactly like the payments/bookings routes already do:
--
--     await tx.$queryRaw`SELECT set_config('app.user_id', ${performed_by ?? ""}, true)`;
--
-- Paths that write to vouchers and currently set NO GUC:
--   * src/app/api/vouchers/new/route.ts:213   — create (+ the balance update at :238)
--   * src/app/api/vouchers/[id]/route.ts:87   — edit, already inside a $transaction
--   * src/app/api/vouchers/[id]/route.ts:166  — bare prisma.vouchers.update, NOT in a
--       transaction. set_config(..., true) is transaction-local, so this one must be wrapped
--       in a prisma.$transaction first or the GUC will not reach the trigger.
--   * src/lib/recalculateVoucherBalance.ts:25 — receives `tx`; the caller must set the GUC.
