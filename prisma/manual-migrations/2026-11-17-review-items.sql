-- The old-data review page: one row per data problem found, and what the reviewer decided about it.
--
-- A temporary, admin-only page (see plans/2026-11-17-old-data-review-page.md). It starts with three
-- client checks (missing accents, surname typed in the name field, clients with no activity). Later
-- the scan, booking-note and voucher checks add their own kinds to the same table.
--
--   kind + item_key   what was found and its stable identity (e.g. the client id). Unique together,
--                     so running a check again updates its rows instead of duplicating them.
--   details           what was found: the current values and the evidence.
--   proposal          the suggested change, if there is one.
--   status            open, decided, or deferred ("ask Chalida", "look at it later").
--   decision          what the reviewer chose, e.g. {"action": "keep"}.
--   applied_at        when the real data was brought in line with the decision.
--
-- client_id, booking_id and voucher_id have no foreign keys on purpose, so the core models don't get
-- relation fields for a temporary table.
--
-- Same protection as client_duplicate_dismissals: RLS on with no policies, and no access for
-- anon/authenticated. Only the app (through Prisma, as postgres) reads or writes it.
--
-- When the cleanup is over: DROP TABLE public.review_items;
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate` (new table, so a new Prisma model).
-- Changes no existing data.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Precondition (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect NULL. If not, this file has already been applied.
SELECT to_regclass('public.review_items') AS review_items_table;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE public.review_items (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kind          text        NOT NULL,
  item_key      text        NOT NULL,
  source        text        NOT NULL,
  business_date date,
  client_id     uuid,
  booking_id    uuid,
  voucher_id    uuid,
  details       jsonb       NOT NULL DEFAULT '{}'::jsonb,
  proposal      jsonb,
  status        text        NOT NULL DEFAULT 'open',
  decision      jsonb,
  note          text,
  decided_by    uuid,
  decided_at    timestamptz,
  applied_at    timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT review_items_kind_key_unique UNIQUE (kind, item_key),
  CONSTRAINT review_items_status_check    CHECK (status IN ('open', 'decided', 'deferred')),
  CONSTRAINT review_items_decision_check  CHECK (status <> 'decided' OR (decision IS NOT NULL AND decided_at IS NOT NULL)),
  CONSTRAINT review_items_applied_check   CHECK (applied_at IS NULL OR status = 'decided')
);

-- The unique constraint already indexes (kind, item_key), which also serves "all items of a kind".
CREATE INDEX review_items_kind_status_idx   ON public.review_items (kind, status);
CREATE INDEX review_items_business_date_idx ON public.review_items (business_date) WHERE business_date IS NOT NULL;
CREATE INDEX review_items_client_idx        ON public.review_items (client_id)     WHERE client_id IS NOT NULL;
CREATE INDEX review_items_booking_idx       ON public.review_items (booking_id)    WHERE booking_id IS NOT NULL;
CREATE INDEX review_items_voucher_idx       ON public.review_items (voucher_id)    WHERE voucher_id IS NOT NULL;

ALTER TABLE public.review_items ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.review_items FROM anon, authenticated;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: review_items, rls_on = true, anon_can_read = false, authenticated_can_read = false.
SELECT to_regclass('public.review_items')                                   AS review_items_table,
       (SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.review_items'::regclass)                       AS rls_on,
       has_table_privilege('anon', 'public.review_items', 'SELECT')          AS anon_can_read,
       has_table_privilege('authenticated', 'public.review_items', 'SELECT') AS authenticated_can_read;
