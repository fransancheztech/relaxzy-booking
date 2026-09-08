-- Give voucher_uses_history change-attribution: WHO made each change, and WHEN.
--
-- The problem: this table mirrors the redemption's own columns and nothing else. Its performed_by
-- is a COPY of voucher_uses.performed_by — who performed the redemption — because the trigger
-- writes COALESCE(NEW.performed_by, OLD.performed_by). Nobody edits that column when a redemption
-- is removed, so the history row recording the removal names the ORIGINAL REDEEMER.
--
-- That is worse than a NULL. A NULL says "unknown"; this confidently names an innocent person as
-- the one who deleted the redemption — in exactly the field you would trust while investigating.
--
-- Deliberately NOT reusing performed_by for the actor. This is a column-copy history table, and
-- performed_by is one of those copies (like amount or code). Repurposing it would (a) lose "whose
-- redemption was this" on update rows, and (b) silently give every row written before this
-- migration a different meaning from every row written after, with nothing to tell them apart.
-- Two new columns keep both facts, unambiguously:
--
--   performed_by  ->  who performed the redemption   (copied from the row, unchanged)
--   changed_by    ->  who made THIS change           (new)
--   changed_at    ->  when THIS change happened      (new)
--
-- Naming: changed_by / changed_at pair with the change_type column this table already has.
-- The other log tables still call their actor column performed_by. A separate, purely cosmetic
-- migration renames those for consistency — this one is functional only, and is the one that
-- matters. Apply and verify this before going near the rename.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Confirm the trigger fires on all three operations (run this FIRST)
-- ─────────────────────────────────────────────────────────────────────────────
-- Removals are soft deletes, so the row that records one arrives as an UPDATE (deleted_at set),
-- not a DELETE. UPDATE coverage is therefore the one that actually matters here.

SELECT tgname, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.voucher_uses'::regclass
  AND NOT tgisinternal;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Add the columns
-- ─────────────────────────────────────────────────────────────────────────────
-- Two statements on purpose. `ADD COLUMN ... DEFAULT now()` backfills every existing row with the
-- migration timestamp — a lie about when those changes happened. Adding the column bare leaves
-- old rows NULL (honestly "unknown, predates this column"), and the separate SET DEFAULT then
-- applies to new rows only.
--
-- A NULL changed_at doubles as the marker for "row written under the old semantics", which is
-- what lets you filter out the historically misattributed rows later.

ALTER TABLE public.voucher_uses_history
  ADD COLUMN IF NOT EXISTS changed_at timestamptz,
  ADD COLUMN IF NOT EXISTS changed_by uuid;

ALTER TABLE public.voucher_uses_history
  ALTER COLUMN changed_at SET DEFAULT now();

-- Both stay NULLABLE: changed_at because old rows are genuinely unknown, changed_by because a
-- change can legitimately have no attributable user (a direct SQL fix, a future job).

-- Optional but recommended — "what happened recently" is the tracing query, and this table grows:
CREATE INDEX IF NOT EXISTS voucher_uses_history_changed_at_idx
  ON public.voucher_uses_history (changed_at DESC);


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — IN-PLACE EDIT to log_voucher_uses_changes()
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
-- IMPORTANT: leave the existing performed_by line exactly as it is. It is doing the right job —
-- copying whose redemption this was. The new columns sit alongside it.
--
-- 2a. In the INSERT column list, add two columns after `change_type`:
--
--         performed_by,
--         deleted_at,
--         change_type,
--         changed_at,        -- <-- add
--         changed_by         -- <-- add
--       )
--
-- 2b. In the VALUES list, add the two matching values after `TG_OP::change_type`:
--
--         COALESCE(NEW.performed_by, OLD.performed_by),   -- unchanged: who redeemed it
--         COALESCE(NEW.deleted_at, OLD.deleted_at),
--         TG_OP::change_type,
--         now(),                                                                       -- <-- add
--         coalesce(nullif(current_setting('app.user_id', true), '')::uuid, auth.uid())  -- <-- add
--       );
--
-- The changed_by expression is the same one already used by log_payments_changes,
-- log_payment_events_changes and log_voucher_changes: prefer the transaction-local GUC the app
-- sets, fall back to auth.uid() for changes made directly in Supabase with an authenticated
-- session. current_setting(..., true) returns NULL rather than erroring when the GUC is unset,
-- so this can never break a voucher redemption or a booking payment.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 3 — Verify
-- ─────────────────────────────────────────────────────────────────────────────
-- 3a. Columns exist, nullable, default on changed_at only:

SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'voucher_uses_history'
  AND column_name IN ('changed_at', 'changed_by', 'performed_by');

-- 3b. The real test — the two must differ. In the app:
--       1. Pay a booking with a voucher as user A  (creates the redemption)
--       2. Remove that redemption from Manage payments as user B
--     Then the removal row should show performed_by = A and changed_by = B.

SELECT voucher_event_id, change_type, deleted_at, performed_by, changed_by, changed_at
FROM public.voucher_uses_history
ORDER BY changed_at DESC NULLS LAST
LIMIT 10;

-- 3c. Same run also confirms the app-side fix that shipped with this migration:
--     /api/bookings/[id]/payment now sets app.user_id, so the vouchers_history row written by
--     register_voucher_use's balance update is attributed instead of NULL.

SELECT voucher_id, change_type, performed_at, performed_by
FROM public.vouchers_history
ORDER BY performed_at DESC NULLS LAST
LIMIT 10;
