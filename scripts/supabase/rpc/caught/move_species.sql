-- Run this entire file in the Supabase SQL Editor.
-- p_species_ids contains caught.id values (individual fish), not species.id values.
-- Pass one, several, or all selected fish IDs. Empty/NULL arrays never mean all.
BEGIN;

DROP FUNCTION IF EXISTS public.move_species(uuid, text);

CREATE OR REPLACE FUNCTION public.move_species(p_species_ids uuid[], p_status text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_capacity bigint;
    v_current_count bigint;
    v_ids uuid[];
    v_source_status text;
    v_selected_count bigint;
    v_rows_affected bigint;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Chưa đăng nhập.';
    END IF;

    IF p_status IS NULL OR p_status NOT IN ('normal', 'in-net') THEN
        RAISE EXCEPTION 'Trạng thái không hợp lệ.';
    END IF;
    IF coalesce(cardinality(p_species_ids), 0) = 0
       OR array_position(p_species_ids, NULL) IS NOT NULL THEN
        RAISE EXCEPTION 'Danh sách cá không hợp lệ.';
    END IF;

    SELECT array_agg(DISTINCT id) INTO v_ids FROM unnest(p_species_ids) AS selected(id);
    v_source_status := CASE p_status WHEN 'normal' THEN 'in-net' ELSE 'normal' END;

    -- Serialize transfers and capacity checks for this player.
    SELECT species_storage_capacity INTO v_capacity
    FROM public.user_profile
    WHERE id = v_user_id
    FOR UPDATE;
    IF NOT FOUND OR v_capacity IS NULL THEN
        RAISE EXCEPTION 'Không tìm thấy hồ sơ người chơi.';
    END IF;

    -- Lock the selected fish before validating their ownership and source state.
    PERFORM id FROM public.caught
    WHERE id = ANY(v_ids) AND user_id = v_user_id
    ORDER BY id
    FOR UPDATE;

    SELECT count(*) INTO v_selected_count
    FROM public.caught
    WHERE id = ANY(v_ids) AND user_id = v_user_id AND status = v_source_status;
    IF v_selected_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'Không tìm thấy cá phù hợp hoặc trạng thái cá đã thay đổi.';
    END IF;

    IF p_status = 'normal' THEN
        SELECT count(*) INTO v_current_count
        FROM public.caught
        WHERE user_id = v_user_id AND status = 'normal';
        IF v_current_count + v_selected_count > v_capacity THEN
            RAISE EXCEPTION 'Kho chứa cá không đủ chỗ, không thể chuyển vào kho!';
        END IF;
    END IF;

    UPDATE public.caught
    SET status = p_status
    WHERE id = ANY(v_ids) AND user_id = v_user_id AND status = v_source_status;
    GET DIAGNOSTICS v_rows_affected = ROW_COUNT;
    IF v_rows_affected <> v_selected_count THEN
        RAISE EXCEPTION 'Không thể chuyển toàn bộ cá đã chọn.';
    END IF;

    RETURN json_build_object('success', true, 'message', 'Thao tác thành công.', 'moved_count', v_rows_affected);
END;
$$;

REVOKE ALL ON FUNCTION public.move_species(uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.move_species(uuid[], text) TO authenticated;

COMMIT;
