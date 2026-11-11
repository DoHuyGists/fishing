-- Run this entire file in the Supabase SQL Editor.
-- Requires equipment_mechanics.sql (private fishing-session snapshots).
-- Accepts user_inventory IDs, not catalog item IDs. Returns the deleted count.
-- All requested items must be owned and removable; otherwise nothing is deleted.
BEGIN;

CREATE OR REPLACE FUNCTION public.delete_inventory_items(p_inventory_ids uuid[])
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_ids uuid[];
    v_id_texts text[];
    v_locked_count integer;
    v_deleted_count integer;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Bạn cần đăng nhập để xóa vật phẩm.';
    END IF;
    IF p_inventory_ids IS NULL
       OR coalesce(array_ndims(p_inventory_ids), 1) <> 1 THEN
        RAISE EXCEPTION 'Danh sách ID vật phẩm không hợp lệ.';
    END IF;
    IF EXISTS (SELECT 1 FROM unnest(p_inventory_ids) AS ids(id) WHERE id IS NULL) THEN
        RAISE EXCEPTION 'Danh sách vật phẩm không được chứa ID rỗng.';
    END IF;

    SELECT array_agg(DISTINCT id ORDER BY id)
    INTO v_ids FROM unnest(p_inventory_ids) AS ids(id);
    IF v_ids IS NULL THEN RETURN 0; END IF;

    -- Lock in a stable order. save_equipment_set holds a SHARE lock on each
    -- validated inventory row until its set update commits. After waiting here,
    -- the next query sees that committed set; a save after deletion fails its
    -- inventory lookup. Do not lock sets here (save locks sets before inventory).
    PERFORM id FROM public.user_inventory
    WHERE user_id = v_user_id AND id = ANY(v_ids)
    ORDER BY id FOR UPDATE;
    GET DIAGNOSTICS v_locked_count = ROW_COUNT;

    IF v_locked_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'Một hoặc nhiều vật phẩm không còn tồn tại trong kho của bạn.';
    END IF;

    SELECT array_agg(id::text) INTO v_id_texts FROM unnest(v_ids) AS ids(id);

    -- Check every set, including inactive sets and unselected entries.
    IF EXISTS (
        SELECT 1
        FROM public.user_equipments AS equipment
        CROSS JOIN LATERAL (VALUES
            (equipment.rod), (equipment.line), (equipment.reel),
            (equipment.hook), (equipment.bait)
        ) AS slots(entries)
        CROSS JOIN LATERAL jsonb_array_elements(
            CASE WHEN jsonb_typeof(slots.entries) = 'array'
                THEN slots.entries ELSE '[]'::jsonb END
        ) AS items(entry)
        WHERE equipment.user_id = v_user_id
          AND lower(items.entry->>'inventory_id') = ANY(v_id_texts)
    ) THEN
        RAISE EXCEPTION 'Không thể xóa vật phẩm đang có trong bộ trang bị. Hãy gỡ vật phẩm và lưu bộ trước.';
    END IF;

    -- An item may still be referenced by an unfinished cast's private snapshot
    -- even if it no longer appears in the current equipment sets.
    IF EXISTS (
        SELECT 1
        FROM public.fishing_sessions AS session
        JOIN public.fishing_session_mechanics AS mechanics ON mechanics.session_id = session.id
        CROSS JOIN LATERAL jsonb_each(mechanics.equipment_snapshot->'items') AS items(tool, entry)
        WHERE session.user_id = v_user_id
          AND session.expires_at > clock_timestamp()
          AND (session.status IS NULL OR session.status NOT IN ('SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'))
          AND lower(items.entry->>'inventory_id') = ANY(v_id_texts)
    ) THEN
        RAISE EXCEPTION 'Không thể xóa vật phẩm đang được dùng trong lượt câu chưa kết thúc.';
    END IF;

    DELETE FROM public.user_inventory
    WHERE user_id = v_user_id AND id = ANY(v_ids);
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    IF v_deleted_count <> cardinality(v_ids) THEN
        RAISE EXCEPTION 'Không thể xóa đầy đủ các vật phẩm đã chọn.';
    END IF;
    RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON FUNCTION public.delete_inventory_items(uuid[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_inventory_items(uuid[]) TO authenticated;

-- Route repository deletion through this RPC before restricting direct DELETE
-- grants/RLS. Existing policies are not replaced without their full schema.
COMMIT;
