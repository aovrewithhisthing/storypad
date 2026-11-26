-- Phase P1: Security Audit Logs, Active Session Listing/Revocation RPCs
-- Target project: pwhrfuxwhydjiqfgjnts
-- Run manually in Supabase SQL Editor after P0 migration.

-- 1. Security Audit Log Table
CREATE TABLE IF NOT EXISTS public.security_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (char_length(trim(event_type)) BETWEEN 2 AND 80),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'failure', 'blocked')),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_user_created
  ON public.security_audit_logs (user_id, created_at DESC);

ALTER TABLE public.security_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own security audit logs" ON public.security_audit_logs;
CREATE POLICY "Users can view own security audit logs"
  ON public.security_audit_logs
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Ensure no direct INSERT/UPDATE/DELETE from client roles; writes go via RPC.
REVOKE INSERT, UPDATE, DELETE ON public.security_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.security_audit_logs TO authenticated;

-- 2. RPC: Append sanitized security audit event for current authenticated user
CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type text,
  p_status text DEFAULT 'success',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_status text;
  v_event text;
  v_safe_meta jsonb := '{}'::jsonb;
  v_rec record;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to record security audit events'
      USING ERRCODE = '42501';
  END IF;

  v_event := regexp_replace(lower(trim(coalesce(p_event_type, ''))), '[^a-z0-9_.:-]', '_', 'g');
  IF char_length(v_event) < 2 OR char_length(v_event) > 80 THEN
    RAISE EXCEPTION 'Invalid security event type'
      USING ERRCODE = '22023';
  END IF;

  v_status := lower(trim(coalesce(p_status, 'success')));
  IF v_status NOT IN ('success', 'failure', 'blocked') THEN
    v_status := 'success';
  END IF;

  -- Defense-in-depth: strip any sensitive credential/token keys from metadata.
  IF p_metadata IS NOT NULL AND jsonb_typeof(p_metadata) = 'object' THEN
    FOR v_rec IN SELECT key, value FROM jsonb_each(p_metadata) LOOP
      IF lower(v_rec.key) !~ '(password|passphrase|secret|token|authorization|cookie|credential|hmac|jwt)' THEN
        v_safe_meta := v_safe_meta || jsonb_build_object(left(v_rec.key, 48), v_rec.value);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.security_audit_logs (user_id, event_type, status, metadata)
  VALUES (v_uid, v_event, v_status, v_safe_meta)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.log_security_event(text, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.log_security_event(text, text, jsonb) TO authenticated;

-- 3. RPC: List active auth.sessions for current authenticated user only
CREATE OR REPLACE FUNCTION public.get_my_sessions()
RETURNS TABLE (
  session_id uuid,
  created_at timestamptz,
  updated_at timestamptz,
  refreshed_at timestamptz,
  not_after timestamptz,
  user_agent text,
  ip_masked text,
  aal text,
  is_current boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_current_session_id uuid;
  v_claims_raw text;
  v_session_claim text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to inspect active sessions'
      USING ERRCODE = '42501';
  END IF;

  v_claims_raw := current_setting('request.jwt.claims', true);
  IF v_claims_raw IS NOT NULL AND v_claims_raw <> '' THEN
    v_session_claim := nullif(trim(coalesce(v_claims_raw::jsonb ->> 'session_id', '')), '');
    IF v_session_claim IS NOT NULL AND v_session_claim ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_current_session_id := v_session_claim::uuid;
    END IF;
  END IF;

  RETURN QUERY
  SELECT
    s.id AS session_id,
    s.created_at,
    s.updated_at,
    s.refreshed_at::timestamptz,
    s.not_after,
    left(coalesce(s.user_agent, ''), 300) AS user_agent,
    CASE
      WHEN s.ip IS NULL THEN 'IP tidak tercatat'
      WHEN family(s.ip) = 4 THEN regexp_replace(host(s.ip), '\.\d+$', '.xxx')
      ELSE regexp_replace(host(s.ip), ':[0-9a-fA-F:]+$', ':xxxx')
    END AS ip_masked,
    coalesce(s.aal::text, 'aal1') AS aal,
    (v_current_session_id IS NOT NULL AND s.id = v_current_session_id) AS is_current
  FROM auth.sessions s
  WHERE s.user_id = v_uid
    AND (s.not_after IS NULL OR s.not_after > now())
  ORDER BY
    (v_current_session_id IS NOT NULL AND s.id = v_current_session_id) DESC,
    coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_sessions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_sessions() TO authenticated;

-- 4. RPC: Revoke one owned session from auth.sessions and record audit log
CREATE OR REPLACE FUNCTION public.revoke_my_session(p_session_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_deleted_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required to revoke sessions'
      USING ERRCODE = '42501';
  END IF;

  IF p_session_id IS NULL THEN
    RETURN false;
  END IF;

  DELETE FROM auth.sessions
  WHERE id = p_session_id
    AND user_id = v_uid
  RETURNING id INTO v_deleted_id;

  IF v_deleted_id IS NULL THEN
    RETURN false;
  END IF;

  INSERT INTO public.security_audit_logs (user_id, event_type, status, metadata)
  VALUES (
    v_uid,
    'session_revoked',
    'success',
    jsonb_build_object('revoked_session_id', left(v_deleted_id::text, 8))
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.revoke_my_session(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_my_session(uuid) TO authenticated;
