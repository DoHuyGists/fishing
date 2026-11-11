-- Run this entire file in the Supabase SQL Editor.
-- p_market_id is species_market.id, not caught.id.
-- Preserves cancelListing behavior: changes only the listing status.
-- No listing fee refund or invented caught.status transition.
BEGIN;

CREATE OR REPLACE FUNCTION public.cancel_market_listing(p_market_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_listing public.species_market%ROWTYPE;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Bạn cần đăng nhập để hủy đăng bán cá.';
    END IF;
    IF p_market_id IS NULL THEN
        RAISE EXCEPTION 'ID tin bán không hợp lệ.';
    END IF;

    -- Match buy_species_with_history: lock the listing before the fish.
    -- A purchase waiting on this row must recheck status after cancellation.
    SELECT * INTO v_listing
    FROM public.species_market
    WHERE id = p_market_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy tin bán của bạn.';
    END IF;
    IF v_listing.status IS DISTINCT FROM 'normal' THEN
        RAISE EXCEPTION 'Tin bán không còn khả dụng để hủy.';
    END IF;

    PERFORM id FROM public.caught
    WHERE id = v_listing.caught_id AND user_id = v_user_id
    FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Cá trong tin bán không còn thuộc sở hữu của bạn.';
    END IF;

    UPDATE public.species_market
    SET status = 'cancelled'
    WHERE id = v_listing.id AND user_id = v_user_id AND status = 'normal';
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không thể hủy tin bán cá.';
    END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.cancel_market_listing(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_market_listing(uuid) TO authenticated;

-- Route repository cancellation through this RPC before reviewing direct UPDATE
-- grants/RLS on species_market. Existing policies are not replaced here.
COMMIT;
