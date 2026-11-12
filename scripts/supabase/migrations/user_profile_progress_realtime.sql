-- Run once in the Supabase SQL Editor to receive player progress updates.
-- Existing SELECT grants/RLS policies still control access to each profile.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'user_profile'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_profile;
  END IF;
END;
$$;
