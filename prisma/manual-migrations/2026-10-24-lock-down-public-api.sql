-- Close the database to the public Supabase API.
--
-- THE PROBLEM
-- The anon key is public by design: it ships in the browser bundle so the login page can talk to
-- Supabase Auth. But with it, anyone can call the Supabase REST API (PostgREST) directly, and today:
--   * four tables have an "Allow all" policy for every role, so anyone with the key can READ AND
--     WRITE them: clients, bookings, bookings_history, therapists (a probe on 2026-10-19 read
--     3,247 clients and 8,055 bookings with the anon key alone);
--   * register_payment_event and register_voucher_use are SECURITY DEFINER and executable by
--     anyone, so anyone can create payments or spend voucher balance through /rest/v1/rpc/...;
--   * any logged-in user (including therapists) has the same access with their own session.
--
-- WHY IT IS SAFE TO CLOSE
-- The app never uses that API for data. Every page goes page → /api route → Prisma, and Prisma
-- connects as "postgres" (table owner, bypasses RLS), which none of this touches. The Supabase
-- clients in the code use the anon key only for login/session, and the live-update streams use the
-- service_role key, which keeps its access. The one route that read a table through Supabase
-- (/api/therapists/list, unused) now reads through Prisma — deploy that change before running this.
--
-- WHAT THIS DOES (roles "anon" = not logged in, "authenticated" = logged in through Supabase)
--   1. drops the four "Allow all" policies (RLS stays ON everywhere; with no policy, no rows);
--   2. revokes every table/view privilege from anon and authenticated (defence in depth);
--   3. revokes EXECUTE on the app's own functions from PUBLIC, anon and authenticated
--      (postgres, prisma and service_role keep it);
--   4. changes the default privileges so tables and functions created later aren't exposed again.
--
-- Run each STEP on its own and compare with the expected result.

-- STEP 0 (read-only): the exposure today. Expected, as checked on 24/10/2026:
--   allow_all_policies = 4 | exposed_tables = 27 | exposed_functions = 15 | exposed_definer_functions = 4
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS allow_all_policies,
  (SELECT count(DISTINCT table_name) FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')) AS exposed_tables,
  (SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS exposed_functions,
  (SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS exposed_definer_functions;


-- STEP 1: the lock-down, in one transaction (all or nothing).
BEGIN;

-- 1. The four policies that let every role read and write.
DROP POLICY IF EXISTS "Allow all in clients"          ON public.clients;
DROP POLICY IF EXISTS "Allow all in bookings"         ON public.bookings;
DROP POLICY IF EXISTS "Allow all in bookings_history" ON public.bookings_history;
DROP POLICY IF EXISTS "Allow all in therapists"       ON public.therapists;

-- 2. No table or view access at all for the public API roles.
REVOKE ALL ON ALL TABLES    IN SCHEMA public FROM anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon, authenticated;

-- 3. The app's own functions (not the pg_trgm extension's): no EXECUTE for PUBLIC, anon or
--    authenticated. Trigger functions keep working: EXECUTE isn't checked when a trigger fires,
--    and every write comes from postgres anyway.
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
  END LOOP;
END $$;

-- 4. Objects created later by postgres (every migration so far) start closed too.
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES    FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

COMMIT;


-- STEP 2 (read-only): expected 0 | 0 | 0 | 0, and the app's own access intact:
--   postgres_can_pay = true | prisma_can_pay = true | service_role_reads_bookings = true
SELECT
  (SELECT count(*) FROM pg_policies WHERE schemaname = 'public') AS allow_all_policies,
  (SELECT count(DISTINCT table_name) FROM information_schema.role_table_grants
    WHERE table_schema = 'public' AND grantee IN ('anon', 'authenticated')) AS exposed_tables,
  (SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prokind IN ('f', 'p')
      AND NOT EXISTS (SELECT 1 FROM pg_depend d WHERE d.objid = p.oid AND d.deptype = 'e')
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
           OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))) AS exposed_functions,
  (SELECT count(*) FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND has_function_privilege('anon', p.oid, 'EXECUTE')) AS exposed_definer_functions,
  has_function_privilege('postgres', 'public.register_payment_event(payment_types, numeric, payment_methods, uuid, text, uuid, uuid)', 'EXECUTE') AS postgres_can_pay,
  has_function_privilege('prisma',   'public.register_payment_event(payment_types, numeric, payment_methods, uuid, text, uuid, uuid)', 'EXECUTE') AS prisma_can_pay,
  has_table_privilege('service_role', 'public.bookings', 'SELECT') AS service_role_reads_bookings;


-- UNDO (only if something breaks; restores the previous, open state):
-- BEGIN;
-- CREATE POLICY "Allow all in clients"          ON public.clients          FOR ALL TO public USING (true);
-- CREATE POLICY "Allow all in bookings"         ON public.bookings         FOR ALL TO public USING (true);
-- CREATE POLICY "Allow all in bookings_history" ON public.bookings_history FOR ALL TO public USING (true);
-- CREATE POLICY "Allow all in therapists"       ON public.therapists       FOR ALL TO public USING (true);
-- GRANT ALL ON ALL TABLES    IN SCHEMA public TO anon, authenticated;
-- GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;
-- GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.merge_clients(uuid, uuid[], jsonb, uuid) FROM PUBLIC, anon, authenticated;
-- REVOKE EXECUTE ON FUNCTION public.unmerge_clients(uuid, uuid)             FROM PUBLIC, anon, authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES    TO anon, authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated;
-- ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO PUBLIC, anon, authenticated;
-- COMMIT;
