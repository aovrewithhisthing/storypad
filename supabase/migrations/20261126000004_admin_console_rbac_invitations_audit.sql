-- StoryPad Phase P3 Migration: Admin Console RBAC, Account Status, Project Memberships, Invitations, Audit & Security Settings
-- Apply manually via Supabase SQL Editor or `supabase db push` AFTER migrations 000001, 000002, and 000003.
-- Idempotent and safe across repeated runs. Zero hardcoded admin credentials.

-- 0. Ensure required private schema & pgcrypto extension
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 1. Account Status on public.crew_profiles (never trust client-writable metadata)
ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS status_reason text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS status_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS status_updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE public.crew_profiles
  DROP CONSTRAINT IF EXISTS crew_profiles_account_status_check;

ALTER TABLE public.crew_profiles
  ADD CONSTRAINT crew_profiles_account_status_check
  CHECK (account_status IN ('active', 'suspended', 'deactivated'));

CREATE INDEX IF NOT EXISTS idx_crew_profiles_account_status
  ON public.crew_profiles (account_status)
  WHERE is_archived = false;

-- 2. System Roles & Granular Permissions (strictly separated from Production Roles)
CREATE TABLE IF NOT EXISTS public.system_roles (
  role_key text PRIMARY KEY,
  display_name text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global', 'project')),
  rank integer NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.system_roles ENABLE ROW LEVEL SECURITY;

INSERT INTO public.system_roles (role_key, display_name, scope, rank, description) VALUES
  ('system_owner', 'System Owner', 'global', 100, 'Pemilik sistem dan pengaturan keamanan kritis. Jumlah dibatasi.'),
  ('system_admin', 'System Admin', 'global', 80, 'Mengelola akun, sesi, audit, dan keanggotaan lintas proyek sesuai izin.'),
  ('production_admin', 'Production Admin', 'project', 50, 'Mengelola anggota dan undangan hanya pada proyek yang menjadi cakupannya.'),
  ('crew_member', 'Crew Member', 'project', 20, 'Kru produksi lapangan yang mengakses proyek sesuai keanggotaan.'),
  ('viewer', 'Viewer', 'project', 10, 'Akses baca pada proyek dan resource yang diizinkan secara eksplisit.')
ON CONFLICT (role_key) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  scope = EXCLUDED.scope,
  rank = EXCLUDED.rank,
  description = EXCLUDED.description;

CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_key text NOT NULL REFERENCES public.system_roles(role_key) ON DELETE CASCADE,
  permission_key text NOT NULL,
  scope text NOT NULL CHECK (scope IN ('global', 'project', 'self')),
  description text NOT NULL DEFAULT '',
  PRIMARY KEY (role_key, permission_key)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

DELETE FROM public.role_permissions
WHERE role_key IN ('system_owner', 'system_admin', 'production_admin', 'crew_member', 'viewer');

INSERT INTO public.role_permissions (role_key, permission_key, scope, description) VALUES
  -- System Owner (full system control)
  ('system_owner', 'accounts.read', 'global', 'Melihat daftar dan detail seluruh akun'),
  ('system_owner', 'accounts.update_profile', 'global', 'Memperbarui profil kru yang diizinkan'),
  ('system_owner', 'accounts.update_status', 'global', 'Mengaktifkan, menangguhkan, atau menonaktifkan akun'),
  ('system_owner', 'accounts.invite', 'global', 'Mengundang anggota ke proyek atau sistem'),
  ('system_owner', 'accounts.manage_membership', 'global', 'Mengelola keanggotaan akun pada proyek'),
  ('system_owner', 'roles.read', 'global', 'Melihat daftar role dan matriks permission'),
  ('system_owner', 'roles.assign', 'global', 'Menetapkan atau mencabut system role'),
  ('system_owner', 'sessions.read_own', 'self', 'Melihat sesi perangkat milik sendiri'),
  ('system_owner', 'sessions.revoke_own', 'self', 'Mencabut sesi perangkat milik sendiri'),
  ('system_owner', 'sessions.read_all', 'global', 'Melihat sesi aktif pengguna lintas akun'),
  ('system_owner', 'sessions.revoke_user_sessions', 'global', 'Mencabut sesi aktif akun lain'),
  ('system_owner', 'audit.read', 'global', 'Membaca log audit administratif dan keamanan'),
  ('system_owner', 'projects.manage_members', 'global', 'Mengelola anggota pada semua proyek'),
  ('system_owner', 'security.read', 'global', 'Melihat kebijakan dan postur keamanan aplikasi'),
  ('system_owner', 'security.manage', 'global', 'Mengubah kebijakan keamanan yang dikelola aplikasi'),

  -- System Admin (global ops except security.manage and owner role assignment)
  ('system_admin', 'accounts.read', 'global', 'Melihat daftar dan detail akun'),
  ('system_admin', 'accounts.update_profile', 'global', 'Memperbarui profil kru yang diizinkan'),
  ('system_admin', 'accounts.update_status', 'global', 'Menangguhkan atau mengaktifkan akun di bawah System Owner'),
  ('system_admin', 'accounts.invite', 'global', 'Mengundang anggota ke proyek'),
  ('system_admin', 'accounts.manage_membership', 'global', 'Mengelola keanggotaan akun pada proyek'),
  ('system_admin', 'roles.read', 'global', 'Melihat daftar role dan matriks permission'),
  ('system_admin', 'roles.assign', 'global', 'Menetapkan role di bawah level System Admin'),
  ('system_admin', 'sessions.read_own', 'self', 'Melihat sesi perangkat milik sendiri'),
  ('system_admin', 'sessions.revoke_own', 'self', 'Mencabut sesi perangkat milik sendiri'),
  ('system_admin', 'sessions.read_all', 'global', 'Melihat sesi aktif akun di bawah System Owner'),
  ('system_admin', 'sessions.revoke_user_sessions', 'global', 'Mencabut sesi aktif akun di bawah System Owner'),
  ('system_admin', 'audit.read', 'global', 'Membaca log audit administratif dan keamanan'),
  ('system_admin', 'projects.manage_members', 'global', 'Mengelola anggota pada proyek'),
  ('system_admin', 'security.read', 'global', 'Melihat ringkasan kebijakan keamanan aplikasi'),

  -- Production Admin (strictly scoped to own/managed projects)
  ('production_admin', 'accounts.read', 'project', 'Melihat detail dasar anggota pada proyek cakupannya'),
  ('production_admin', 'accounts.invite', 'project', 'Mengundang kru ke proyek yang dikelolanya'),
  ('production_admin', 'roles.read', 'project', 'Melihat daftar role dan permission'),
  ('production_admin', 'projects.manage_members', 'project', 'Mengelola keanggotaan hanya pada proyek miliknya'),
  ('production_admin', 'sessions.read_own', 'self', 'Melihat sesi perangkat milik sendiri'),
  ('production_admin', 'sessions.revoke_own', 'self', 'Mencabut sesi perangkat milik sendiri'),

  -- Crew Member & Viewer (self session management only)
  ('crew_member', 'sessions.read_own', 'self', 'Melihat sesi perangkat milik sendiri'),
  ('crew_member', 'sessions.revoke_own', 'self', 'Mencabut sesi perangkat milik sendiri'),
  ('viewer', 'sessions.read_own', 'self', 'Melihat sesi perangkat milik sendiri'),
  ('viewer', 'sessions.revoke_own', 'self', 'Mencabut sesi perangkat milik sendiri');

CREATE TABLE IF NOT EXISTS public.user_system_roles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  system_role text NOT NULL DEFAULT 'crew_member' REFERENCES public.system_roles(role_key),
  assigned_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at timestamptz NOT NULL DEFAULT now(),
  reason text NOT NULL DEFAULT ''
);

ALTER TABLE public.user_system_roles ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_user_system_roles_role ON public.user_system_roles (system_role);

-- Backfill crew_member rows for existing auth users that do not yet have a system role row.
-- Note: Existing is_studio_admin = true users map to system_admin (never auto-granted system_owner).
INSERT INTO public.user_system_roles (user_id, system_role, reason)
SELECT
  u.id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.crew_profiles cp
      WHERE cp.user_id = u.id AND cp.is_studio_admin = true AND cp.is_archived = false
    ) THEN 'system_admin'
    ELSE 'crew_member'
  END,
  'Migrasi awal role sistem'
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_system_roles usr WHERE usr.user_id = u.id
);

-- 3. Separate Production Role on public.project_members
ALTER TABLE public.project_members
  ADD COLUMN IF NOT EXISTS production_role text NOT NULL DEFAULT 'Crew Member';

ALTER TABLE public.project_members
  DROP CONSTRAINT IF EXISTS project_members_member_role_check;

ALTER TABLE public.project_members
  ADD CONSTRAINT project_members_member_role_check
  CHECK (member_role IN ('owner', 'production_admin', 'editor', 'viewer'));

