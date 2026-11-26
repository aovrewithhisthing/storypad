-- Phase P2: Storage Bucket MIME/Size Constraints & Path Traversal Guards
-- Target project: pwhrfuxwhydjiqfgjnts
-- Run manually in Supabase SQL Editor after P0 and P1 migrations.

-- 1. Enforce private bucket, 50 MB size limit, and explicit audio/video MIME allowlist
UPDATE storage.buckets
SET
  public = false,
  file_size_limit = 52428800,
  allowed_mime_types = ARRAY[
    'audio/wav',
    'audio/x-wav',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/ogg',
    'audio/webm',
    'video/mp4',
    'video/quicktime',
    'video/webm',
    'video/x-matroska'
  ]
WHERE id = 'storypad-media';

-- 2. Harden storage.objects RLS policies with project ownership + path traversal guard
DROP POLICY IF EXISTS storypad_media_auth_select ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_insert ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_update ON storage.objects;
DROP POLICY IF EXISTS storypad_media_auth_delete ON storage.objects;

CREATE POLICY storypad_media_auth_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'storypad-media'
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '/%'
    AND private.can_access_project((storage.foldername(name))[1])
  );

CREATE POLICY storypad_media_auth_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'storypad-media'
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '/%'
    AND private.can_edit_project((storage.foldername(name))[1])
  );

CREATE POLICY storypad_media_auth_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'storypad-media'
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '/%'
    AND private.can_edit_project((storage.foldername(name))[1])
  )
  WITH CHECK (
    bucket_id = 'storypad-media'
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '/%'
    AND private.can_edit_project((storage.foldername(name))[1])
  );

CREATE POLICY storypad_media_auth_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'storypad-media'
    AND name NOT LIKE '%..%'
    AND name NOT LIKE '/%'
    AND private.can_edit_project((storage.foldername(name))[1])
  );
