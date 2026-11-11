-- Run this entire file in the Supabase SQL Editor.
-- No arguments. Returns the number of released fish owned by the caller.
BEGIN;

CREATE OR REPLACE FUNCTION public.release_in_net_fishes()
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_deleted_count bigint;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Bạn cần đăng nhập để thả cá trong lưới.';
    END IF;

    DELETE FROM public.caught
    WHERE user_id = v_user_id AND status = 'in-net';

    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.release_in_net_fishes() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_in_net_fishes() TO authenticated;

COMMIT;
