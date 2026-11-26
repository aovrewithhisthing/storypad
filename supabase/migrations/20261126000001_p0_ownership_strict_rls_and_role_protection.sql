-- StoryPad Phase P0 Migration: Project Ownership, Membership, Strict RLS, Role Protection & Storage Lockdown
-- Apply via Supabase Dashboard SQL Editor or `supabase db push`.
-- Safe and idempotent across repeated runs.

-- 1. Private schema for SECURITY DEFINER helpers (not exposed to PostgREST Data API)
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC;
GRANT USAGE ON SCHEMA private TO authenticated, service_role;

-- 2. Project ownership & explicit membership
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS idx_projects_owner_id ON public.projects(owner_id);

CREATE TABLE IF NOT EXISTS public.project_members (
  project_id text NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_role text NOT NULL DEFAULT 'editor' CHECK (member_role IN ('owner', 'editor', 'viewer')),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

-- 3. Crew profiles role separation & legacy cleanup
ALTER TABLE public.crew_profiles
  ADD COLUMN IF NOT EXISTS granted_roles jsonb NOT NULL DEFAULT '{"scriptSupervisor": true, "videoEditor": true, "soundRecordist": false, "directorProducer": false, "autoExportMeta": true}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_studio_admin boolean NOT NULL DEFAULT false;

UPDATE public.crew_profiles
SET granted_roles = COALESCE(roles, granted_roles)
WHERE id IS NOT NULL;

UPDATE public.crew_profiles
SET is_archived = true
WHERE user_id IS NULL
  AND lower(email) IN (
    'aulia@lifelikepictures.com',
    'dimas.edit@lifelikepictures.com',
    'sound.rama@lifelikepictures.com'
  );

CREATE UNIQUE INDEX IF NOT EXISTS crew_profiles_user_id_uniq
  ON public.crew_profiles (user_id)
  WHERE user_id IS NOT NULL;

-- 4. Notifications scoping
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  ADD COLUMN IF NOT EXISTS project_id text REFERENCES public.projects(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_project_id ON public.notifications(project_id);

-- 5. Assign existing unowned active records to existing real auth user if present
DO $$
DECLARE
  v_uid uuid := '25569f84-ddad-40ae-ace0-aebc9c86d9b7';
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_uid) THEN
    UPDATE public.projects
    SET owner_id = v_uid
    WHERE owner_id IS NULL AND is_archived = false;

    INSERT INTO public.project_members (project_id, user_id, member_role)
    SELECT id, v_uid, 'owner'
    FROM public.projects
    WHERE owner_id = v_uid
    ON CONFLICT (project_id, user_id) DO NOTHING;

    UPDATE public.notifications
    SET user_id = v_uid
    WHERE user_id IS NULL AND is_archived = false;
  END IF;
END $$;

-- 6. Drop duplicate indexes flagged by Performance Advisor
DROP INDEX IF EXISTS public.idx_script_lines_project_sort;
DROP INDEX IF EXISTS public.idx_takes_project_id;

-- 7. Private SECURITY DEFINER helpers
CREATE OR REPLACE FUNCTION private.is_studio_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (select auth.uid()) IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.crew_profiles cp
      WHERE cp.user_id = (select auth.uid())
        AND cp.is_studio_admin = true
        AND cp.is_archived = false
    );
$$;

CREATE OR REPLACE FUNCTION private.can_access_project(p_project_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT (select auth.uid()) IS NOT NULL
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
          AND pm.member_role IN ('owner', 'editor')
      )
    );
$$;

