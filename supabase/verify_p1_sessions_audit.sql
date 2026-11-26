-- Non-destructive P1 verification script for StoryPad Sessions, Audit Logs & Ownership Isolation
-- Run in Supabase SQL Editor; wrapped in BEGIN ... ROLLBACK so zero test data persists.

BEGIN;

DO $$
DECLARE
  v_user_a uuid := 'aaaaaaaa-1111-4111-8111-111111111111';
  v_user_b uuid := 'bbbbbbbb-2222-4222-8222-222222222222';
  v_sess_a1 uuid := '11111111-aaaa-4aaa-8aaa-111111111111';
  v_sess_a2 uuid := '22222222-aaaa-4aaa-8aaa-222222222222';
  v_sess_b1 uuid := '33333333-bbbb-4bbb-8bbb-333333333333';
  v_count int;
  v_revoked boolean;
  v_meta jsonb;
  v_log_id uuid;
BEGIN
  -- 1. Seed isolated users in auth.users
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p1-user-a@example.test', 'x', now(), now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'p1-user-b@example.test', 'x', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  -- 2. Seed synthetic sessions for User A (2 sessions) and User B (1 session)
  INSERT INTO auth.sessions (id, user_id, created_at, updated_at, user_agent, ip, aal)
  VALUES
    (v_sess_a1, v_user_a, now() - interval '2 hours', now(), 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/131.0.0.0', '203.0.113.42'::inet, 'aal1'),
    (v_sess_a2, v_user_a, now() - interval '1 hour', now(), 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1', '198.51.100.19'::inet, 'aal1'),
    (v_sess_b1, v_user_b, now(), now(), 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Firefox/132.0', '192.0.2.88'::inet, 'aal1')
  ON CONFLICT (id) DO NOTHING;

  -- 3. Verify anon cannot call get_my_sessions
  PERFORM set_config('role', 'anon', true);
  PERFORM set_config('request.jwt.claims', '{}', true);
  BEGIN
    PERFORM * FROM public.get_my_sessions();
    RAISE EXCEPTION 'Expected anon get_my_sessions to fail';
  EXCEPTION WHEN insufficient_privilege OR SQLSTATE '42501' THEN
    -- expected
  END;

  -- 4. Verify User A sees ONLY User A sessions, with current flag and masked IP
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_a::text, 'role', 'authenticated', 'session_id', v_sess_a1::text)::text,
    true
  );

  SELECT count(*) INTO v_count FROM public.get_my_sessions();
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'Expected User A to see 2 sessions, saw %', v_count;
  END IF;

  PERFORM 1 FROM public.get_my_sessions()
   WHERE session_id = v_sess_a1 AND is_current = true AND ip_masked = '203.0.113.xxx';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Expected current session flag and masked IP for v_sess_a1';
  END IF;

  -- 5. Verify User A cannot revoke User B session
  SELECT public.revoke_my_session(v_sess_b1) INTO v_revoked;
  IF v_revoked IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Cross-tenant session revocation must return false';
  END IF;

  -- 6. Verify User A can revoke own secondary session v_sess_a2
  SELECT public.revoke_my_session(v_sess_a2) INTO v_revoked;
  IF v_revoked IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Owner session revocation should return true';
  END IF;

  -- 7. Verify log_security_event strips sensitive keys (password/token/secret)
  SELECT public.log_security_event(
    'login_success',
    'success',
    '{"method":"password","password":"leak","access_token":"secret","safe_note":"ok"}'::jsonb
  ) INTO v_log_id;

  SELECT metadata INTO v_meta FROM public.security_audit_logs WHERE id = v_log_id;
  IF v_meta ? 'password' OR v_meta ? 'access_token' OR (v_meta ->> 'safe_note') <> 'ok' THEN
    RAISE EXCEPTION 'Metadata sanitization failed: %', v_meta;
  END IF;

  -- 8. Verify User B cannot read User A security_audit_logs via RLS
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', v_user_b::text, 'role', 'authenticated', 'session_id', v_sess_b1::text)::text,
    true
  );

  SELECT count(*) INTO v_count FROM public.security_audit_logs WHERE user_id = v_user_a;
  IF v_count <> 0 THEN
    RAISE EXCEPTION 'RLS leak: User B saw % audit rows of User A', v_count;
  END IF;

  RAISE NOTICE 'P1 verification passed: session isolation, masked IP, cross-tenant revocation block, metadata stripping, and audit RLS verified.';
END $$;

ROLLBACK;
