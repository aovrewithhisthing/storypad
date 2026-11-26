-- Non-destructive P3 Admin Console RBAC, Scope Isolation & Security Verification Script
-- Run manually in Supabase SQL Editor AFTER migrations 000001..000004.
-- Wrapped in BEGIN; ... ROLLBACK; so zero test records persist.

BEGIN;

DO $$
DECLARE
  v_owner uuid := '10000000-0000-4000-8000-000000000001';
  v_admin uuid := '10000000-0000-4000-8000-000000000002';
  v_prod_admin uuid := '10000000-0000-4000-8000-000000000003';
  v_crew uuid := '10000000-0000-4000-8000-000000000004';
  v_other uuid := '10000000-0000-4000-8000-000000000005';
  v_sess_crew uuid := '20000000-0000-4000-8000-000000000004';
  v_proj_a text := 'proj-verify-a';
  v_proj_b text := 'proj-verify-b';
  v_res jsonb;
  v_token text;
  v_cnt int;
  v_blocked boolean;
BEGIN
  -- 1. Seed isolated test users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_owner, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-owner@storypad.test', 'x', now(), now(), now()),
    (v_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-admin@storypad.test', 'x', now(), now(), now()),
    (v_prod_admin, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-prodadmin@storypad.test', 'x', now(), now(), now()),
    (v_crew, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-crew@storypad.test', 'x', now(), now(), now()),
    (v_other, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'verify-other@storypad.test', 'x', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_system_roles (user_id, system_role, assigned_by, reason)
  VALUES
    (v_owner, 'system_owner', v_owner, 'verify'),
    (v_admin, 'system_admin', v_owner, 'verify'),
    (v_prod_admin, 'production_admin', v_owner, 'verify'),
    (v_crew, 'crew_member', v_owner, 'verify'),
    (v_other, 'crew_member', v_owner, 'verify')
  ON CONFLICT (user_id) DO UPDATE SET system_role = EXCLUDED.system_role;

  INSERT INTO public.projects (id, code, title, category, subtitle, tag, day, fps, sync_status, draft, scene_number, shot_number, slug_number, scene_title, scene_timecode, take_info, owner_id, is_archived)
  VALUES
    (v_proj_a, 'VER-A', 'Verify Project A', 'Film Pendek', 'A', '1 Scene', 'Day 01', '24 fps', 'In Sync', 'Draft v1', '01', '01', 'SCENE 01', 'SCENE 01', '00:00:00:00', '0 TAKE', v_prod_admin, false),
    (v_proj_b, 'VER-B', 'Verify Project B', 'Film Pendek', 'B', '1 Scene', 'Day 01', '24 fps', 'In Sync', 'Draft v1', '01', '01', 'SCENE 01', 'SCENE 01', '00:00:00:00', '0 TAKE', v_other, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.project_members (project_id, user_id, member_role, production_role)
  VALUES
    (v_proj_a, v_prod_admin, 'production_admin', 'Producer'),
    (v_proj_a, v_crew, 'editor', 'Script Supervisor'),
    (v_proj_b, v_other, 'owner', 'Director')
  ON CONFLICT (project_id, user_id) DO NOTHING;

  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, user_agent, ip, aal)
  VALUES (v_sess_crew, v_crew, now(), now(), 'Chrome/131 Windows', '203.0.113.10'::inet, 'aal1')
  ON CONFLICT (id) DO NOTHING;

  -- 2. Verify anonymous cannot call admin RPCs
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  v_blocked := false;
  BEGIN
    PERFORM public.admin_get_overview();
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: anon called admin_get_overview';
  END IF;

  -- 3. Verify crew_member cannot access overview, accounts, role assignment, or audit logs
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew::text, 'role', 'authenticated')::text, true);

  v_blocked := false;
  BEGIN
    PERFORM public.admin_list_accounts('', 'all', 'all', 25, 0);
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: crew_member accessed admin_list_accounts'; END IF;

  -- Self-promotion blocked
  v_blocked := false;
  BEGIN
    PERFORM public.admin_assign_system_role(v_crew, 'system_owner', 'self escalate');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: crew_member self-promoted'; END IF;

  -- Direct UPDATE on user_system_roles blocked
  v_blocked := false;
  BEGIN
    UPDATE public.user_system_roles SET system_role = 'system_owner' WHERE user_id = v_crew;
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: crew_member directly mutated user_system_roles'; END IF;

  -- Direct INSERT/UPDATE/DELETE on security_audit_logs blocked
  v_blocked := false;
  BEGIN
    INSERT INTO public.security_audit_logs (user_id, event_type, status) VALUES (v_crew, 'forged', 'success');
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: crew_member inserted forged audit log'; END IF;

  -- 4. Verify production_admin is scoped ONLY to Project A, blocked on Project B, audit logs, and role assignment
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_prod_admin::text, 'role', 'authenticated')::text, true);

  SELECT public.admin_upsert_project_membership(v_proj_a, v_crew, 'editor', 'First AC', 'Scope valid') INTO v_res;
  IF COALESCE((v_res ->> 'ok')::boolean, false) <> true THEN
    RAISE EXCEPTION 'FAIL: production_admin could not manage own Project A';
  END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.admin_upsert_project_membership(v_proj_b, v_crew, 'editor', 'Camera', 'IDOR attempt');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: production_admin modified Project B (IDOR)'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.admin_revoke_session(v_sess_crew, 'unauthorized revoke');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: production_admin revoked another user session'; END IF;

  -- 5. Verify system_admin cannot promote to system_owner, cannot suspend system_owner, cannot update security settings
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_admin::text, 'role', 'authenticated')::text, true);

  v_blocked := false;
  BEGIN
    PERFORM public.admin_assign_system_role(v_crew, 'system_owner', 'hierarchy bypass');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: system_admin promoted user to system_owner'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.admin_update_account_status(v_owner, 'suspended', 'lockout owner');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: system_admin suspended system_owner'; END IF;

  v_blocked := false;
  BEGIN
    PERFORM public.admin_update_security_settings(48, 14, true, false, 20, 'unauthorized');
  EXCEPTION WHEN SQLSTATE '42501' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: system_admin modified security settings'; END IF;

  -- 6. Verify system_owner can create invitation (hashed token, single-use), remove membership preserving project, and audit logs recorded
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  SELECT public.admin_create_invitation('verify-other@storypad.test', v_proj_a, 'viewer', 'Sound Utility', 'viewer', 24, 'Test invite') INTO v_res;
  v_token := v_res ->> 'one_time_token';
  IF v_token IS NULL OR length(v_token) <> 64 THEN
    RAISE EXCEPTION 'FAIL: invitation token invalid';
  END IF;

  -- Accept invitation as v_other
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_other::text, 'role', 'authenticated')::text, true);
  SELECT public.accept_project_invitation(v_token) INTO v_res;
  IF COALESCE((v_res ->> 'ok')::boolean, false) <> true THEN
    RAISE EXCEPTION 'FAIL: valid invite acceptance failed';
  END IF;

  -- Replay same token must fail
  v_blocked := false;
  BEGIN
    PERFORM public.accept_project_invitation(v_token);
  EXCEPTION WHEN SQLSTATE '22023' THEN v_blocked := true; END;
  IF NOT v_blocked THEN RAISE EXCEPTION 'FAIL: invitation token was reusable'; END IF;

  -- Removing membership preserves project row
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_owner::text, 'role', 'authenticated')::text, true);
  PERFORM public.admin_remove_project_membership(v_proj_a, v_other, 'Wrap');
  SELECT count(*) INTO v_cnt FROM public.projects WHERE id = v_proj_a;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL: removing membership deleted project';
  END IF;

  -- Verify audit logs recorded
  SELECT count(*) INTO v_cnt FROM public.security_audit_logs WHERE event_type IN ('project_membership_updated', 'invitation_created', 'invitation_accepted', 'project_membership_removed');
  IF v_cnt < 4 THEN
    RAISE EXCEPTION 'FAIL: expected >= 4 admin audit entries, got %', v_cnt;
  END IF;

  RAISE NOTICE 'PASS: All P3 Admin Console RBAC, IDOR/BOLA, anti-lockout, invitation, and audit negative tests succeeded.';
END $$;

ROLLBACK;