REVOKE ALL ON FUNCTION private.is_studio_admin() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_access_project(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION private.can_edit_project(text) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION private.is_studio_admin() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_access_project(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION private.can_edit_project(text) TO authenticated, service_role;

-- 8. Triggers for role non-escalation and project ownership enforcement
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
       OR NEW.granted_roles IS DISTINCT FROM OLD.granted_roles THEN
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

DROP TRIGGER IF EXISTS trg_enforce_crew_profile_security ON public.crew_profiles;
CREATE TRIGGER trg_enforce_crew_profile_security
  BEFORE UPDATE ON public.crew_profiles
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_crew_profile_security();

CREATE OR REPLACE FUNCTION private.enforce_project_owner()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF current_user IN ('authenticated', 'anon') AND NOT private.is_studio_admin() THEN
      NEW.owner_id := (select auth.uid());
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF current_user IN ('authenticated', 'anon') AND NOT private.is_studio_admin() THEN
      IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
        RAISE EXCEPTION 'Cannot reassign project owner' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_project_owner ON public.projects;
CREATE TRIGGER trg_enforce_project_owner
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.enforce_project_owner();

CREATE OR REPLACE FUNCTION private.add_project_owner_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.owner_id IS NOT NULL THEN
    INSERT INTO public.project_members (project_id, user_id, member_role)
    VALUES (NEW.id, NEW.owner_id, 'owner')
    ON CONFLICT (project_id, user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_add_project_owner_member ON public.projects;
CREATE TRIGGER trg_add_project_owner_member
  AFTER INSERT ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION private.add_project_owner_member();

-- 9. Hardened handle_new_auth_user trigger (no email auto-linking, no legacy defaults, least-privilege roles)
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
    studio, prod_name, email, roles, granted_roles, is_studio_admin, is_archived
  ) VALUES (
    new.id, v_persona, v_name, v_initials, v_role_title, v_badge,
    v_studio, '-', v_email, v_roles, v_roles, false, false
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

  RETURN new;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC, anon, authenticated;

-- 10. Strict RLS policies (zero anon access)
DROP POLICY IF EXISTS crew_profiles_studio_access ON public.crew_profiles;
DROP POLICY IF EXISTS projects_studio_access ON public.projects;
DROP POLICY IF EXISTS script_lines_studio_access ON public.script_lines;
DROP POLICY IF EXISTS takes_studio_access ON public.takes;
DROP POLICY IF EXISTS notifications_studio_access ON public.notifications;

-- crew_profiles
DROP POLICY IF EXISTS crew_profiles_auth_select ON public.crew_profiles;
DROP POLICY IF EXISTS crew_profiles_auth_insert ON public.crew_profiles;
DROP POLICY IF EXISTS crew_profiles_auth_update ON public.crew_profiles;

CREATE POLICY crew_profiles_auth_select ON public.crew_profiles
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id OR private.is_studio_admin());

CREATE POLICY crew_profiles_auth_insert ON public.crew_profiles
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id OR private.is_studio_admin());

CREATE POLICY crew_profiles_auth_update ON public.crew_profiles
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id OR private.is_studio_admin())
  WITH CHECK ((select auth.uid()) = user_id OR private.is_studio_admin());

-- projects
DROP POLICY IF EXISTS projects_auth_select ON public.projects;
DROP POLICY IF EXISTS projects_auth_insert ON public.projects;
DROP POLICY IF EXISTS projects_auth_update ON public.projects;

CREATE POLICY projects_auth_select ON public.projects
  FOR SELECT TO authenticated
  USING (private.can_access_project(id));

CREATE POLICY projects_auth_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = (select auth.uid()) OR private.is_studio_admin());

CREATE POLICY projects_auth_update ON public.projects
  FOR UPDATE TO authenticated
  USING (private.can_edit_project(id))
  WITH CHECK (private.can_edit_project(id));

-- project_members
DROP POLICY IF EXISTS project_members_auth_select ON public.project_members;
DROP POLICY IF EXISTS project_members_auth_insert ON public.project_members;
DROP POLICY IF EXISTS project_members_auth_update ON public.project_members;
DROP POLICY IF EXISTS project_members_auth_delete ON public.project_members;

