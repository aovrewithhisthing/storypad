-- StoryPad Fix Verification Script: Projects RLS Insert/Upsert for crew_member & Account Status Enforcement
-- Non-destructive: wrapped in BEGIN; ... ROLLBACK;

BEGIN;

DO $$
DECLARE
  v_crew_a uuid := '00000000-0000-0000-0000-000000000101';
  v_crew_b uuid := '00000000-0000-0000-0000-000000000102';
  v_suspended uuid := '00000000-0000-0000-0000-000000000103';
  v_proj_id text := 'proj-verify-rls-crew-a';
  v_blocked boolean := false;
  v_cnt int := 0;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
  VALUES
    (v_crew_a, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-a-rls@storypad.test', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
    (v_crew_b, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-b-rls@storypad.test', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now()),
    (v_suspended, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'crew-susp-rls@storypad.test', '$2a$10$abcdefghijklmnopqrstuv', now(), now(), now())
  ON CONFLICT (id) DO NOTHING;

  UPDATE public.crew_profiles
  SET account_status = 'suspended'
  WHERE user_id = v_suspended;

  -- 1. Verify crew_member A can INSERT and ON CONFLICT DO UPDATE (upsert) a brand-new project & script_lines
  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew_a::text, 'role', 'authenticated')::text, true);

  INSERT INTO public.projects (
    id, code, title, category, subtitle, tag, day, fps, sync_status, draft,
    scene_number, shot_number, slug_number, scene_title, scene_timecode, take_info,
    owner_id, is_archived
  )
  VALUES (
    v_proj_id, 'RLS-01', 'Proyek Uji RLS', 'Film Pendek', 'Uji RLS', '1 Scene', 'Day 01', '24 fps', 'Ready', 'Draft v1.0',
    '01', '01', 'SCENE 01', 'SCENE 01', '00:00:00:00', '0 TAKE',
    v_crew_a, false
  )
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;

  INSERT INTO public.script_lines (
    id, project_id, line_type, sort_order, scene_number, scene_title,
    content, parenthetical, continuity_note, is_archived
  )
  VALUES (
    v_proj_id || '-s01-a01', v_proj_id, 'action', 10, '01', 'SCENE 01',
    'Uji aksi', '', '', false
  )
  ON CONFLICT (id) DO UPDATE SET content = EXCLUDED.content;

  SELECT count(*) INTO v_cnt FROM public.projects WHERE id = v_proj_id;
  IF v_cnt <> 1 THEN
    RAISE EXCEPTION 'FAIL: crew_member A could not see newly upserted project %', v_proj_id;
  END IF;

  -- 2. Verify crew_member B cannot hijack or overwrite crew_member A project via upsert
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_crew_b::text, 'role', 'authenticated')::text, true);
  v_blocked := false;
  BEGIN
    INSERT INTO public.projects (
      id, code, title, category, subtitle, tag, day, fps, sync_status, draft,
      scene_number, shot_number, slug_number, scene_title, scene_timecode, take_info,
      owner_id, is_archived
    )
    VALUES (
      v_proj_id, 'RLS-99', 'Pembajakan', 'Film Pendek', 'Hijack', '1 Scene', 'Day 01', '24 fps', 'Ready', 'Draft v1.0',
      '01', '01', 'SCENE 01', 'SCENE 01', '00:00:00:00', '0 TAKE',
      v_crew_b, false
    )
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title;
    v_blocked := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: crew_member B bypassed RLS on crew_member A project';
  END IF;

  -- 3. Verify suspended account cannot insert a project
  PERFORM set_config('request.jwt.claims', json_build_object('sub', v_suspended::text, 'role', 'authenticated')::text, true);
  v_blocked := false;
  BEGIN
    INSERT INTO public.projects (
      id, code, title, category, subtitle, tag, day, fps, sync_status, draft,
      scene_number, shot_number, slug_number, scene_title, scene_timecode, take_info,
      owner_id, is_archived
    )
    VALUES (
      'proj-verify-susp', 'SUSP-01', 'Proyek Suspended', 'Film Pendek', 'Suspended', '1 Scene', 'Day 01', '24 fps', 'Ready', 'Draft v1.0',
      '01', '01', 'SCENE 01', 'SCENE 01', '00:00:00:00', '0 TAKE',
      v_suspended, false
    );
    v_blocked := false;
  EXCEPTION WHEN SQLSTATE '42501' THEN
    v_blocked := true;
  END;
  IF NOT v_blocked THEN
    RAISE EXCEPTION 'FAIL: suspended user was allowed to insert into public.projects';
  END IF;

  RAISE NOTICE 'PASS: crew_member project insert/upsert, cross-user protection, and suspended block verified';
END $$;

ROLLBACK;
