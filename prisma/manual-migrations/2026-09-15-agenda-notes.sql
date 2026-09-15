-- Agenda: short day-scoped notes, shown on a calendar page and surfaced in a top bar.
--
-- Modelled closely on `guidelines` (content + target_roles + author + soft delete), because the
-- shape is the same and reusing it keeps the API and dialog patterns familiar. Two deliberate
-- differences, both explained below.


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 1 — The table
-- ─────────────────────────────────────────────────────────────────────────────
-- note_date is DATE, not timestamptz, on purpose. A note belongs to a CALENDAR DAY
-- ("the boiler engineer comes on the 17th"), not to an instant. Storing an instant would drag
-- the whole Europe/Madrid conversion problem into a feature that has no business caring about
-- it — the same class of bug that produced the backdated-voucher code clash. With DATE there is
-- nothing to convert: the day the receptionist picks is the day that is stored, and "today's
-- notes" is one comparison against today's Madrid date computed in the app.

CREATE TABLE IF NOT EXISTS public.agenda_notes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_date    date        NOT NULL,
  content      text        NOT NULL,
  target_roles text[]      NOT NULL DEFAULT '{}',
  author_id    uuid        NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  deleted_at   timestamptz
);

-- The only hot query: "active notes for this day (or this month)". Partial, because every read
-- filters deleted_at IS NULL.
CREATE INDEX IF NOT EXISTS agenda_notes_date_idx
  ON public.agenda_notes (note_date)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.agenda_notes.note_date IS
  'Business calendar day the note is for. DATE, not a timestamp: no timezone conversion applies.';
COMMENT ON COLUMN public.agenda_notes.target_roles IS
  'Roles the note is addressed to (admin / receptionist / therapist). Visibility is enforced in the API.';


-- ─────────────────────────────────────────────────────────────────────────────
-- STEP 2 — Row level security
-- ─────────────────────────────────────────────────────────────────────────────
-- Matching how the rest of the schema is set up. The app connects through Prisma with a role
-- that bypasses RLS, so this is defence in depth rather than the primary control — visibility is
-- enforced in the API route, as it is for guidelines.

ALTER TABLE public.agenda_notes ENABLE ROW LEVEL SECURITY;


-- ─────────────────────────────────────────────────────────────────────────────
-- Deliberately NOT included
-- ─────────────────────────────────────────────────────────────────────────────
-- * No history/audit table. `guidelines` has none either, and these notes carry no money and no
--   client data — the audit work we did was scoped to payments, vouchers and redemptions.
-- * No title column. Several notes per day plus a one-line ticker reads better as content-only;
--   a title would compete with the content for the little space the bar has. Easy to add later.
-- * No unique constraint on note_date — several notes per day is intended.


-- ─────────────────────────────────────────────────────────────────────────────
-- Verify
-- ─────────────────────────────────────────────────────────────────────────────
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'agenda_notes'
ORDER BY ordinal_position;