CREATE POLICY project_members_auth_select ON public.project_members
  FOR SELECT TO authenticated
  USING (user_id = (select auth.uid()) OR private.can_access_project(project_id));

CREATE POLICY project_members_auth_insert ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = (select auth.uid()))
    OR private.is_studio_admin()
  );

CREATE POLICY project_members_auth_update ON public.project_members
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = (select auth.uid()))
    OR private.is_studio_admin()
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = (select auth.uid()))
    OR private.is_studio_admin()
  );

CREATE POLICY project_members_auth_delete ON public.project_members
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_id AND p.owner_id = (select auth.uid()))
    OR private.is_studio_admin()
  );

-- script_lines
DROP POLICY IF EXISTS script_lines_auth_select ON public.script_lines;
DROP POLICY IF EXISTS script_lines_auth_insert ON public.script_lines;
DROP POLICY IF EXISTS script_lines_auth_update ON public.script_lines;

CREATE POLICY script_lines_auth_select ON public.script_lines
  FOR SELECT TO authenticated
  USING (private.can_access_project(project_id));

CREATE POLICY script_lines_auth_insert ON public.script_lines
  FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_project(project_id));

CREATE POLICY script_lines_auth_update ON public.script_lines
  FOR UPDATE TO authenticated
  USING (private.can_edit_project(project_id))
  WITH CHECK (private.can_edit_project(project_id));

-- takes
DROP POLICY IF EXISTS takes_auth_select ON public.takes;
DROP POLICY IF EXISTS takes_auth_insert ON public.takes;
DROP POLICY IF EXISTS takes_auth_update ON public.takes;

CREATE POLICY takes_auth_select ON public.takes
  FOR SELECT TO authenticated
  USING (private.can_access_project(project_id));

CREATE POLICY takes_auth_insert ON public.takes
  FOR INSERT TO authenticated
  WITH CHECK (private.can_edit_project(project_id));

CREATE POLICY takes_auth_update ON public.takes
  FOR UPDATE TO authenticated
  USING (private.can_edit_project(project_id))
  WITH CHECK (private.can_edit_project(project_id));

-- notifications
DROP POLICY IF EXISTS notifications_auth_select ON public.notifications;
DROP POLICY IF EXISTS notifications_auth_insert ON public.notifications;
DROP POLICY IF EXISTS notifications_auth_update ON public.notifications;

CREATE POLICY notifications_auth_select ON public.notifications
  FOR SELECT TO authenticated
  USING (
    user_id = (select auth.uid())
    OR (project_id IS NOT NULL AND private.can_access_project(project_id))
    OR private.is_studio_admin()
  );

CREATE POLICY notifications_auth_insert ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (select auth.uid())
    AND (project_id IS NULL OR private.can_access_project(project_id))
  );

CREATE POLICY notifications_auth_update ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (select auth.uid()) OR private.is_studio_admin())
  WITH CHECK (user_id = (select auth.uid()) OR private.is_studio_admin());

-- 11. Storage bucket storypad-media lockdown (private + project-scoped RLS)
UPDATE storage.buckets
SET public = false
WHERE id = 'storypad-media';

DROP POLICY IF EXISTS storypad_media_insert ON storage.objects;
DROP POLICY IF EXISTS storypad_media_select ON storage.objects;
DROP POLICY IF EXISTS storypad_media_update ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_select ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_insert ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_update ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_delete ON storage.objects;

CREATE POLICY storypad_media_auth_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'storypad-media'
    AND private.can_access_project((storage.foldername(name))[1])
  );

CREATE POLICY storypad_media_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'storypad-media'
    AND private.can_edit_project((storage.foldername(name))[1])
  );

CREATE POLICY storypad_media_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'storypad-media'
    AND private.can_edit_project((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'storypad-media'
    AND private.can_edit_project((storage.foldername(name))[1])
  );

CREATE POLICY storypad_media_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'storypad-media'
    AND private.can_edit_project((storage.foldername(name))[1])
  );
