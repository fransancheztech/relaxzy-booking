-- Remember "these two clients are different people", so a reviewed pair stops being suggested.
--
-- For the new "Possible phone typos" section of /clients/duplicates: pairs of clients whose phone
-- numbers differ by a single digit and whose names are compatible (Bruno Pantoja +34629256170 vs
-- Bruno +34629250170). Most are one person with a mistyped number and get merged. Some are two real
-- people — e.g. a couple on consecutive lines — and for those nothing changes in the data, so the
-- pair would be suggested again on every visit. This table records the reviewer's decision.
--
-- Keyed by the two CLIENTS, not their numbers: "these are different people" is a statement about
-- people, and should survive either of them changing their phone later. One row per pair, stored
-- in a fixed order (client_a < client_b) so the same pair can't be dismissed twice in reverse.
--
-- Same protection as client_merges: RLS on with no policies, and no access for anon/authenticated —
-- only the app (through Prisma, as postgres) reads or writes it.
--
-- AFTER RUNNING: `npx prisma db pull` + `npx prisma generate` (new table → new Prisma model).
-- Changes no existing data.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 0 — Precondition (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect NULL. If not, this file has already been applied.
SELECT to_regclass('public.client_duplicate_dismissals') AS dismissals_table;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — Install
-- ─────────────────────────────────────────────────────────────────────────────
BEGIN;

CREATE TABLE public.client_duplicate_dismissals (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  client_a      uuid        NOT NULL REFERENCES public.clients (id),
  client_b      uuid        NOT NULL REFERENCES public.clients (id),
  dismissed_by  uuid,
  dismissed_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT client_duplicate_dismissals_ordered CHECK (client_a < client_b),
  CONSTRAINT client_duplicate_dismissals_pair_unique UNIQUE (client_a, client_b)
);

-- The unique constraint already indexes client_a first; this covers lookups by the second client.
CREATE INDEX client_duplicate_dismissals_client_b_idx ON public.client_duplicate_dismissals (client_b);

ALTER TABLE public.client_duplicate_dismissals ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_duplicate_dismissals FROM anon, authenticated;

COMMIT;


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Confirm (read-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect: the table name, rls_on = true, anon_can_read = false.
SELECT to_regclass('public.client_duplicate_dismissals')                                   AS dismissals_table,
       (SELECT relrowsecurity FROM pg_class
         WHERE oid = 'public.client_duplicate_dismissals'::regclass)                       AS rls_on,
       has_table_privilege('anon', 'public.client_duplicate_dismissals', 'SELECT')         AS anon_can_read;
