-- Accent-insensitive client name matching.
--
-- Today "Rocio" doesn't find "Rocío", "Francois" doesn't find "François", and "Muller" doesn't find
-- "Müller". That's how name duplicates get created: the receptionist searches, finds nothing and
-- makes a new client.
--
-- Names stay stored exactly as typed. This adds three READ-ONLY, database-maintained columns with a
-- "folded" copy of the name (lower-case, accents and foreign letters replaced by their plain
-- Spanish-keyboard spelling, extra spaces removed), which search and matching use instead:
--
--   client_name_folded        "  Rocío " -> "rocio"
--   client_surname_folded     "Müller"   -> "muller"
--   client_full_name_folded   name + " " + surname -> "rocio sotomayor"  (so "rocio soto" finds her)
--
-- They're GENERATED columns: Postgres recomputes them on every insert/update, the app never writes
-- them, and they can't drift from the real name.
--
-- Run each STEP on its own and compare with the expected result.

-- STEP 1: the unaccent extension and the folding function.
-- unaccent goes in the "extensions" schema like the other Supabase extensions. fold_text() calls it
-- through the two-argument form with an explicit dictionary, which is what lets Postgres accept the
-- function as IMMUTABLE (required for generated columns and indexes).
CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.fold_text(value text)
RETURNS text
LANGUAGE sql
IMMUTABLE PARALLEL SAFE STRICT
SET search_path = ''
AS $$
  SELECT btrim(regexp_replace(
    lower(extensions.unaccent('extensions.unaccent'::regdictionary, value)),
    '\s+', ' ', 'g'))
$$;


-- STEP 2 (read-only): check the folding. Expected one row:
--   rocio | francois | muller | strasse | oystein | lukasz | aesir | pena ruiz | jose maria
SELECT public.fold_text('Rocío')       AS a,
       public.fold_text('François')    AS b,
       public.fold_text('Müller')      AS c,
       public.fold_text('Straße')      AS d,
       public.fold_text('Øystein')     AS e,
       public.fold_text('Łukasz')      AS f,
       public.fold_text('Æsir')        AS g,
       public.fold_text('  Peña   Ruiz ') AS h,
       public.fold_text('JOSÉ MARÍA')  AS i;


-- STEP 3: the folded columns and a trigram index for "contains" searches on the full name.
-- Rewrites the clients table once (about 3,300 rows, takes a moment). The change-log trigger lists
-- its columns explicitly, so it is unaffected.
ALTER TABLE public.clients
  ADD COLUMN client_name_folded text
    GENERATED ALWAYS AS (public.fold_text(client_name)) STORED,
  ADD COLUMN client_surname_folded text
    GENERATED ALWAYS AS (public.fold_text(client_surname)) STORED,
  ADD COLUMN client_full_name_folded text
    GENERATED ALWAYS AS (public.fold_text(coalesce(client_name, '') || ' ' || coalesce(client_surname, ''))) STORED;

CREATE INDEX clients_full_name_folded_trgm
  ON public.clients USING gin (client_full_name_folded gin_trgm_ops);


-- STEP 4 (read-only): check the data. Expected:
--   rows_without_full = 0
--   rocio_spellings   = 3 ("Rocio", "Rocío" and "rocío": 17 active clients, all found by one search)
SELECT
  (SELECT count(*) FROM public.clients WHERE client_full_name_folded IS NULL) AS rows_without_full,
  (SELECT count(DISTINCT btrim(client_name)) FROM public.clients
    WHERE deleted_at IS NULL AND client_name_folded = 'rocio') AS rocio_spellings;


-- UNDO (only if something goes wrong):
-- DROP INDEX IF EXISTS public.clients_full_name_folded_trgm;
-- ALTER TABLE public.clients
--   DROP COLUMN IF EXISTS client_full_name_folded,
--   DROP COLUMN IF EXISTS client_surname_folded,
--   DROP COLUMN IF EXISTS client_name_folded;
-- DROP FUNCTION IF EXISTS public.fold_text(text);
-- DROP EXTENSION IF EXISTS unaccent;