-- 4. Invitations table (one-time SHA-256 hashed tokens, project & role scoped)
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  project_id text REFERENCES public.projects(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'editor' CHECK (member_role IN ('production_admin', 'editor', 'viewer')),
  production_role text NOT NULL DEFAULT 'Crew Member',
  target_system_role text NOT NULL DEFAULT 'crew_member' CHECK (target_system_role IN ('system_admin', 'production_admin', 'crew_member', 'viewer')),
  token_hash text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text NOT NULL DEFAULT '',
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_project_invitations_email_status ON public.project_invitations (lower(email), status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_project_status ON public.project_invitations (project_id, status);
CREATE INDEX IF NOT EXISTS idx_project_invitations_expires ON public.project_invitations (expires_at);

-- 5. Audit Log extensions on public.security_audit_logs
ALTER TABLE public.security_audit_logs
  ADD COLUMN IF NOT EXISTS actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS target_type text NOT NULL DEFAULT 'account',
  ADD COLUMN IF NOT EXISTS target_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS reason text NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS idx_security_audit_logs_created_desc ON public.security_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_actor_created ON public.security_audit_logs (actor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_logs_event_created ON public.security_audit_logs (event_type, created_at DESC);

-- Ensure client roles can never directly insert/update/delete audit logs
REVOKE INSERT, UPDATE, DELETE ON public.security_audit_logs FROM anon, authenticated;
GRANT SELECT ON public.security_audit_logs TO authenticated;

-- 6. App-Managed Security Settings singleton
CREATE TABLE IF NOT EXISTS public.admin_security_settings (
  id integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  invitation_expiry_hours integer NOT NULL DEFAULT 72 CHECK (invitation_expiry_hours BETWEEN 1 AND 720),
  min_password_length integer NOT NULL DEFAULT 12 CHECK (min_password_length BETWEEN 12 AND 64),
  require_reauth_role_change boolean NOT NULL DEFAULT true,
  allow_crew_self_signup boolean NOT NULL DEFAULT true,
  session_idle_minutes integer NOT NULL DEFAULT 30 CHECK (session_idle_minutes BETWEEN 5 AND 480),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.admin_security_settings ENABLE ROW LEVEL SECURITY;
INSERT INTO public.admin_security_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- 7. Revoke direct client writes on RBAC, Invitations, and Security Settings
REVOKE INSERT, UPDATE, DELETE ON public.system_roles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.role_permissions FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.user_system_roles FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.project_invitations FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.admin_security_settings FROM anon, authenticated;

GRANT SELECT ON public.system_roles TO authenticated;
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT SELECT ON public.user_system_roles TO authenticated;
GRANT SELECT ON public.project_invitations TO authenticated;
GRANT SELECT ON public.admin_security_settings TO authenticated;

-- 8. Private SECURITY DEFINER Authorization & Audit Helpers
CREATE OR REPLACE FUNCTION private.is_account_active(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_uid IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = p_uid
        AND u.deleted_at IS NULL
        AND (u.banned_until IS NULL OR u.banned_until <= now())
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.crew_profiles cp
      WHERE cp.user_id = p_uid
        AND (cp.is_archived = true OR cp.account_status IN ('suspended', 'deactivated'))
    );
$$;

CREATE OR REPLACE FUNCTION private.get_user_system_role(p_uid uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE(
    (SELECT usr.system_role FROM public.user_system_roles usr WHERE usr.user_id = p_uid),
    CASE
      WHEN EXISTS (
        SELECT 1 FROM public.crew_profiles cp
        WHERE cp.user_id = p_uid AND cp.is_studio_admin = true AND cp.is_archived = false
      ) THEN 'system_admin'
      ELSE 'crew_member'
    END
  );
$$;

CREATE OR REPLACE FUNCTION private.is_studio_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND private.is_account_active((select auth.uid()))
    AND private.get_user_system_role((select auth.uid())) IN ('system_owner', 'system_admin');
$$;

CREATE OR REPLACE FUNCTION private.can_access_project(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND private.is_account_active((select auth.uid()))
    AND p_project_id IS NOT NULL
    AND (
      private.is_studio_admin()
      OR EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_project_id
          AND p.owner_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = (select auth.uid())
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_edit_project(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND private.is_account_active((select auth.uid()))
    AND p_project_id IS NOT NULL
    AND (
      private.is_studio_admin()
      OR EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_project_id
          AND p.owner_id = (select auth.uid())
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = (select auth.uid())
          AND pm.member_role IN ('owner', 'production_admin', 'editor')
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.can_manage_project_members(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND private.is_account_active((select auth.uid()))
    AND p_project_id IS NOT NULL
    AND (
      private.is_studio_admin()
      OR EXISTS (
        SELECT 1
        FROM public.projects p
        WHERE p.id = p_project_id
          AND p.owner_id = (select auth.uid())
          AND p.is_archived = false
      )
      OR EXISTS (
        SELECT 1
        FROM public.project_members pm
        WHERE pm.project_id = p_project_id
          AND pm.user_id = (select auth.uid())
          AND pm.member_role IN ('owner', 'production_admin')
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.is_production_admin_anywhere(p_uid uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT p_uid IS NOT NULL
    AND private.is_account_active(p_uid)
    AND (
      private.get_user_system_role(p_uid) = 'production_admin'
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.user_id = p_uid AND pm.member_role IN ('owner', 'production_admin')
      )
      OR EXISTS (
        SELECT 1 FROM public.projects p
        WHERE p.owner_id = p_uid AND p.is_archived = false
      )
    );
$$;

CREATE OR REPLACE FUNCTION private.has_permission(p_permission text, p_project_id text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_role text;
  v_perm_scope text;
BEGIN
  IF v_uid IS NULL OR NOT private.is_account_active(v_uid) THEN
    RETURN false;
  END IF;

  v_role := private.get_user_system_role(v_uid);

  SELECT rp.scope INTO v_perm_scope
  FROM public.role_permissions rp
  WHERE rp.role_key = v_role
    AND rp.permission_key = p_permission;

  -- Project owners/production_admins on project_members implicitly receive production_admin scope for project ops
  IF v_perm_scope IS NULL AND p_project_id IS NOT NULL AND private.can_manage_project_members(p_project_id) THEN
    SELECT rp.scope INTO v_perm_scope
    FROM public.role_permissions rp
    WHERE rp.role_key = 'production_admin'
      AND rp.permission_key = p_permission;
  END IF;

  IF v_perm_scope IS NULL THEN
    RETURN false;
  END IF;

  IF v_perm_scope = 'global' OR v_perm_scope = 'self' THEN
    RETURN true;
  END IF;

  IF v_perm_scope = 'project' THEN
    IF p_project_id IS NULL THEN
      RETURN private.is_production_admin_anywhere(v_uid);
    END IF;
    RETURN private.can_manage_project_members(p_project_id);
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION private.write_admin_audit(
  p_actor_id uuid,
  p_target_user_id uuid,
  p_event_type text,
  p_status text,
  p_target_type text,
  p_target_id text,
  p_reason text DEFAULT '',
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_safe_meta jsonb := '{}'::jsonb;
  v_rec record;
  v_id uuid;
  v_subject_uid uuid;
BEGIN
  v_subject_uid := COALESCE(p_target_user_id, p_actor_id);
  IF v_subject_uid IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_metadata IS NOT NULL AND jsonb_typeof(p_metadata) = 'object' THEN
    FOR v_rec IN SELECT key, value FROM jsonb_each(p_metadata) LOOP
      IF lower(v_rec.key) !~ '(password|passphrase|secret|token|authorization|cookie|credential|hmac|jwt)' THEN
        v_safe_meta := v_safe_meta || jsonb_build_object(left(v_rec.key, 48), v_rec.value);
      END IF;
    END LOOP;
  END IF;

  INSERT INTO public.security_audit_logs (
    user_id, actor_id, event_type, status, target_type, target_id, reason, metadata
  ) VALUES (
    v_subject_uid,
    p_actor_id,
    regexp_replace(lower(trim(coalesce(p_event_type, 'admin_action'))), '[^a-z0-9_.:-]', '_', 'g'),
    CASE WHEN lower(trim(coalesce(p_status, 'success'))) IN ('success', 'failure', 'blocked') THEN lower(trim(p_status)) ELSE 'success' END,
    left(coalesce(nullif(trim(p_target_type), ''), 'account'), 40),
    left(coalesce(p_target_id, ''), 120),
    left(coalesce(trim(p_reason), ''), 300),
    v_safe_meta
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

-- Safe one-time System Owner bootstrap (callable ONLY by postgres/service_role in trusted environment)
CREATE OR REPLACE FUNCTION private.bootstrap_first_system_owner(p_email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_owner_count integer;
  v_target_uid uuid;
BEGIN
  SELECT count(*) INTO v_owner_count
  FROM public.user_system_roles
  WHERE system_role = 'system_owner';

  IF v_owner_count > 0 THEN
    RAISE EXCEPTION 'System Owner sudah ada. Gunakan Admin Console untuk mengelola role.' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_target_uid
  FROM auth.users
  WHERE lower(email) = lower(trim(coalesce(p_email, '')))
    AND deleted_at IS NULL
  LIMIT 1;

  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'Pengguna auth.users dengan email % tidak ditemukan', p_email USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.user_system_roles (user_id, system_role, assigned_by, reason)
  VALUES (v_target_uid, 'system_owner', v_target_uid, 'Bootstrap awal System Owner')
  ON CONFLICT (user_id) DO UPDATE SET
    system_role = 'system_owner',
    assigned_by = v_target_uid,
    assigned_at = now(),
    reason = 'Bootstrap awal System Owner';

  UPDATE public.crew_profiles
  SET is_studio_admin = true, account_status = 'active'
  WHERE user_id = v_target_uid;

  PERFORM private.write_admin_audit(
    v_target_uid, v_target_uid, 'system_owner_bootstrapped', 'success', 'account', v_target_uid::text,
    'Bootstrap awal System Owner via operasi SQL tepercaya', jsonb_build_object('new_role', 'system_owner')
  );

  RETURN v_target_uid;
END;
$$;

REVOKE ALL ON FUNCTION private.is_account_active(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.get_user_system_role(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_studio_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_project(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_edit_project(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_manage_project_members(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.is_production_admin_anywhere(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.has_permission(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.write_admin_audit(uuid, uuid, text, text, text, text, text, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION private.bootstrap_first_system_owner(text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION private.is_account_active(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.get_user_system_role(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_studio_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_project(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_edit_project(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_manage_project_members(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.is_production_admin_anywhere(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.has_permission(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.write_admin_audit(uuid, uuid, text, text, text, text, text, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION private.bootstrap_first_system_owner(text) TO service_role;

-- 9. Update crew_profiles security trigger & handle_new_auth_user trigger
CREATE OR REPLACE FUNCTION private.enforce_crew_profile_security()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_key text;
  v_keys text[] := ARRAY['scriptSupervisor', 'videoEditor', 'soundRecordist', 'directorProducer', 'autoExportMeta'];
BEGIN
  IF current_user IN ('authenticated', 'anon') AND NOT private.is_studio_admin() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id
       OR NEW.email IS DISTINCT FROM OLD.email
       OR NEW.is_studio_admin IS DISTINCT FROM OLD.is_studio_admin
       OR NEW.granted_roles IS DISTINCT FROM OLD.granted_roles
       OR NEW.account_status IS DISTINCT FROM OLD.account_status
       OR NEW.status_reason IS DISTINCT FROM OLD.status_reason
       OR NEW.status_updated_at IS DISTINCT FROM OLD.status_updated_at
       OR NEW.status_updated_by IS DISTINCT FROM OLD.status_updated_by THEN
      RAISE EXCEPTION 'Unauthorized modification of protected crew profile attributes' USING ERRCODE = '42501';
    END IF;

    FOREACH v_key IN ARRAY v_keys LOOP
      IF COALESCE((NEW.roles ->> v_key)::boolean, false) = true
         AND COALESCE((OLD.granted_roles ->> v_key)::boolean, false) = false THEN
        RAISE EXCEPTION 'Peran % tidak diizinkan untuk akun ini', v_key USING ERRCODE = '42501';
      END IF;
    END LOOP;

    NEW.roles := jsonb_build_object(
      'scriptSupervisor', COALESCE((NEW.roles ->> 'scriptSupervisor')::boolean, false) AND COALESCE((OLD.granted_roles ->> 'scriptSupervisor')::boolean, false),
      'videoEditor', COALESCE((NEW.roles ->> 'videoEditor')::boolean, false) AND COALESCE((OLD.granted_roles ->> 'videoEditor')::boolean, false),
      'soundRecordist', COALESCE((NEW.roles ->> 'soundRecordist')::boolean, false) AND COALESCE((OLD.granted_roles ->> 'soundRecordist')::boolean, false),
      'directorProducer', COALESCE((NEW.roles ->> 'directorProducer')::boolean, false) AND COALESCE((OLD.granted_roles ->> 'directorProducer')::boolean, false),
      'autoExportMeta', COALESCE((NEW.roles ->> 'autoExportMeta')::boolean, false) AND COALESCE((OLD.granted_roles ->> 'autoExportMeta')::boolean, false)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_email text;
  v_name text;
  v_initials text;
  v_persona text;
  v_role_key text;
  v_role_title text;
  v_studio text;
  v_badge text;
  v_roles jsonb;
BEGIN
  v_email := COALESCE(new.email, '');
  v_name := COALESCE(
    NULLIF(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    NULLIF(split_part(v_email, '@', 1), ''),
    'Kru Produksi'
  );
  v_initials := upper(substring(regexp_replace(v_name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 2));
  IF length(v_initials) = 0 THEN
    v_initials := 'KP';
  END IF;

  v_persona := 'crew_' || COALESCE(
    NULLIF(left(regexp_replace(lower(split_part(v_email, '@', 1)), '[^a-z0-9_]', '_', 'g'), 24), ''),
    'user'
  ) || '_' || left(replace(new.id::text, '-', ''), 6);

  v_role_key := COALESCE(NULLIF(trim(new.raw_user_meta_data ->> 'role_key'), ''), 'scriptSupervisor');
  IF v_role_key NOT IN ('scriptSupervisor', 'videoEditor', 'soundRecordist') THEN
    v_role_key := 'scriptSupervisor';
  END IF;

  v_role_title := CASE v_role_key
    WHEN 'videoEditor' THEN 'Offline Video Editor'
    WHEN 'soundRecordist' THEN 'Production Sound Mixer'
    ELSE 'Script Supervisor & Continuity'
  END;

  v_studio := 'StoryPad Studio';
  v_badge := 'SP-' || upper(left(replace(new.id::text, '-', ''), 4));

  v_roles := jsonb_build_object(
    'scriptSupervisor', (v_role_key = 'scriptSupervisor'),
    'videoEditor', (v_role_key = 'videoEditor'),
    'soundRecordist', (v_role_key = 'soundRecordist'),
    'directorProducer', false,
    'autoExportMeta', true
  );

  INSERT INTO public.crew_profiles (
    user_id, persona_key, full_name, initials, role_title, id_badge,
    studio, prod_name, email, roles, granted_roles, is_studio_admin, is_archived, account_status
  ) VALUES (
    new.id, v_persona, v_name, v_initials, v_role_title, v_badge,
    v_studio, '-', v_email, v_roles, v_roles, false, false, 'active'
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

  INSERT INTO public.user_system_roles (user_id, system_role, reason)
  VALUES (new.id, 'crew_member', 'Registrasi akun baru')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 10. RLS Policies for new & updated tables
DROP POLICY IF EXISTS system_roles_auth_select ON public.system_roles;
CREATE POLICY system_roles_auth_select ON public.system_roles
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS role_permissions_auth_select ON public.role_permissions;
CREATE POLICY role_permissions_auth_select ON public.role_permissions
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS user_system_roles_auth_select ON public.user_system_roles;
CREATE POLICY user_system_roles_auth_select ON public.user_system_roles
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR private.is_studio_admin());

DROP POLICY IF EXISTS project_invitations_auth_select ON public.project_invitations;
CREATE POLICY project_invitations_auth_select ON public.project_invitations
  FOR SELECT TO authenticated
  USING (
    private.is_studio_admin()
    OR (project_id IS NOT NULL AND private.can_manage_project_members(project_id))
  );

DROP POLICY IF EXISTS admin_security_settings_auth_select ON public.admin_security_settings;
CREATE POLICY admin_security_settings_auth_select ON public.admin_security_settings
  FOR SELECT TO authenticated
  USING (private.has_permission('security.read', NULL));

DROP POLICY IF EXISTS "Users can view own security audit logs" ON public.security_audit_logs;
DROP POLICY IF EXISTS security_audit_logs_auth_select ON public.security_audit_logs;
CREATE POLICY security_audit_logs_auth_select ON public.security_audit_logs
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR private.has_permission('audit.read', NULL)
  );

-- Expand project_members policies to allow production_admin on their project scope
DROP POLICY IF EXISTS project_members_auth_insert ON public.project_members;
DROP POLICY IF EXISTS project_members_auth_update ON public.project_members;
DROP POLICY IF EXISTS project_members_auth_delete ON public.project_members;

CREATE POLICY project_members_auth_insert ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (private.can_manage_project_members(project_id));

CREATE POLICY project_members_auth_update ON public.project_members
  FOR UPDATE TO authenticated
  USING (private.can_manage_project_members(project_id))
  WITH CHECK (private.can_manage_project_members(project_id));

CREATE POLICY project_members_auth_delete ON public.project_members
  FOR DELETE TO authenticated
  USING (private.can_manage_project_members(project_id));

-- 11. Admin Console RPCs (all SECURITY DEFINER, SET search_path = '', strict permission + scope enforcement)

-- 11.1 Current actor access & capabilities
CREATE OR REPLACE FUNCTION public.admin_get_my_access()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_role text;
  v_role_info record;
  v_perms text[];
  v_managed_projects jsonb;
  v_can_console boolean := false;
  v_is_active boolean := false;
  v_profile record;
  v_email text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  v_is_active := private.is_account_active(v_uid);
  v_role := private.get_user_system_role(v_uid);

  SELECT role_key, display_name, scope, rank, description
  INTO v_role_info
  FROM public.system_roles
  WHERE role_key = v_role;

  SELECT email INTO v_email FROM auth.users WHERE id = v_uid;
  SELECT full_name, initials, id_badge, account_status
  INTO v_profile
  FROM public.crew_profiles
  WHERE user_id = v_uid AND is_archived = false
  LIMIT 1;

  SELECT COALESCE(array_agg(DISTINCT rp.permission_key ORDER BY rp.permission_key), ARRAY[]::text[])
  INTO v_perms
  FROM public.role_permissions rp
  WHERE rp.role_key = v_role;

  -- If user is owner or production_admin on any active project, include project-scoped console permissions
  IF v_is_active AND v_role IN ('crew_member', 'viewer') AND private.is_production_admin_anywhere(v_uid) THEN
    SELECT COALESCE(array_agg(DISTINCT rp.permission_key ORDER BY rp.permission_key), ARRAY[]::text[])
    INTO v_perms
    FROM public.role_permissions rp
    WHERE rp.role_key = 'production_admin';
    v_role := 'production_admin';
    SELECT role_key, display_name, scope, rank, description
    INTO v_role_info
    FROM public.system_roles
    WHERE role_key = 'production_admin';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('id', p.id, 'code', p.code, 'title', p.title)
      ORDER BY p.sort_order ASC, p.title ASC
    ),
    '[]'::jsonb
  )
  INTO v_managed_projects
  FROM public.projects p
  WHERE p.is_archived = false
    AND (
      v_role IN ('system_owner', 'system_admin')
      OR p.owner_id = v_uid
      OR EXISTS (
        SELECT 1 FROM public.project_members pm
        WHERE pm.project_id = p.id AND pm.user_id = v_uid AND pm.member_role IN ('owner', 'production_admin')
      )
    );

  v_can_console := v_is_active AND (v_role IN ('system_owner', 'system_admin', 'production_admin'));

  RETURN jsonb_build_object(
    'user_id', v_uid,
    'email', COALESCE(v_email, ''),
    'full_name', COALESCE(v_profile.full_name, split_part(COALESCE(v_email, ''), '@', 1)),
    'initials', COALESCE(v_profile.initials, 'AD'),
    'id_badge', COALESCE(v_profile.id_badge, '-'),
    'account_status', COALESCE(v_profile.account_status, 'active'),
    'is_active', v_is_active,
    'system_role', v_role,
    'system_role_label', COALESCE(v_role_info.display_name, v_role),
    'role_scope', COALESCE(v_role_info.scope, 'project'),
    'role_rank', COALESCE(v_role_info.rank, 0),
    'can_access_console', v_can_console,
    'permissions', to_jsonb(COALESCE(v_perms, ARRAY[]::text[])),
    'managed_projects', v_managed_projects
  );
END;
$$;

-- 11.2 Overview telemetry (strictly real DB counts scoped to actor)
CREATE OR REPLACE FUNCTION public.admin_get_overview()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_is_global boolean;
  v_total_accounts int := 0;
  v_active_accounts int := 0;
  v_suspended_accounts int := 0;
  v_deactivated_accounts int := 0;
  v_unverified_accounts int := 0;
  v_active_sessions int := 0;
  v_pending_invites int := 0;
  v_expired_invites int := 0;
  v_managed_projects int := 0;
  v_recent_audits jsonb := '[]'::jsonb;
  v_security_alerts jsonb := '[]'::jsonb;
  v_leaked_pw_note text := 'Periksa di Supabase Dashboard';
BEGIN
  IF NOT private.has_permission('accounts.read', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission for overview' USING ERRCODE = '42501';
  END IF;

  v_is_global := private.is_studio_admin();

  IF v_is_global THEN
    SELECT
      count(*),
      count(*) FILTER (WHERE COALESCE(cp.account_status, 'active') = 'active' AND (u.banned_until IS NULL OR u.banned_until <= now())),
      count(*) FILTER (WHERE cp.account_status = 'suspended' OR (u.banned_until IS NOT NULL AND u.banned_until > now())),
      count(*) FILTER (WHERE cp.account_status = 'deactivated'),
      count(*) FILTER (WHERE u.email_confirmed_at IS NULL)
    INTO v_total_accounts, v_active_accounts, v_suspended_accounts, v_deactivated_accounts, v_unverified_accounts
    FROM auth.users u
    LEFT JOIN public.crew_profiles cp ON cp.user_id = u.id AND cp.is_archived = false
    WHERE u.deleted_at IS NULL;

    SELECT count(*) INTO v_active_sessions
    FROM auth.sessions s
    WHERE s.not_after IS NULL OR s.not_after > now();

    SELECT
      count(*) FILTER (WHERE status = 'pending' AND expires_at > now()),
      count(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at <= now()))
    INTO v_pending_invites, v_expired_invites
    FROM public.project_invitations;

    SELECT count(*) INTO v_managed_projects
    FROM public.projects WHERE is_archived = false;

    SELECT COALESCE(
      jsonb_agg(row_to_json(t)),
      '[]'::jsonb
    ) INTO v_recent_audits
    FROM (
      SELECT
        sal.id,
        sal.event_type,
        sal.status,
        sal.target_type,
        sal.target_id,
        sal.reason,
        sal.created_at,
        COALESCE(au.email, '') AS actor_email
      FROM public.security_audit_logs sal
      LEFT JOIN auth.users au ON au.id = sal.actor_id
      ORDER BY sal.created_at DESC
      LIMIT 8
    ) t;

    SELECT COALESCE(
      jsonb_agg(row_to_json(a)),
      '[]'::jsonb
    ) INTO v_security_alerts
    FROM (
      SELECT
        sal.id,
        sal.event_type,
        sal.status,
        sal.reason,
        sal.created_at,
        COALESCE(tu.email, '') AS target_email
      FROM public.security_audit_logs sal
      LEFT JOIN auth.users tu ON tu.id = sal.user_id
      WHERE sal.status IN ('blocked', 'failure')
         OR sal.event_type IN ('system_role_changed', 'account_status_changed', 'user_sessions_revoked_all')
      ORDER BY sal.created_at DESC
      LIMIT 6
    ) a;
  ELSE
    -- Scoped Production Admin overview (no cross-tenant counts)
    SELECT
      count(DISTINCT pm.user_id),
      count(DISTINCT pm.user_id) FILTER (WHERE COALESCE(cp.account_status, 'active') = 'active'),
      count(DISTINCT pm.user_id) FILTER (WHERE cp.account_status = 'suspended'),
      count(DISTINCT pm.user_id) FILTER (WHERE cp.account_status = 'deactivated'),
      count(DISTINCT pm.user_id) FILTER (WHERE u.email_confirmed_at IS NULL)
    INTO v_total_accounts, v_active_accounts, v_suspended_accounts, v_deactivated_accounts, v_unverified_accounts
    FROM public.project_members pm
    JOIN auth.users u ON u.id = pm.user_id AND u.deleted_at IS NULL
    LEFT JOIN public.crew_profiles cp ON cp.user_id = pm.user_id AND cp.is_archived = false
    WHERE private.can_manage_project_members(pm.project_id);

    SELECT count(*) INTO v_active_sessions
    FROM auth.sessions s
    WHERE s.user_id = v_uid AND (s.not_after IS NULL OR s.not_after > now());

    SELECT
      count(*) FILTER (WHERE status = 'pending' AND expires_at > now()),
      count(*) FILTER (WHERE status = 'expired' OR (status = 'pending' AND expires_at <= now()))
    INTO v_pending_invites, v_expired_invites
    FROM public.project_invitations pi
    WHERE pi.project_id IS NOT NULL AND private.can_manage_project_members(pi.project_id);

    SELECT count(*) INTO v_managed_projects
    FROM public.projects p
    WHERE p.is_archived = false AND private.can_manage_project_members(p.id);
  END IF;

  RETURN jsonb_build_object(
    'scope', CASE WHEN v_is_global THEN 'global' ELSE 'project' END,
    'counts', jsonb_build_object(
      'total_accounts', v_total_accounts,
      'active_accounts', v_active_accounts,
      'suspended_accounts', v_suspended_accounts,
      'deactivated_accounts', v_deactivated_accounts,
      'unverified_accounts', v_unverified_accounts,
      'active_sessions', v_active_sessions,
      'pending_invitations', v_pending_invites,
      'expired_invitations', v_expired_invites,
      'managed_projects', v_managed_projects
    ),
    'recent_audits', v_recent_audits,
    'security_alerts', v_security_alerts
  );
END;
$$;

-- 11.3 Accounts list (search, filter, pagination, strictly scoped)
CREATE OR REPLACE FUNCTION public.admin_list_accounts(
  p_search text DEFAULT '',
  p_status text DEFAULT 'all',
  p_system_role text DEFAULT 'all',
  p_limit integer DEFAULT 25,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_is_global boolean;
  v_search text := lower(trim(coalesce(p_search, '')));
  v_status text := lower(trim(coalesce(p_status, 'all')));
  v_role_filter text := lower(trim(coalesce(p_system_role, 'all')));
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.has_permission('accounts.read', NULL) THEN
    RAISE EXCEPTION 'Forbidden: cannot list accounts' USING ERRCODE = '42501';
  END IF;

  v_is_global := private.is_studio_admin();

  WITH scoped_users AS (
    SELECT
      u.id AS user_id,
      COALESCE(u.email, '') AS email,
      u.email_confirmed_at,
      u.created_at,
      u.last_sign_in_at,
      COALESCE(cp.full_name, split_part(COALESCE(u.email, ''), '@', 1)) AS full_name,
      COALESCE(cp.initials, 'KP') AS initials,
      COALESCE(cp.role_title, 'Crew Member') AS role_title,
      COALESCE(cp.id_badge, '-') AS id_badge,
      COALESCE(cp.studio, 'StoryPad Studio') AS studio,
      COALESCE(cp.account_status, 'active') AS account_status,
      private.get_user_system_role(u.id) AS system_role,
      (
        SELECT count(*)::int
        FROM public.project_members pm
        JOIN public.projects p ON p.id = pm.project_id AND p.is_archived = false
        WHERE pm.user_id = u.id
          AND (v_is_global OR private.can_manage_project_members(pm.project_id))
      ) AS project_count,
      (
        SELECT count(*)::int
        FROM auth.sessions s
        WHERE s.user_id = u.id
          AND (s.not_after IS NULL OR s.not_after > now())
      ) AS active_sessions_count
    FROM auth.users u
    LEFT JOIN public.crew_profiles cp ON cp.user_id = u.id AND cp.is_archived = false
    WHERE u.deleted_at IS NULL
      AND (
        v_is_global
        OR u.id = v_uid
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          WHERE pm.user_id = u.id AND private.can_manage_project_members(pm.project_id)
        )
      )
  ),
  filtered AS (
    SELECT su.*, sr.display_name AS system_role_label
    FROM scoped_users su
    LEFT JOIN public.system_roles sr ON sr.role_key = su.system_role
    WHERE (v_search = '' OR lower(su.email) LIKE '%' || v_search || '%' OR lower(su.full_name) LIKE '%' || v_search || '%' OR lower(su.id_badge) LIKE '%' || v_search || '%')
      AND (
        v_status = 'all'
        OR (v_status = 'unverified' AND su.email_confirmed_at IS NULL)
        OR (v_status IN ('active', 'suspended', 'deactivated') AND su.account_status = v_status)
      )
      AND (v_role_filter = 'all' OR su.system_role = v_role_filter)
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(
      (
        SELECT jsonb_agg(row_to_json(paged))
        FROM (
          SELECT
            user_id, email, email_confirmed_at, created_at, last_sign_in_at,
            full_name, initials, role_title, id_badge, studio, account_status,
            system_role, system_role_label, project_count,
            CASE WHEN v_is_global OR user_id = v_uid THEN active_sessions_count ELSE NULL END AS active_sessions_count
          FROM filtered
          ORDER BY created_at DESC
          LIMIT v_lim OFFSET v_off
        ) paged
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object(
    'total', v_total,
    'limit', v_lim,
    'offset', v_off,
    'accounts', v_rows
  );
END;
$$;

-- 11.4 Account detail (never returns passwords, tokens, or secrets)
CREATE OR REPLACE FUNCTION public.admin_get_account_detail(p_target_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_is_global boolean;
  v_user record;
  v_profile record;
  v_sys_role text;
  v_sys_role_info record;
  v_permissions jsonb := '[]'::jsonb;
  v_memberships jsonb := '[]'::jsonb;
  v_identities jsonb := '[]'::jsonb;
  v_sessions jsonb := '[]'::jsonb;
  v_audits jsonb := '[]'::jsonb;
  v_can_read_sessions boolean;
  v_can_read_audit boolean;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Target user_id wajib diisi' USING ERRCODE = '22023';
  END IF;

  IF NOT private.has_permission('accounts.read', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to read account detail' USING ERRCODE = '42501';
  END IF;

  v_is_global := private.is_studio_admin();

  IF NOT v_is_global AND p_target_user_id <> v_uid AND NOT EXISTS (
    SELECT 1 FROM public.project_members pm
    WHERE pm.user_id = p_target_user_id AND private.can_manage_project_members(pm.project_id)
  ) THEN
    RAISE EXCEPTION 'Forbidden: target account outside project scope' USING ERRCODE = '42501';
  END IF;

  SELECT id, email, email_confirmed_at, created_at, last_sign_in_at, banned_until
  INTO v_user
  FROM auth.users
  WHERE id = p_target_user_id AND deleted_at IS NULL;

  IF v_user.id IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_profile
  FROM public.crew_profiles
  WHERE user_id = p_target_user_id AND is_archived = false
  LIMIT 1;

  v_sys_role := private.get_user_system_role(p_target_user_id);
  SELECT role_key, display_name, scope, rank INTO v_sys_role_info
  FROM public.system_roles WHERE role_key = v_sys_role;

  SELECT COALESCE(jsonb_agg(permission_key ORDER BY permission_key), '[]'::jsonb)
  INTO v_permissions
  FROM public.role_permissions
  WHERE role_key = v_sys_role;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'project_id', p.id,
        'project_code', p.code,
        'project_title', p.title,
        'member_role', pm.member_role,
        'production_role', pm.production_role,
        'is_owner', (p.owner_id = p_target_user_id),
        'created_at', pm.created_at
      )
      ORDER BY p.sort_order ASC, p.title ASC
    ),
    '[]'::jsonb
  ) INTO v_memberships
  FROM public.project_members pm
  JOIN public.projects p ON p.id = pm.project_id AND p.is_archived = false
  WHERE pm.user_id = p_target_user_id
    AND (v_is_global OR private.can_manage_project_members(pm.project_id));

  IF v_is_global OR p_target_user_id = v_uid THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', i.id,
          'provider', i.provider,
          'email', COALESCE(i.identity_data ->> 'email', v_user.email, ''),
          'last_sign_in_at', i.last_sign_in_at,
          'created_at', i.created_at
        )
        ORDER BY i.created_at ASC
      ),
      '[]'::jsonb
    ) INTO v_identities
    FROM auth.identities i
    WHERE i.user_id = p_target_user_id;
  END IF;

  v_can_read_sessions := private.has_permission('sessions.read_all', NULL) OR p_target_user_id = v_uid;
  IF v_can_read_sessions THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'session_id', s.id,
          'created_at', s.created_at,
          'updated_at', s.updated_at,
          'refreshed_at', s.refreshed_at,
          'not_after', s.not_after,
          'user_agent', left(coalesce(s.user_agent, ''), 300),
          'ip_masked', CASE
            WHEN s.ip IS NULL THEN 'IP tidak tercatat'
            WHEN family(s.ip) = 4 THEN regexp_replace(host(s.ip), '\.\d+$', '.xxx')
            ELSE regexp_replace(host(s.ip), ':[0-9a-fA-F:]+$', ':xxxx')
          END,
          'aal', coalesce(s.aal::text, 'aal1')
        )
        ORDER BY coalesce(s.refreshed_at::timestamptz, s.updated_at, s.created_at) DESC
      ),
      '[]'::jsonb
    ) INTO v_sessions
    FROM auth.sessions s
    WHERE s.user_id = p_target_user_id
      AND (s.not_after IS NULL OR s.not_after > now());
  END IF;

  v_can_read_audit := private.has_permission('audit.read', NULL) OR p_target_user_id = v_uid;
  IF v_can_read_audit THEN
    SELECT COALESCE(
      jsonb_agg(
        jsonb_build_object(
          'id', sal.id,
          'event_type', sal.event_type,
          'status', sal.status,
          'target_type', sal.target_type,
          'reason', sal.reason,
          'metadata', sal.metadata,
          'created_at', sal.created_at
        )
        ORDER BY sal.created_at DESC
      ),
      '[]'::jsonb
    ) INTO v_audits
    FROM (
      SELECT id, event_type, status, target_type, reason, metadata, created_at
      FROM public.security_audit_logs
      WHERE user_id = p_target_user_id OR actor_id = p_target_user_id
      ORDER BY created_at DESC
      LIMIT 15
    ) sal;
  END IF;

  RETURN jsonb_build_object(
    'user_id', v_user.id,
    'email', COALESCE(v_user.email, ''),
    'email_confirmed_at', v_user.email_confirmed_at,
    'created_at', v_user.created_at,
    'last_sign_in_at', v_user.last_sign_in_at,
    'profile', jsonb_build_object(
      'persona_key', COALESCE(v_profile.persona_key, ''),
      'full_name', COALESCE(v_profile.full_name, split_part(COALESCE(v_user.email, ''), '@', 1)),
      'initials', COALESCE(v_profile.initials, 'KP'),
      'role_title', COALESCE(v_profile.role_title, 'Crew Member'),
      'id_badge', COALESCE(v_profile.id_badge, '-'),
      'studio', COALESCE(v_profile.studio, 'StoryPad Studio'),
      'account_status', COALESCE(v_profile.account_status, 'active'),
      'status_reason', COALESCE(v_profile.status_reason, ''),
      'status_updated_at', v_profile.status_updated_at,
      'granted_roles', COALESCE(v_profile.granted_roles, '{}'::jsonb)
    ),
    'system_role', v_sys_role,
    'system_role_label', COALESCE(v_sys_role_info.display_name, v_sys_role),
    'role_scope', COALESCE(v_sys_role_info.scope, 'project'),
    'permissions', v_permissions,
    'memberships', v_memberships,
    'identities', v_identities,
    'sessions', v_sessions,
    'sessions_accessible', v_can_read_sessions,
    'recent_audits', v_audits,
    'audits_accessible', v_can_read_audit
  );
END;
$$;

-- 11.5 Update manageable profile fields (requires accounts.update_profile)
CREATE OR REPLACE FUNCTION public.admin_update_account_profile(
  p_target_user_id uuid,
  p_full_name text,
  p_role_title text,
  p_id_badge text,
  p_studio text,
  p_granted_roles jsonb DEFAULT NULL,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_name text := left(trim(coalesce(p_full_name, '')), 120);
  v_title text := left(trim(coalesce(p_role_title, 'Crew Member')), 120);
  v_badge text := left(trim(coalesce(p_id_badge, 'SP-01')), 32);
  v_studio text := left(trim(coalesce(p_studio, 'StoryPad Studio')), 120);
  v_initials text;
  v_granted jsonb;
  v_target_email text;
BEGIN
  IF NOT private.has_permission('accounts.update_profile', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to update account profile' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR v_name = '' THEN
    RAISE EXCEPTION 'Nama lengkap dan target akun wajib diisi' USING ERRCODE = '22023';
  END IF;

  SELECT email INTO v_target_email FROM auth.users WHERE id = p_target_user_id AND deleted_at IS NULL;
  IF v_target_email IS NULL THEN
    RAISE EXCEPTION 'Akun tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  v_initials := upper(substring(regexp_replace(v_name, '[^a-zA-Z0-9]', '', 'g') FROM 1 FOR 2));
  IF length(v_initials) = 0 THEN
    v_initials := 'KP';
  END IF;

  IF p_granted_roles IS NOT NULL AND jsonb_typeof(p_granted_roles) = 'object' THEN
    v_granted := jsonb_build_object(
      'scriptSupervisor', COALESCE((p_granted_roles ->> 'scriptSupervisor')::boolean, false),
      'videoEditor', COALESCE((p_granted_roles ->> 'videoEditor')::boolean, false),
      'soundRecordist', COALESCE((p_granted_roles ->> 'soundRecordist')::boolean, false),
      'directorProducer', COALESCE((p_granted_roles ->> 'directorProducer')::boolean, false),
      'autoExportMeta', COALESCE((p_granted_roles ->> 'autoExportMeta')::boolean, true)
    );
  END IF;

  UPDATE public.crew_profiles
  SET
    full_name = v_name,
    initials = v_initials,
    role_title = CASE WHEN v_title = '' THEN role_title ELSE v_title END,
    id_badge = CASE WHEN v_badge = '' THEN id_badge ELSE v_badge END,
    studio = CASE WHEN v_studio = '' THEN studio ELSE v_studio END,
    granted_roles = COALESCE(v_granted, granted_roles),
    roles = CASE WHEN v_granted IS NOT NULL THEN v_granted ELSE roles END,
    updated_at = now()
  WHERE user_id = p_target_user_id AND is_archived = false;

  IF NOT FOUND THEN
    INSERT INTO public.crew_profiles (
      user_id, persona_key, full_name, initials, role_title, id_badge,
      studio, prod_name, email, roles, granted_roles, is_studio_admin, is_archived, account_status
    ) VALUES (
      p_target_user_id,
      'crew_' || left(replace(p_target_user_id::text, '-', ''), 12),
      v_name, v_initials, v_title, v_badge, v_studio, '-', v_target_email,
      COALESCE(v_granted, '{"scriptSupervisor":true,"videoEditor":false,"soundRecordist":false,"directorProducer":false,"autoExportMeta":true}'::jsonb),
      COALESCE(v_granted, '{"scriptSupervisor":true,"videoEditor":false,"soundRecordist":false,"directorProducer":false,"autoExportMeta":true}'::jsonb),
      private.get_user_system_role(p_target_user_id) IN ('system_owner', 'system_admin'),
      false, 'active'
    );
  END IF;

  PERFORM private.write_admin_audit(
    v_uid, p_target_user_id, 'account_profile_updated', 'success', 'account', p_target_user_id::text,
    p_reason, jsonb_build_object('updated_fields', ARRAY['full_name', 'role_title', 'id_badge', 'studio'])
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_target_user_id);
END;
$$;

-- 11.6 Update Account Status (active / suspended / deactivated) with anti-lockout & session revocation
CREATE OR REPLACE FUNCTION public.admin_update_account_status(
  p_target_user_id uuid,
  p_status text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_status text := lower(trim(coalesce(p_status, '')));
  v_actor_role text := private.get_user_system_role(v_uid);
  v_target_role text := private.get_user_system_role(p_target_user_id);
  v_owner_count int;
  v_revoked_sessions int := 0;
BEGIN
  IF NOT private.has_permission('accounts.update_status', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to update account status' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR v_status NOT IN ('active', 'suspended', 'deactivated') THEN
    RAISE EXCEPTION 'Status akun tidak valid' USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id = v_uid AND v_status <> 'active' THEN
    PERFORM private.write_admin_audit(v_uid, p_target_user_id, 'account_status_self_lockout', 'blocked', 'account', p_target_user_id::text, p_reason, jsonb_build_object('requested_status', v_status));
    RAISE EXCEPTION 'Admin tidak dapat menangguhkan atau menonaktifkan akunnya sendiri' USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'system_owner' AND v_actor_role <> 'system_owner' THEN
    PERFORM private.write_admin_audit(v_uid, p_target_user_id, 'account_status_hierarchy_blocked', 'blocked', 'account', p_target_user_id::text, p_reason, jsonb_build_object('requested_status', v_status));
    RAISE EXCEPTION 'Hanya System Owner yang dapat mengubah status akun System Owner' USING ERRCODE = '42501';
  END IF;

  IF v_target_role = 'system_owner' AND v_status <> 'active' THEN
    SELECT count(*) INTO v_owner_count
    FROM public.user_system_roles usr
    WHERE usr.system_role = 'system_owner'
      AND usr.user_id <> p_target_user_id
      AND private.is_account_active(usr.user_id);

    IF v_owner_count = 0 THEN
      RAISE EXCEPTION 'Tidak dapat menonaktifkan System Owner aktif terakhir' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.crew_profiles
  SET
    account_status = v_status,
    status_reason = left(trim(coalesce(p_reason, '')), 300),
    status_updated_at = now(),
    status_updated_by = v_uid
  WHERE user_id = p_target_user_id AND is_archived = false;

  IF v_status IN ('suspended', 'deactivated') THEN
    UPDATE auth.users
    SET banned_until = '2999-12-31 23:59:59+00'::timestamptz
    WHERE id = p_target_user_id;

    DELETE FROM auth.sessions WHERE user_id = p_target_user_id;
    GET DIAGNOSTICS v_revoked_sessions = ROW_COUNT;
  ELSE
    UPDATE auth.users
    SET banned_until = NULL
    WHERE id = p_target_user_id;
  END IF;

  PERFORM private.write_admin_audit(
    v_uid, p_target_user_id, 'account_status_changed', 'success', 'account', p_target_user_id::text,
    p_reason, jsonb_build_object('new_status', v_status, 'revoked_sessions', v_revoked_sessions)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'account_status', v_status,
    'revoked_sessions', v_revoked_sessions
  );
END;
$$;

-- 11.7 List Roles & Permissions Matrix
CREATE OR REPLACE FUNCTION public.admin_list_roles_permissions()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_roles jsonb;
  v_perms jsonb;
BEGIN
  IF NOT private.has_permission('roles.read', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to inspect roles' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role_key', sr.role_key,
        'display_name', sr.display_name,
        'scope', sr.scope,
        'rank', sr.rank,
        'description', sr.description,
        'assigned_count', (SELECT count(*)::int FROM public.user_system_roles usr WHERE usr.system_role = sr.role_key)
      )
      ORDER BY sr.rank DESC
    ),
    '[]'::jsonb
  ) INTO v_roles
  FROM public.system_roles sr;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'role_key', rp.role_key,
        'permission_key', rp.permission_key,
        'scope', rp.scope,
        'description', rp.description
      )
      ORDER BY rp.permission_key ASC, rp.role_key ASC
    ),
    '[]'::jsonb
  ) INTO v_perms
  FROM public.role_permissions rp;

  RETURN jsonb_build_object('roles', v_roles, 'permissions', v_perms);
END;
$$;

-- 11.8 Assign System Role (anti-self-escalation, anti-lockout, hierarchy guard)
CREATE OR REPLACE FUNCTION public.admin_assign_system_role(
  p_target_user_id uuid,
  p_new_role text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_actor_role text := private.get_user_system_role(v_uid);
  v_target_old_role text := private.get_user_system_role(p_target_user_id);
  v_new_role text := lower(trim(coalesce(p_new_role, '')));
  v_active_owners int;
BEGIN
  IF NOT private.has_permission('roles.assign', NULL) THEN
    PERFORM private.write_admin_audit(v_uid, p_target_user_id, 'system_role_change_denied', 'blocked', 'account', coalesce(p_target_user_id::text, ''), p_reason, jsonb_build_object('requested_role', v_new_role));
    RAISE EXCEPTION 'Forbidden: insufficient permission to assign system roles' USING ERRCODE = '42501';
  END IF;

  IF p_target_user_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.system_roles WHERE role_key = v_new_role) THEN
    RAISE EXCEPTION 'System role tidak valid' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Akun target tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  -- Prevent self-promotion or self-demotion from owner/admin
  IF p_target_user_id = v_uid THEN
    PERFORM private.write_admin_audit(v_uid, p_target_user_id, 'system_role_self_change_blocked', 'blocked', 'account', p_target_user_id::text, p_reason, jsonb_build_object('requested_role', v_new_role));
    RAISE EXCEPTION 'Admin tidak dapat mengubah system role miliknya sendiri' USING ERRCODE = '42501';
  END IF;

  -- Hierarchy checks: only system_owner may assign or modify system_owner / system_admin
  IF v_actor_role <> 'system_owner' AND (
    v_new_role IN ('system_owner', 'system_admin')
    OR v_target_old_role IN ('system_owner', 'system_admin')
  ) THEN
    PERFORM private.write_admin_audit(v_uid, p_target_user_id, 'system_role_hierarchy_blocked', 'blocked', 'account', p_target_user_id::text, p_reason, jsonb_build_object('actor_role', v_actor_role, 'old_role', v_target_old_role, 'requested_role', v_new_role));
    RAISE EXCEPTION 'Hanya System Owner yang dapat menetapkan atau mengubah role System Admin / System Owner' USING ERRCODE = '42501';
  END IF;

  -- Prevent removing last active system_owner
  IF v_target_old_role = 'system_owner' AND v_new_role <> 'system_owner' THEN
    SELECT count(*) INTO v_active_owners
    FROM public.user_system_roles usr
    WHERE usr.system_role = 'system_owner'
      AND usr.user_id <> p_target_user_id
      AND private.is_account_active(usr.user_id);

    IF v_active_owners = 0 THEN
      RAISE EXCEPTION 'Sistem harus memiliki minimal satu System Owner aktif' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.user_system_roles (user_id, system_role, assigned_by, assigned_at, reason)
  VALUES (p_target_user_id, v_new_role, v_uid, now(), left(trim(coalesce(p_reason, '')), 300))
  ON CONFLICT (user_id) DO UPDATE SET
    system_role = EXCLUDED.system_role,
    assigned_by = EXCLUDED.assigned_by,
    assigned_at = EXCLUDED.assigned_at,
    reason = EXCLUDED.reason;

  UPDATE public.crew_profiles
  SET is_studio_admin = (v_new_role IN ('system_owner', 'system_admin')),
      updated_at = now()
  WHERE user_id = p_target_user_id AND is_archived = false;

  PERFORM private.write_admin_audit(
    v_uid, p_target_user_id, 'system_role_changed', 'success', 'account', p_target_user_id::text,
    p_reason, jsonb_build_object('old_role', v_target_old_role, 'new_role', v_new_role)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'user_id', p_target_user_id,
    'old_role', v_target_old_role,
    'new_role', v_new_role
  );
END;
$$;

-- 11.9 Project Memberships (strictly scoped for production_admin; separates production_role from member_role)
CREATE OR REPLACE FUNCTION public.admin_list_project_memberships(
  p_project_id text DEFAULT NULL,
  p_search text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_search text := lower(trim(coalesce(p_search, '')));
  v_projects jsonb;
  v_members jsonb;
BEGIN
  IF NOT private.has_permission('projects.manage_members', p_project_id) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to view project memberships' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', p.id,
        'code', p.code,
        'title', p.title,
        'category', p.category,
        'owner_id', p.owner_id,
        'owner_email', COALESCE(ou.email, ''),
        'member_count', (SELECT count(*)::int FROM public.project_members pm WHERE pm.project_id = p.id)
      )
      ORDER BY p.sort_order ASC, p.title ASC
    ),
    '[]'::jsonb
  ) INTO v_projects
  FROM public.projects p
  LEFT JOIN auth.users ou ON ou.id = p.owner_id
  WHERE p.is_archived = false
    AND private.can_manage_project_members(p.id);

  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'project_id', p.id,
        'project_code', p.code,
        'project_title', p.title,
        'user_id', pm.user_id,
        'email', COALESCE(u.email, ''),
        'full_name', COALESCE(cp.full_name, split_part(COALESCE(u.email, ''), '@', 1)),
        'initials', COALESCE(cp.initials, 'KP'),
        'account_status', COALESCE(cp.account_status, 'active'),
        'member_role', pm.member_role,
        'production_role', pm.production_role,
        'is_project_owner', (p.owner_id = pm.user_id),
        'created_at', pm.created_at
      )
      ORDER BY p.sort_order ASC, pm.created_at ASC
    ),
    '[]'::jsonb
  ) INTO v_members
  FROM public.project_members pm
  JOIN public.projects p ON p.id = pm.project_id AND p.is_archived = false
  JOIN auth.users u ON u.id = pm.user_id AND u.deleted_at IS NULL
  LEFT JOIN public.crew_profiles cp ON cp.user_id = pm.user_id AND cp.is_archived = false
  WHERE private.can_manage_project_members(pm.project_id)
    AND (p_project_id IS NULL OR p_project_id = '' OR pm.project_id = p_project_id)
    AND (v_search = '' OR lower(COALESCE(u.email, '')) LIKE '%' || v_search || '%' OR lower(COALESCE(cp.full_name, '')) LIKE '%' || v_search || '%' OR lower(pm.production_role) LIKE '%' || v_search || '%');

  RETURN jsonb_build_object('projects', v_projects, 'memberships', v_members);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_upsert_project_membership(
  p_project_id text,
  p_target_user_id uuid,
  p_member_role text,
  p_production_role text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_member_role text := lower(trim(coalesce(p_member_role, 'editor')));
  v_prod_role text := left(trim(coalesce(nullif(p_production_role, ''), 'Crew Member')), 80);
  v_proj_owner uuid;
BEGIN
  IF p_project_id IS NULL OR trim(p_project_id) = '' OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Project ID dan target user wajib diisi' USING ERRCODE = '22023';
  END IF;

  IF NOT private.has_permission('projects.manage_members', p_project_id) THEN
    RAISE EXCEPTION 'Forbidden: project outside your management scope' USING ERRCODE = '42501';
  END IF;

  IF v_member_role NOT IN ('owner', 'production_admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Level akses proyek tidak valid' USING ERRCODE = '22023';
  END IF;

  IF v_member_role = 'owner' AND NOT private.is_studio_admin() THEN
    RAISE EXCEPTION 'Hanya System Admin/Owner yang dapat menetapkan member_role owner' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id INTO v_proj_owner FROM public.projects WHERE id = p_project_id AND is_archived = false;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Proyek tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_target_user_id AND deleted_at IS NULL) THEN
    RAISE EXCEPTION 'Akun target tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, member_role, production_role)
  VALUES (p_project_id, p_target_user_id, v_member_role, v_prod_role)
  ON CONFLICT (project_id, user_id) DO UPDATE SET
    member_role = EXCLUDED.member_role,
    production_role = EXCLUDED.production_role;

  PERFORM private.write_admin_audit(
    v_uid, p_target_user_id, 'project_membership_updated', 'success', 'project_membership',
    p_project_id || ':' || p_target_user_id::text, p_reason,
    jsonb_build_object('project_id', p_project_id, 'member_role', v_member_role, 'production_role', v_prod_role)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'project_id', p_project_id,
    'user_id', p_target_user_id,
    'member_role', v_member_role,
    'production_role', v_prod_role
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_remove_project_membership(
  p_project_id text,
  p_target_user_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_owner_id uuid;
BEGIN
  IF p_project_id IS NULL OR trim(p_project_id) = '' OR p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'Project ID dan target user wajib diisi' USING ERRCODE = '22023';
  END IF;

  IF NOT private.has_permission('projects.manage_members', p_project_id) THEN
    RAISE EXCEPTION 'Forbidden: project outside your management scope' USING ERRCODE = '42501';
  END IF;

  SELECT owner_id INTO v_owner_id FROM public.projects WHERE id = p_project_id;
  IF v_owner_id = p_target_user_id THEN
    RAISE EXCEPTION 'Tidak dapat mencabut keanggotaan pemilik utama proyek (owner_id)' USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.project_members
  WHERE project_id = p_project_id
    AND user_id = p_target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Keanggotaan proyek tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  -- Project data (projects, script_lines, takes, storage) is intentionally preserved untouched.
  PERFORM private.write_admin_audit(
    v_uid, p_target_user_id, 'project_membership_removed', 'success', 'project_membership',
    p_project_id || ':' || p_target_user_id::text, p_reason,
    jsonb_build_object('project_id', p_project_id)
  );

  RETURN jsonb_build_object('ok', true, 'project_id', p_project_id, 'user_id', p_target_user_id);
END;
$$;

-- 11.10 Sessions & Devices (provider-backed auth.sessions, masked IP)
CREATE OR REPLACE FUNCTION public.admin_list_sessions(
  p_target_user_id uuid DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_can_all boolean := private.has_permission('sessions.read_all', NULL);
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_current_sid uuid;
  v_claims text;
  v_sid_text text;
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT v_can_all AND NOT private.has_permission('sessions.read_own', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to list sessions' USING ERRCODE = '42501';
  END IF;

  IF NOT v_can_all AND p_target_user_id IS NOT NULL AND p_target_user_id <> v_uid THEN
    RAISE EXCEPTION 'Forbidden: cannot inspect sessions of another user' USING ERRCODE = '42501';
  END IF;

  v_claims := current_setting('request.jwt.claims', true);
  IF v_claims IS NOT NULL AND v_claims <> '' THEN
    v_sid_text := nullif(trim(coalesce(v_claims::jsonb ->> 'session_id', '')), '');
    IF v_sid_text IS NOT NULL AND v_sid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_current_sid := v_sid_text::uuid;
    END IF;
  END IF;

  WITH visible_sessions AS (
    SELECT
      s.id AS session_id,
      s.user_id,
      COALESCE(u.email, '') AS email,
      COALESCE(cp.full_name, split_part(COALESCE(u.email, ''), '@', 1)) AS full_name,
      private.get_user_system_role(s.user_id) AS system_role,
      s.created_at,
      s.updated_at,
      s.refreshed_at::timestamptz AS refreshed_at,
      s.not_after,
      left(coalesce(s.user_agent, ''), 300) AS user_agent,
      CASE
        WHEN s.ip IS NULL THEN 'IP tidak tercatat'
        WHEN family(s.ip) = 4 THEN regexp_replace(host(s.ip), '\.\d+$', '.xxx')
        ELSE regexp_replace(host(s.ip), ':[0-9a-fA-F:]+$', ':xxxx')
      END AS ip_masked,
      coalesce(s.aal::text, 'aal1') AS aal,
      (v_current_sid IS NOT NULL AND s.id = v_current_sid) AS is_current
    FROM auth.sessions s
    JOIN auth.users u ON u.id = s.user_id AND u.deleted_at IS NULL
    LEFT JOIN public.crew_profiles cp ON cp.user_id = s.user_id AND cp.is_archived = false
    WHERE (s.not_after IS NULL OR s.not_after > now())
      AND (
        (v_can_all AND (p_target_user_id IS NULL OR s.user_id = p_target_user_id))
        OR (NOT v_can_all AND s.user_id = v_uid)
      )
  )
  SELECT
    (SELECT count(*)::int FROM visible_sessions),
    COALESCE(
      (
        SELECT jsonb_agg(row_to_json(paged))
        FROM (
          SELECT * FROM visible_sessions
          ORDER BY is_current DESC, coalesce(refreshed_at, updated_at, created_at) DESC
          LIMIT v_lim OFFSET v_off
        ) paged
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object(
    'scope', CASE WHEN v_can_all THEN 'global' ELSE 'own' END,
    'total', v_total,
    'sessions', v_rows
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_session(
  p_session_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_actor_role text := private.get_user_system_role(v_uid);
  v_target_uid uuid;
  v_target_role text;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id wajib diisi' USING ERRCODE = '22023';
  END IF;

  SELECT user_id INTO v_target_uid FROM auth.sessions WHERE id = p_session_id;
  IF v_target_uid IS NULL THEN
    RAISE EXCEPTION 'Sesi tidak ditemukan atau sudah berakhir' USING ERRCODE = '22023';
  END IF;

  IF v_target_uid = v_uid THEN
    IF NOT private.has_permission('sessions.revoke_own', NULL) THEN
      RAISE EXCEPTION 'Forbidden' USING ERRCODE = '42501';
    END IF;
  ELSE
    IF NOT private.has_permission('sessions.revoke_user_sessions', NULL) THEN
      PERFORM private.write_admin_audit(v_uid, v_target_uid, 'session_revoke_denied', 'blocked', 'session', left(p_session_id::text, 8), p_reason, '{}'::jsonb);
      RAISE EXCEPTION 'Forbidden: insufficient permission to revoke another user session' USING ERRCODE = '42501';
    END IF;
    v_target_role := private.get_user_system_role(v_target_uid);
    IF v_target_role = 'system_owner' AND v_actor_role <> 'system_owner' THEN
      RAISE EXCEPTION 'Hanya System Owner yang dapat mencabut sesi System Owner' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM auth.sessions WHERE id = p_session_id;

  PERFORM private.write_admin_audit(
    v_uid, v_target_uid, 'admin_session_revoked', 'success', 'session', left(p_session_id::text, 8),
    p_reason, jsonb_build_object('revoked_session_prefix', left(p_session_id::text, 8))
  );

  RETURN jsonb_build_object('ok', true, 'revoked_session_id', p_session_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_revoke_user_sessions(
  p_target_user_id uuid,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_actor_role text := private.get_user_system_role(v_uid);
  v_target_role text;
  v_claims text;
  v_current_sid uuid;
  v_sid_text text;
  v_count int := 0;
BEGIN
  IF p_target_user_id IS NULL THEN
    RAISE EXCEPTION 'target_user_id wajib diisi' USING ERRCODE = '22023';
  END IF;

  IF p_target_user_id <> v_uid AND NOT private.has_permission('sessions.revoke_user_sessions', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to revoke user sessions' USING ERRCODE = '42501';
  END IF;

  v_target_role := private.get_user_system_role(p_target_user_id);
  IF p_target_user_id <> v_uid AND v_target_role = 'system_owner' AND v_actor_role <> 'system_owner' THEN
    RAISE EXCEPTION 'Hanya System Owner yang dapat mencabut seluruh sesi System Owner' USING ERRCODE = '42501';
  END IF;

  v_claims := current_setting('request.jwt.claims', true);
  IF v_claims IS NOT NULL AND v_claims <> '' THEN
    v_sid_text := nullif(trim(coalesce(v_claims::jsonb ->> 'session_id', '')), '');
    IF v_sid_text IS NOT NULL AND v_sid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
      v_current_sid := v_sid_text::uuid;
    END IF;
  END IF;

  DELETE FROM auth.sessions
  WHERE user_id = p_target_user_id
    AND (p_target_user_id <> v_uid OR v_current_sid IS NULL OR id <> v_current_sid);
  GET DIAGNOSTICS v_count = ROW_COUNT;

  PERFORM private.write_admin_audit(
    v_uid, p_target_user_id, 'user_sessions_revoked_all', 'success', 'account', p_target_user_id::text,
    p_reason, jsonb_build_object('revoked_count', v_count)
  );

  RETURN jsonb_build_object('ok', true, 'user_id', p_target_user_id, 'revoked_count', v_count);
END;
$$;

-- 11.11 Invitations (hashed token, single-use, strict role ceiling)
CREATE OR REPLACE FUNCTION public.admin_list_invitations(
  p_status text DEFAULT 'all',
  p_project_id text DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_is_global boolean := private.is_studio_admin();
  v_status text := lower(trim(coalesce(p_status, 'all')));
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.has_permission('accounts.invite', p_project_id) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to view invitations' USING ERRCODE = '42501';
  END IF;

  WITH scoped_invites AS (
    SELECT
      pi.id,
      pi.email,
      pi.project_id,
      COALESCE(p.code, '-') AS project_code,
      COALESCE(p.title, 'Akses Sistem') AS project_title,
      pi.member_role,
      pi.production_role,
      pi.target_system_role,
      CASE
        WHEN pi.status = 'pending' AND pi.expires_at <= now() THEN 'expired'
        ELSE pi.status
      END AS effective_status,
      pi.invited_by,
      COALESCE(iu.email, '') AS invited_by_email,
      pi.note,
      pi.expires_at,
      pi.accepted_at,
      pi.revoked_at,
      pi.created_at
    FROM public.project_invitations pi
    LEFT JOIN public.projects p ON p.id = pi.project_id
    LEFT JOIN auth.users iu ON iu.id = pi.invited_by
    WHERE (
      v_is_global
      OR (pi.project_id IS NOT NULL AND private.can_manage_project_members(pi.project_id))
    )
    AND (p_project_id IS NULL OR p_project_id = '' OR pi.project_id = p_project_id)
  ),
  filtered AS (
    SELECT * FROM scoped_invites
    WHERE v_status = 'all' OR effective_status = v_status
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(
      (
        SELECT jsonb_agg(row_to_json(paged))
        FROM (
          SELECT * FROM filtered ORDER BY created_at DESC LIMIT v_lim OFFSET v_off
        ) paged
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'invitations', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_invitation(
  p_email text,
  p_project_id text DEFAULT NULL,
  p_member_role text DEFAULT 'editor',
  p_production_role text DEFAULT 'Crew Member',
  p_target_system_role text DEFAULT 'crew_member',
  p_expiry_hours integer DEFAULT NULL,
  p_note text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_actor_role text := private.get_user_system_role(v_uid);
  v_email text := lower(trim(coalesce(p_email, '')));
  v_project_id text := nullif(trim(coalesce(p_project_id, '')), '');
  v_member_role text := lower(trim(coalesce(p_member_role, 'editor')));
  v_prod_role text := left(trim(coalesce(nullif(p_production_role, ''), 'Crew Member')), 80);
  v_sys_role text := lower(trim(coalesce(p_target_system_role, 'crew_member')));
  v_default_hours integer;
  v_hours integer;
  v_raw_token text;
  v_token_hash text;
  v_inv_id uuid;
  v_expires_at timestamptz;
BEGIN
  IF v_email = '' OR v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' THEN
    RAISE EXCEPTION 'Format email undangan tidak valid' USING ERRCODE = '22023';
  END IF;

  IF NOT private.has_permission('accounts.invite', v_project_id) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to create invitation' USING ERRCODE = '42501';
  END IF;

  IF v_project_id IS NULL AND v_actor_role NOT IN ('system_owner', 'system_admin') THEN
    RAISE EXCEPTION 'Production Admin wajib menentukan proyek tujuan undangan' USING ERRCODE = '42501';
  END IF;

  IF v_project_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.projects WHERE id = v_project_id AND is_archived = false) THEN
    RAISE EXCEPTION 'Proyek tujuan tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  IF v_member_role NOT IN ('production_admin', 'editor', 'viewer') THEN
    RAISE EXCEPTION 'Level akses proyek tidak valid' USING ERRCODE = '22023';
  END IF;

  IF v_sys_role NOT IN ('system_admin', 'production_admin', 'crew_member', 'viewer') THEN
    RAISE EXCEPTION 'Target system role tidak valid untuk undangan' USING ERRCODE = '22023';
  END IF;

  -- Role ceilings: only system_owner can invite system_admin; production_admin can only invite crew_member/viewer as editor/viewer
  IF v_actor_role <> 'system_owner' AND v_sys_role = 'system_admin' THEN
    RAISE EXCEPTION 'Hanya System Owner yang dapat mengundang sebagai System Admin' USING ERRCODE = '42501';
  END IF;

  IF v_actor_role NOT IN ('system_owner', 'system_admin') AND (v_sys_role NOT IN ('crew_member', 'viewer') OR v_member_role = 'production_admin') THEN
    RAISE EXCEPTION 'Production Admin hanya dapat mengundang anggota dengan akses editor atau viewer' USING ERRCODE = '42501';
  END IF;

  SELECT invitation_expiry_hours INTO v_default_hours FROM public.admin_security_settings WHERE id = 1;
  v_hours := LEAST(GREATEST(COALESCE(p_expiry_hours, v_default_hours, 72), 1), 720);
  v_expires_at := now() + make_interval(hours => v_hours);

  -- Revoke any prior pending invitation for same email & project
  UPDATE public.project_invitations
  SET status = 'revoked', revoked_at = now()
  WHERE lower(email) = v_email
    AND COALESCE(project_id, '') = COALESCE(v_project_id, '')
    AND status = 'pending';

  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(convert_to(v_raw_token, 'UTF8'), 'sha256'), 'hex');

  INSERT INTO public.project_invitations (
    email, project_id, member_role, production_role, target_system_role,
    token_hash, status, invited_by, note, expires_at
  ) VALUES (
    v_email, v_project_id, v_member_role, v_prod_role, v_sys_role,
    v_token_hash, 'pending', v_uid, left(trim(coalesce(p_note, '')), 240), v_expires_at
  )
  RETURNING id INTO v_inv_id;

  PERFORM private.write_admin_audit(
    v_uid, NULL, 'invitation_created', 'success', 'invitation', v_inv_id::text,
    p_note, jsonb_build_object('email', v_email, 'project_id', v_project_id, 'member_role', v_member_role, 'production_role', v_prod_role, 'target_system_role', v_sys_role)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invitation_id', v_inv_id,
    'email', v_email,
    'project_id', v_project_id,
    'expires_at', v_expires_at,
    'one_time_token', v_raw_token
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_manage_invitation(
  p_invitation_id uuid,
  p_action text,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_action text := lower(trim(coalesce(p_action, '')));
  v_inv record;
  v_default_hours integer;
  v_raw_token text;
  v_token_hash text;
  v_expires_at timestamptz;
BEGIN
  IF p_invitation_id IS NULL OR v_action NOT IN ('revoke', 'resend') THEN
    RAISE EXCEPTION 'Permintaan pengelolaan undangan tidak valid' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_inv FROM public.project_invitations WHERE id = p_invitation_id;
  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan' USING ERRCODE = '22023';
  END IF;

  IF NOT private.has_permission('accounts.invite', v_inv.project_id) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to manage invitation' USING ERRCODE = '42501';
  END IF;

  IF v_inv.status = 'accepted' THEN
    RAISE EXCEPTION 'Undangan yang sudah diterima tidak dapat diubah' USING ERRCODE = '22023';
  END IF;

  IF v_action = 'revoke' THEN
    UPDATE public.project_invitations
    SET status = 'revoked', revoked_at = now()
    WHERE id = p_invitation_id;

    PERFORM private.write_admin_audit(
      v_uid, NULL, 'invitation_revoked', 'success', 'invitation', p_invitation_id::text,
      p_reason, jsonb_build_object('email', v_inv.email, 'project_id', v_inv.project_id)
    );

    RETURN jsonb_build_object('ok', true, 'invitation_id', p_invitation_id, 'status', 'revoked');
  END IF;

  -- resend: rotate token and extend expiry
  SELECT invitation_expiry_hours INTO v_default_hours FROM public.admin_security_settings WHERE id = 1;
  v_expires_at := now() + make_interval(hours => COALESCE(v_default_hours, 72));
  v_raw_token := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_hash := encode(extensions.digest(convert_to(v_raw_token, 'UTF8'), 'sha256'), 'hex');

  UPDATE public.project_invitations
  SET
    token_hash = v_token_hash,
    status = 'pending',
    expires_at = v_expires_at,
    revoked_at = NULL
  WHERE id = p_invitation_id;

  PERFORM private.write_admin_audit(
    v_uid, NULL, 'invitation_resent', 'success', 'invitation', p_invitation_id::text,
    p_reason, jsonb_build_object('email', v_inv.email, 'project_id', v_inv.project_id)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invitation_id', p_invitation_id,
    'status', 'pending',
    'expires_at', v_expires_at,
    'one_time_token', v_raw_token
  );
END;
$$;

-- Single-use invitation acceptance (email-matched, verified, prevents role tampering)
CREATE OR REPLACE FUNCTION public.accept_project_invitation(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
  v_user_email text;
  v_token_hash text;
  v_inv record;
  v_cur_role text;
  v_cur_rank int;
  v_target_rank int;
BEGIN
  IF v_uid IS NULL OR NOT private.is_account_active(v_uid) THEN
    RAISE EXCEPTION 'Autentikasi aktif diperlukan untuk menerima undangan' USING ERRCODE = '42501';
  END IF;

  IF p_token IS NULL OR length(trim(p_token)) < 32 THEN
    RAISE EXCEPTION 'Token undangan tidak valid' USING ERRCODE = '22023';
  END IF;

  SELECT lower(email) INTO v_user_email FROM auth.users WHERE id = v_uid AND deleted_at IS NULL;
  v_token_hash := encode(extensions.digest(convert_to(trim(p_token), 'UTF8'), 'sha256'), 'hex');

  SELECT * INTO v_inv
  FROM public.project_invitations
  WHERE token_hash = v_token_hash
  FOR UPDATE;

  IF v_inv.id IS NULL THEN
    RAISE EXCEPTION 'Undangan tidak ditemukan atau token tidak valid' USING ERRCODE = '22023';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Undangan sudah tidak berlaku (status: %)', v_inv.status USING ERRCODE = '22023';
  END IF;

  IF v_inv.expires_at <= now() THEN
    UPDATE public.project_invitations SET status = 'expired' WHERE id = v_inv.id;
    RAISE EXCEPTION 'Undangan telah kedaluwarsa' USING ERRCODE = '22023';
  END IF;

  IF lower(v_inv.email) <> COALESCE(v_user_email, '') THEN
    PERFORM private.write_admin_audit(v_uid, v_uid, 'invitation_email_mismatch', 'blocked', 'invitation', v_inv.id::text, '', jsonb_build_object('invited_email', v_inv.email));
    RAISE EXCEPTION 'Email akun yang masuk tidak cocok dengan email tujuan undangan' USING ERRCODE = '42501';
  END IF;

  -- Apply project membership if project_id present
  IF v_inv.project_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, member_role, production_role)
    VALUES (v_inv.project_id, v_uid, v_inv.member_role, v_inv.production_role)
    ON CONFLICT (project_id, user_id) DO UPDATE SET
      member_role = EXCLUDED.member_role,
      production_role = EXCLUDED.production_role;
  END IF;

  -- Only upgrade system role if invitation target rank exceeds current rank (never downgrade an existing owner/admin)
  v_cur_role := private.get_user_system_role(v_uid);
  SELECT rank INTO v_cur_rank FROM public.system_roles WHERE role_key = v_cur_role;
  SELECT rank INTO v_target_rank FROM public.system_roles WHERE role_key = v_inv.target_system_role;

  IF COALESCE(v_target_rank, 0) > COALESCE(v_cur_rank, 0) THEN
    INSERT INTO public.user_system_roles (user_id, system_role, assigned_by, reason)
    VALUES (v_uid, v_inv.target_system_role, v_inv.invited_by, 'Diterima melalui undangan')
    ON CONFLICT (user_id) DO UPDATE SET
      system_role = EXCLUDED.system_role,
      assigned_by = EXCLUDED.assigned_by,
      assigned_at = now(),
      reason = EXCLUDED.reason;

    IF v_inv.target_system_role IN ('system_owner', 'system_admin') THEN
      UPDATE public.crew_profiles SET is_studio_admin = true WHERE user_id = v_uid AND is_archived = false;
    END IF;
  END IF;

  UPDATE public.project_invitations
  SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
  WHERE id = v_inv.id;

  PERFORM private.write_admin_audit(
    v_uid, v_uid, 'invitation_accepted', 'success', 'invitation', v_inv.id::text,
    '', jsonb_build_object('project_id', v_inv.project_id, 'member_role', v_inv.member_role, 'production_role', v_inv.production_role)
  );

  RETURN jsonb_build_object(
    'ok', true,
    'invitation_id', v_inv.id,
    'project_id', v_inv.project_id,
    'member_role', v_inv.member_role,
    'production_role', v_inv.production_role
  );
END;
$$;

-- 11.12 Audit Logs query (paginated, filterable, read-only)
CREATE OR REPLACE FUNCTION public.admin_list_audit_logs(
  p_event_type text DEFAULT 'all',
  p_status text DEFAULT 'all',
  p_target_type text DEFAULT 'all',
  p_search text DEFAULT '',
  p_from timestamptz DEFAULT NULL,
  p_to timestamptz DEFAULT NULL,
  p_limit integer DEFAULT 30,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_event text := lower(trim(coalesce(p_event_type, 'all')));
  v_status text := lower(trim(coalesce(p_status, 'all')));
  v_target_type text := lower(trim(coalesce(p_target_type, 'all')));
  v_search text := lower(trim(coalesce(p_search, '')));
  v_lim integer := LEAST(GREATEST(COALESCE(p_limit, 30), 1), 100);
  v_off integer := GREATEST(COALESCE(p_offset, 0), 0);
  v_total integer := 0;
  v_rows jsonb := '[]'::jsonb;
BEGIN
  IF NOT private.has_permission('audit.read', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to read audit logs' USING ERRCODE = '42501';
  END IF;

  WITH filtered AS (
    SELECT
      sal.id,
      sal.user_id,
      sal.actor_id,
      COALESCE(au.email, '') AS actor_email,
      COALESCE(tu.email, '') AS target_email,
      sal.event_type,
      sal.status,
      sal.target_type,
      sal.target_id,
      sal.reason,
      sal.metadata,
      sal.created_at
    FROM public.security_audit_logs sal
    LEFT JOIN auth.users au ON au.id = sal.actor_id
    LEFT JOIN auth.users tu ON tu.id = sal.user_id
    WHERE (v_event = 'all' OR sal.event_type = v_event)
      AND (v_status = 'all' OR sal.status = v_status)
      AND (v_target_type = 'all' OR sal.target_type = v_target_type)
      AND (p_from IS NULL OR sal.created_at >= p_from)
      AND (p_to IS NULL OR sal.created_at <= p_to)
      AND (
        v_search = ''
        OR lower(sal.event_type) LIKE '%' || v_search || '%'
        OR lower(COALESCE(au.email, '')) LIKE '%' || v_search || '%'
        OR lower(COALESCE(tu.email, '')) LIKE '%' || v_search || '%'
        OR lower(sal.target_id) LIKE '%' || v_search || '%'
        OR lower(sal.reason) LIKE '%' || v_search || '%'
      )
  )
  SELECT
    (SELECT count(*)::int FROM filtered),
    COALESCE(
      (
        SELECT jsonb_agg(row_to_json(paged))
        FROM (
          SELECT * FROM filtered ORDER BY created_at DESC LIMIT v_lim OFFSET v_off
        ) paged
      ),
      '[]'::jsonb
    )
  INTO v_total, v_rows;

  RETURN jsonb_build_object('total', v_total, 'limit', v_lim, 'offset', v_off, 'logs', v_rows);
END;
$$;

-- 11.13 App-Managed Security Settings
CREATE OR REPLACE FUNCTION public.admin_get_security_settings()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_row record;
  v_updated_by_email text;
BEGIN
  IF NOT private.has_permission('security.read', NULL) THEN
    RAISE EXCEPTION 'Forbidden: insufficient permission to view security settings' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO v_row FROM public.admin_security_settings WHERE id = 1;
  IF v_row.updated_by IS NOT NULL THEN
    SELECT email INTO v_updated_by_email FROM auth.users WHERE id = v_row.updated_by;
  END IF;

  RETURN jsonb_build_object(
    'invitation_expiry_hours', COALESCE(v_row.invitation_expiry_hours, 72),
    'min_password_length', COALESCE(v_row.min_password_length, 12),
    'require_reauth_role_change', COALESCE(v_row.require_reauth_role_change, true),
    'allow_crew_self_signup', COALESCE(v_row.allow_crew_self_signup, true),
    'session_idle_minutes', COALESCE(v_row.session_idle_minutes, 30),
    'updated_at', v_row.updated_at,
    'updated_by_email', COALESCE(v_updated_by_email, '')
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_security_settings(
  p_invitation_expiry_hours integer,
  p_min_password_length integer,
  p_require_reauth_role_change boolean,
  p_allow_crew_self_signup boolean,
  p_session_idle_minutes integer,
  p_reason text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_uid uuid := (select auth.uid());
BEGIN
  IF NOT private.has_permission('security.manage', NULL) THEN
    PERFORM private.write_admin_audit(v_uid, v_uid, 'security_settings_denied', 'blocked', 'security', '1', p_reason, '{}'::jsonb);
    RAISE EXCEPTION 'Forbidden: hanya System Owner yang dapat mengubah pengaturan keamanan' USING ERRCODE = '42501';
  END IF;

  IF p_invitation_expiry_hours < 1 OR p_invitation_expiry_hours > 720 THEN
    RAISE EXCEPTION 'Masa berlaku undangan harus antara 1 dan 720 jam' USING ERRCODE = '22023';
  END IF;

  IF p_min_password_length < 12 OR p_min_password_length > 64 THEN
    RAISE EXCEPTION 'Panjang minimum kata sandi harus antara 12 dan 64 karakter' USING ERRCODE = '22023';
  END IF;

  IF p_session_idle_minutes < 5 OR p_session_idle_minutes > 480 THEN
    RAISE EXCEPTION 'Idle timeout sesi harus antara 5 dan 480 menit' USING ERRCODE = '22023';
  END IF;

  UPDATE public.admin_security_settings
  SET
    invitation_expiry_hours = p_invitation_expiry_hours,
    min_password_length = p_min_password_length,
    require_reauth_role_change = COALESCE(p_require_reauth_role_change, true),
    allow_crew_self_signup = COALESCE(p_allow_crew_self_signup, true),
    session_idle_minutes = p_session_idle_minutes,
    updated_at = now(),
    updated_by = v_uid
  WHERE id = 1;

  PERFORM private.write_admin_audit(
    v_uid, v_uid, 'security_settings_updated', 'success', 'security', '1', p_reason,
    jsonb_build_object(
      'invitation_expiry_hours', p_invitation_expiry_hours,
      'min_password_length', p_min_password_length,
      'require_reauth_role_change', p_require_reauth_role_change,
      'allow_crew_self_signup', p_allow_crew_self_signup,
      'session_idle_minutes', p_session_idle_minutes
    )
  );

  RETURN public.admin_get_security_settings();
END;
$$;

-- 12. Revoke PUBLIC/anon and grant EXECUTE strictly to authenticated on public RPCs
REVOKE ALL ON FUNCTION public.admin_get_my_access() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_overview() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_accounts(text, text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_account_detail(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_account_profile(uuid, text, text, text, text, jsonb, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_account_status(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_roles_permissions() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_assign_system_role(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_project_memberships(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_upsert_project_membership(text, uuid, text, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_remove_project_membership(text, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_sessions(uuid, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_session(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_revoke_user_sessions(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_invitations(text, text, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_create_invitation(text, text, text, text, text, integer, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_manage_invitation(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.accept_project_invitation(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_audit_logs(text, text, text, text, timestamptz, timestamptz, integer, integer) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_get_security_settings() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_update_security_settings(integer, integer, boolean, boolean, integer, text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_get_my_access() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_overview() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_accounts(text, text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_account_detail(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_account_profile(uuid, text, text, text, text, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_account_status(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_roles_permissions() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_assign_system_role(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_project_memberships(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_upsert_project_membership(text, uuid, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_remove_project_membership(text, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_sessions(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_session(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_revoke_user_sessions(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_invitations(text, text, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_create_invitation(text, text, text, text, text, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_manage_invitation(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_project_invitation(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_audit_logs(text, text, text, text, timestamptz, timestamptz, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_get_security_settings() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_security_settings(integer, integer, boolean, boolean, integer, text) TO authenticated;
