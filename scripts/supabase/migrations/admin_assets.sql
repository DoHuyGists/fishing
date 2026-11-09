-- Run in Supabase SQL Editor before using the admin media manager.
-- Media is public; only admins may list, upload or delete objects.
BEGIN;

CREATE OR REPLACE FUNCTION public.assets_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profile
    WHERE id = (SELECT auth.uid()) AND is_admin IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.assets_is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.assets_is_admin() TO authenticated;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('admin-assets', 'admin-assets', true, 52428800, ARRAY[
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif',
  'video/mp4', 'video/webm', 'video/quicktime'
])
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS admin_assets_select ON storage.objects;
CREATE POLICY admin_assets_select ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'admin-assets' AND (SELECT public.assets_is_admin()));

DROP POLICY IF EXISTS admin_assets_insert ON storage.objects;
CREATE POLICY admin_assets_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-assets' AND (SELECT public.assets_is_admin()));

DROP POLICY IF EXISTS admin_assets_delete ON storage.objects;
CREATE POLICY admin_assets_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'admin-assets' AND (SELECT public.assets_is_admin()));

COMMIT;
