-- Apply after 20261117_story.sql. Public media is intentional: published stories use public URLs.
BEGIN;
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES('story-media','story-media',TRUE,31457280,ARRAY['image/png','image/jpeg','image/webp','image/avif','audio/mpeg','audio/ogg','audio/wav','audio/x-wav','audio/mp4','audio/webm'])
ON CONFLICT(id) DO UPDATE SET public=excluded.public,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
CREATE POLICY story_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='story-media' AND public.feature_flags_is_admin());
CREATE POLICY story_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='story-media' AND public.feature_flags_is_admin());
-- No client deletion: URLs referenced by immutable releases must remain available.
COMMIT;
