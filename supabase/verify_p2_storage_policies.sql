-- Non-destructive P2 verification script for Storage Bucket & Policy Constraints
-- Run in Supabase SQL Editor; wrapped in BEGIN ... ROLLBACK.

BEGIN;

DO $$
DECLARE
  v_public boolean;
  v_limit bigint;
  v_mimes text[];
  v_pol_count int;
BEGIN
  SELECT public, file_size_limit, allowed_mime_types
    INTO v_public, v_limit, v_mimes
    FROM storage.buckets
   WHERE id = 'storypad-media';

  IF v_public IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Bucket storypad-media must remain private (public = false)';
  END IF;

  IF v_limit IS DISTINCT FROM 52428800 THEN
    RAISE EXCEPTION 'Bucket storypad-media file_size_limit must be 52428800, got %', v_limit;
  END IF;

  IF v_mimes IS NULL OR 'text/html' = ANY(v_mimes) OR 'image/svg+xml' = ANY(v_mimes) OR 'application/javascript' = ANY(v_mimes) THEN
    RAISE EXCEPTION 'Unsafe or missing allowed_mime_types on storypad-media: %', v_mimes;
  END IF;

  IF NOT ('video/mp4' = ANY(v_mimes) AND 'audio/wav' = ANY(v_mimes)) THEN
    RAISE EXCEPTION 'Expected audio/wav and video/mp4 in allowed_mime_types';
  END IF;

  SELECT count(*) INTO v_pol_count
    FROM pg_policies
   WHERE schemaname = 'storage'
     AND tablename = 'objects'
     AND policyname IN (
       'storypad_media_auth_select',
       'storypad_media_auth_insert',
       'storypad_media_auth_update',
       'storypad_media_auth_delete'
     )
     AND (
       coalesce(qual, '') LIKE '%..%'
       OR coalesce(with_check, '') LIKE '%..%'
     );

  IF v_pol_count <> 4 THEN
    RAISE EXCEPTION 'Expected 4 storage policies with path traversal guard, found %', v_pol_count;
  END IF;

  RAISE NOTICE 'P2 verification passed: storypad-media private, 50MB cap, safe MIME allowlist, and 4 hardened RLS policies.';
END $$;

ROLLBACK;
