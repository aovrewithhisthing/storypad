-- StoryPad P0 RLS & Role Non-Escalation Verification Script
-- Non-destructive: wrapped in BEGIN; ... ROLLBACK;

BEGIN;

-- 1. Verify anon sees 0 rows on all tables
SET LOCAL role anon;
DO $$
DECLARE
  v_cnt int;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.projects;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % rows in projects', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.crew_profiles;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % rows in crew_profiles', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.script_lines;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % rows in script_lines', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.takes;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % rows in takes', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.notifications;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: anon saw % rows in notifications', v_cnt; END IF;
  RAISE NOTICE 'PASS [1/4]: anon role sees 0 rows across all 5 tables';
END $$;

-- 2. Verify User A (25569f84-ddad-40ae-ace0-aebc9c86d9b7) sees own data and cannot escalate ungranted roles
SET LOCAL role authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"25569f84-ddad-40ae-ace0-aebc9c86d9b7","role":"authenticated"}', true);

DO $$
DECLARE
  v_cnt int;
  v_escalated boolean := false;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.projects WHERE is_archived = false;
  IF v_cnt < 1 THEN
    RAISE EXCEPTION 'FAIL: User A expected >= 1 active project, got %', v_cnt;
  END IF;

  BEGIN
    UPDATE public.crew_profiles
    SET roles = jsonb_set(roles, '{directorProducer}', 'true'::jsonb)
    WHERE user_id = '25569f84-ddad-40ae-ace0-aebc9c86d9b7';
    v_escalated := true;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_escalated := false;
  END;

  IF v_escalated THEN
    RAISE EXCEPTION 'FAIL: User A was able to escalate ungranted directorProducer role';
  END IF;
  RAISE NOTICE 'PASS [2/4]: User A accesses own projects and role escalation rejected with 42501';
END $$;

-- 3. Verify User B (different UUID) sees 0 rows of User A and cannot mutate User A project
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","role":"authenticated"}', true);

DO $$
DECLARE
  v_cnt int;
  v_updated int;
BEGIN
  SELECT count(*) INTO v_cnt FROM public.projects;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: User B saw % projects belonging to User A', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.script_lines;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: User B saw % script_lines belonging to User A', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.takes;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: User B saw % takes belonging to User A', v_cnt; END IF;
  SELECT count(*) INTO v_cnt FROM public.crew_profiles;
  IF v_cnt <> 0 THEN RAISE EXCEPTION 'FAIL: User B saw % crew_profiles belonging to User A', v_cnt; END IF;

  UPDATE public.projects SET is_archived = true WHERE id = 'proj-jadi';
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> 0 THEN
    RAISE EXCEPTION 'FAIL: User B modified % rows of User A project', v_updated;
  END IF;
  RAISE NOTICE 'PASS [3/4]: Cross-account isolation verified (User B sees 0 rows and 0 updates allowed)';
END $$;

-- 4. Verify storage bucket storypad-media is private
RESET ROLE;
DO $$
DECLARE
  v_public boolean;
BEGIN
  SELECT public INTO v_public FROM storage.buckets WHERE id = 'storypad-media';
  IF v_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'FAIL: storage bucket storypad-media is still public=%', v_public;
  END IF;
  RAISE NOTICE 'PASS [4/4]: storage.buckets.storypad-media is private (public=false)';
END $$;

ROLLBACK;
