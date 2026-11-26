-- StoryPad Fix Migration: Projects RLS upsert/select catch-22 & active-account enforcement
-- Apply via Supabase Dashboard SQL Editor or `supabase db push` AFTER migrations 000001-000004.
-- Safe and idempotent across repeated runs.

-- 1. Fix projects_auth_select so newly inserted/upserted rows owned by auth.uid()
-- pass PostgreSQL ON CONFLICT / RETURNING SELECT RLS checks directly on owner_id
-- without requiring the row or AFTER INSERT project_members trigger to exist beforehand.
DROP POLICY IF EXISTS projects_auth_select ON public.projects;
CREATE POLICY projects_auth_select ON public.projects
  FOR SELECT TO authenticated
  USING (
    private.is_account_active((select auth.uid()))
    AND (
      owner_id = (select auth.uid())
      OR private.can_access_project(id)
    )
  );

-- 2. Enforce active account check on projects INSERT as well
DROP POLICY IF EXISTS projects_auth_insert ON public.projects;
CREATE POLICY projects_auth_insert ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (
    private.is_account_active((select auth.uid()))
    AND (
      owner_id = (select auth.uid())
      OR private.is_studio_admin()
    )
  );

-- 3. Keep projects UPDATE policy aligned with private.can_edit_project(id)
-- (which already enforces private.is_account_active((select auth.uid())))
DROP POLICY IF EXISTS projects_auth_update ON public.projects;
CREATE POLICY projects_auth_update ON public.projects
  FOR UPDATE TO authenticated
  USING (private.can_edit_project(id))
  WITH CHECK (private.can_edit_project(id));
