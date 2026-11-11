-- Run this entire file in the Supabase SQL Editor.
-- Entries have the same shape as UpdateSet: [{"inventory_id": "<uuid>"}].
-- Empty slots are allowed. Selection flags are reset, matching UpdateSet.
-- This function does not switch the active set or select a fishing item.
BEGIN;

CREATE OR REPLACE FUNCTION public.save_equipment_set(
    p_set_id uuid,
    p_rod jsonb,
    p_line jsonb,
    p_reel jsonb,
    p_hook jsonb,
    p_bait jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_set public.user_equipments%ROWTYPE;
    v_slot record;
    v_entry jsonb;
    v_inventory_id uuid;
    v_seen uuid[] := ARRAY[]::uuid[];
    v_inventory_data jsonb;
    v_entries jsonb;
    v_payload jsonb := '{}'::jsonb;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Bạn cần đăng nhập để lưu bộ trang bị.';
    END IF;

    SELECT * INTO v_set
    FROM public.user_equipments
    WHERE id = p_set_id AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Không tìm thấy bộ trang bị của bạn.';
    END IF;

    -- cast_rod also locks the active set before creating its snapshot.
    IF v_set.is_used AND EXISTS (
        SELECT 1 FROM public.fishing_sessions
        WHERE user_id = v_user_id
          AND expires_at > clock_timestamp()
          AND (status IS NULL OR status NOT IN ('SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED'))
    ) THEN
        RAISE EXCEPTION 'Hãy kết thúc lượt câu hiện tại trước khi sửa bộ trang bị đang dùng.';
    END IF;

    FOR v_slot IN
        SELECT * FROM (VALUES
            ('rod', p_rod), ('line', p_line), ('reel', p_reel),
            ('hook', p_hook), ('bait', p_bait)
        ) AS slots(tool, entries)
    LOOP
        IF jsonb_typeof(v_slot.entries) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Danh sách trang bị ở ô % phải là một mảng.', v_slot.tool;
        END IF;

        v_entries := '[]'::jsonb;
        FOR v_entry IN SELECT value FROM jsonb_array_elements(v_slot.entries)
        LOOP
            IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object'
               OR jsonb_typeof(v_entry->'inventory_id') IS DISTINCT FROM 'string' THEN
                RAISE EXCEPTION 'Vật phẩm ở ô % phải có inventory_id.', v_slot.tool;
            END IF;

            BEGIN
                v_inventory_id := (v_entry->>'inventory_id')::uuid;
            EXCEPTION WHEN invalid_text_representation THEN
                RAISE EXCEPTION 'inventory_id ở ô % không hợp lệ.', v_slot.tool;
            END;

            IF v_inventory_id = ANY(v_seen) THEN
                RAISE EXCEPTION 'Một vật phẩm không thể xuất hiện nhiều lần trong cùng bộ trang bị.';
            END IF;
            v_seen := array_append(v_seen, v_inventory_id);

            -- Protect validated rows from concurrent deletion or data updates
            -- until this transaction commits. Stats always come from inventory.
            SELECT data INTO v_inventory_data
            FROM public.user_inventory
            WHERE id = v_inventory_id AND user_id = v_user_id
            FOR SHARE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'Vật phẩm % không tồn tại trong kho của bạn.', v_inventory_id;
            END IF;
            IF jsonb_typeof(v_inventory_data) IS DISTINCT FROM 'object'
               OR (v_inventory_data->>'category') IS DISTINCT FROM v_slot.tool THEN
                RAISE EXCEPTION 'Vật phẩm % không thuộc loại %.', v_inventory_id, v_slot.tool;
            END IF;

            -- Never persist client-supplied stats or selection flags.
            v_entries := v_entries || jsonb_build_array(jsonb_build_object(
                'inventory_id', v_inventory_id,
                'is_used', false
            ));
        END LOOP;
        v_payload := jsonb_set(v_payload, ARRAY[v_slot.tool], v_entries);
    END LOOP;

    UPDATE public.user_equipments
    SET rod = v_payload->'rod',
        line = v_payload->'line',
        reel = v_payload->'reel',
        hook = v_payload->'hook',
        bait = v_payload->'bait'
    WHERE id = v_set.id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_equipment_set(uuid, jsonb, jsonb, jsonb, jsonb, jsonb)
    FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_equipment_set(uuid, jsonb, jsonb, jsonb, jsonb, jsonb)
    TO authenticated;

-- Deployment follow-up: route UpdateSet through this RPC, then review existing
-- UPDATE grants/RLS on user_equipments so direct writes cannot bypass validation.
-- Existing policies are intentionally not replaced without their full schema.
COMMIT;
