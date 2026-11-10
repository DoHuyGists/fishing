-- Run AFTER admin_assets.sql, before deploying the new asset manager.
-- Logical folders only: existing Storage paths and public URLs stay unchanged.
BEGIN;

CREATE OR REPLACE FUNCTION public.assets_folder_is_valid(value text) RETURNS boolean
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT value IS NOT NULL AND length(value) <= 500 AND (
    value = '' OR (
      left(value, 1) <> '/' AND right(value, 1) = '/'
      AND position(chr(92) IN value) = 0 AND value !~ '[[:cntrl:]]'
      AND NOT EXISTS (
        SELECT 1 FROM unnest(string_to_array(left(value, -1), '/')) AS segments(part)
        WHERE part IN ('', '.', '..') OR btrim(part) <> part
      )
    )
  );
$$;
REVOKE ALL ON FUNCTION public.assets_folder_is_valid(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assets_folder_is_valid(text) TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  path text NOT NULL UNIQUE CHECK (length(path) > 0),
  folder text NOT NULL DEFAULT '' CHECK (public.assets_folder_is_valid(folder)),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  kind text NOT NULL CHECK (kind IN ('image', 'video')),
  size bigint NOT NULL CHECK (size >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS assets_folder_idx ON public.assets (folder text_pattern_ops);
CREATE INDEX IF NOT EXISTS assets_created_at_idx ON public.assets (created_at DESC, id);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.assets FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assets TO authenticated;
GRANT ALL ON TABLE public.assets TO service_role;
DROP POLICY IF EXISTS assets_admin ON public.assets;
CREATE POLICY assets_admin ON public.assets FOR ALL TO authenticated
  USING ((SELECT public.assets_is_admin()))
  WITH CHECK ((SELECT public.assets_is_admin()));

-- Import media already in the bucket (including physical subfolders) into the logical root.
-- Never overwrite folders assigned by admins when this migration is rerun.
INSERT INTO public.assets (id, path, folder, name, kind, size, created_at)
SELECT id, name, '',
  regexp_replace(regexp_replace(name, '^.*/', ''), '^[0-9a-f-]{36}_', '', 'i'),
  CASE WHEN metadata->>'mimetype' LIKE 'video/%' THEN 'video' ELSE 'image' END,
  coalesce((metadata->>'size')::bigint, 0), coalesce(created_at, now())
FROM storage.objects
WHERE bucket_id = 'admin-assets'
  AND (metadata->>'mimetype' LIKE 'image/%' OR metadata->>'mimetype' LIKE 'video/%')
ON CONFLICT (path) DO NOTHING;

-- A single RPC renames/moves the entire branch atomically. It uses the caller's RLS.
CREATE OR REPLACE FUNCTION public.assets_move_folder(source_folder text, target_folder text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE affected bigint;
BEGIN
  IF NOT public.assets_is_admin() THEN
    RAISE EXCEPTION 'Bạn không có quyền quản lý tài nguyên.';
  END IF;
  IF NOT public.assets_folder_is_valid(source_folder) OR source_folder = ''
     OR NOT public.assets_folder_is_valid(target_folder) OR target_folder = '' THEN
    RAISE EXCEPTION 'Đường dẫn thư mục không hợp lệ. Không thể chuyển thư mục gốc.';
  END IF;
  IF source_folder = target_folder THEN RETURN; END IF;
  IF left(target_folder, length(source_folder)) = source_folder THEN
    RAISE EXCEPTION 'Không thể chuyển thư mục vào chính nó hoặc thư mục con.';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended('public.assets.folder_mutation', 0));
  IF EXISTS (SELECT 1 FROM public.assets WHERE left(folder, length(target_folder)) = target_folder) THEN
    RAISE EXCEPTION 'Thư mục đích đã tồn tại. Hãy chọn đường dẫn khác.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.assets WHERE left(folder, length(source_folder)) = source_folder
      AND length(target_folder || substr(folder, length(source_folder) + 1)) > 500
  ) THEN
    RAISE EXCEPTION 'Đường dẫn thư mục con vượt quá 500 ký tự.';
  END IF;
  UPDATE public.assets SET folder = target_folder || substr(folder, length(source_folder) + 1)
  WHERE left(folder, length(source_folder)) = source_folder;
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected = 0 THEN RAISE EXCEPTION 'Thư mục không còn tồn tại. Hãy làm mới kho.'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.assets_move_folder(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.assets_move_folder(text, text) TO authenticated;

COMMIT;
