-- Run this entire file in the SQL editor before submit_tension_challenge.sql.
-- Only the two validated RPC wrappers may call the shared reward function.
CREATE OR REPLACE FUNCTION public.resolve_fishing_challenge(
    p_session_id UUID, p_success BOOLEAN, p_time_spent_ms INTEGER
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_user_id UUID := auth.uid();
    v_session RECORD;
    v_species RECORD;

    -- Các biến xử lý Level & XP
    v_user_level INT;
    v_user_exp INT;
    v_max_exp INT;

    v_base_xp INT;
    v_earned_xp INT;
    v_decay_exponent NUMERIC := 0.7;

    v_initial_level INT;
    v_levels_gained INT := 0;

    v_equipment_id UUID;
    v_bait_inventory_id UUID;
    v_bait JSONB;
    v_bait_data JSONB;
    v_bait_quantity NUMERIC;
    v_caught_id UUID;
BEGIN
    -- =====================================================
    -- 0. Kiểm tra xác thực người dùng
    -- =====================================================

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    -- =====================================================
    -- 1. Tìm và khóa dòng session
    --    Chống spam / race condition
    -- =====================================================

    SELECT *
    INTO v_session
    FROM public.fishing_sessions
    WHERE id = p_session_id
      AND user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Session not found or unauthorized';
    END IF;

    IF v_session.status IS DISTINCT FROM 'BITE' THEN
        RAISE EXCEPTION 'Session is not ready or already processed';
    END IF;

    IF p_success IS NULL OR p_time_spent_ms IS NULL OR p_time_spent_ms < 0 THEN
        RAISE EXCEPTION 'Invalid challenge result';
    END IF;

    IF clock_timestamp() < v_session.bite_at THEN
        RAISE EXCEPTION 'Fish has not bitten yet';
    END IF;

    -- =====================================================
    -- 1.1. Trừ số lượng mồi khi submit challenge
    -- =====================================================

    SELECT
        ue.id,
        (bait_item.value->>'inventory_id')::UUID
    INTO
        v_equipment_id,
        v_bait_inventory_id
    FROM public.user_equipments ue

    CROSS JOIN LATERAL jsonb_array_elements(
        COALESCE(ue.bait, '[]'::JSONB)
    ) AS bait_item(value)

    WHERE ue.user_id = v_user_id
      AND ue.is_used = TRUE
      AND bait_item.value->'is_used' = 'true'::JSONB

    LIMIT 1
    FOR UPDATE OF ue;

    IF FOUND AND v_bait_inventory_id IS NOT NULL THEN

        -- Khóa inventory để tránh trừ số lượng đồng thời.
        SELECT data
        INTO v_bait_data
        FROM public.user_inventory
        WHERE id = v_bait_inventory_id
          AND user_id = v_user_id
        FOR UPDATE;

        IF FOUND
           AND v_bait_data ? 'quantity'
           AND NULLIF(v_bait_data->>'quantity', '') IS NOT NULL
           AND (v_bait_data->>'quantity') ~ '^[0-9]+(\.[0-9]+)?$'
        THEN

            v_bait_quantity :=
                (v_bait_data->>'quantity')::NUMERIC;

            -- Chỉ trừ khi quantity lớn hơn 0.
            IF v_bait_quantity > 0 THEN

                UPDATE public.user_inventory
                SET data = jsonb_set(
                    v_bait_data,
                    '{quantity}',
                    to_jsonb(v_bait_quantity - 1),
                    FALSE
                )
                WHERE id = v_bait_inventory_id
                  AND user_id = v_user_id;

            END IF;
        END IF;
    END IF;

    -- =====================================================
    -- 2. Kiểm tra thời gian hết hạn
    -- =====================================================

    -- A small transport grace period does not extend the simulation tick limit.
    IF clock_timestamp() > v_session.expires_at + (CASE
        WHEN v_session.challenge_data->>'type' = 'tension-challenge'
        THEN INTERVAL '5 seconds' ELSE INTERVAL '0 seconds' END) THEN
        UPDATE public.fishing_sessions
        SET status = 'EXPIRED'
        WHERE id = p_session_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'caught_fish', FALSE,
            'result', 'EXPIRED',
            'message', 'Session expired!'
        );
    END IF;

    -- =====================================================
    -- 3. Kiểm tra anti-speedhack
    -- =====================================================

    IF p_time_spent_ms < 300 AND p_success = TRUE THEN
        UPDATE public.fishing_sessions
        SET status = 'FAILED'
        WHERE id = p_session_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'caught_fish', FALSE,
            'result', 'INVALID_EXECUTION_TIME',
            'message', 'Invalid execution time'
        );
    END IF;

    -- =====================================================
    -- 4. Kiểm tra session không có cá
    --
    -- species_id IS NULL nghĩa là cá đã tuột
    -- ngay từ lúc tạo fishing session.
    --
    -- Không phụ thuộc p_success từ client.
    -- Không thêm vào caught.
    -- Không cộng XP.
    -- =====================================================

    IF v_session.species_id IS NULL THEN
        UPDATE public.fishing_sessions
        SET status = 'FAILED'
        WHERE id = p_session_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'caught_fish', FALSE,
            'result', 'FISH_ESCAPED',
            'message', 'The fish slipped away!',
            'session_id', p_session_id
        );
    END IF;

    -- =====================================================
    -- 5. Trường hợp người chơi thất bại minigame
    -- =====================================================

    IF NOT p_success THEN
        UPDATE public.fishing_sessions
        SET status = 'FAILED'
        WHERE id = p_session_id;

        RETURN jsonb_build_object(
            'success', FALSE,
            'caught_fish', FALSE,
            'result', 'FISH_ESCAPED',
            'message', 'Fish escaped!',
            'session_id', p_session_id
        );
    END IF;

    -- =====================================================
    -- 6. Người chơi thành công
    --    Cập nhật session và lưu cá vào caught
    -- =====================================================

    UPDATE public.fishing_sessions
    SET status = 'SUCCESS'
    WHERE id = p_session_id;

    INSERT INTO public.caught (
        user_id,
        species_id,
        area_id,
        weight,
        area_session_id,
        is_shiny,
        variant_type,
        star_rating,
        status
    )
    VALUES (
        v_user_id,
        v_session.species_id,
        v_session.area_id,
        v_session.secret_weight,
        v_session.area_session_id,
        COALESCE(v_session.is_shiny, FALSE),
        COALESCE(v_session.variant_type, 'NORMAL'),
        COALESCE(v_session.star_rating, 1),
        'in-net'
    ) RETURNING id INTO v_caught_id;

    -- =====================================================
    -- 7. Lấy thông tin cá
    -- =====================================================

    SELECT *
    INTO v_species
    FROM public.species
    WHERE id = v_session.species_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Species not found for fishing session';
    END IF;

    -- =====================================================
    -- 8. Lấy Level / EXP hiện tại của người chơi
    -- =====================================================

    SELECT
        level,
        experience_point
    INTO
        v_user_level,
        v_user_exp
    FROM public.user_profile
    WHERE id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User profile not found';
    END IF;

    v_initial_level := v_user_level;

    v_base_xp := COALESCE(v_species.experience_point, 1);

    -- =====================================================
    -- 9. Tính XP nhận được
    --
    -- Earned XP = Base XP * (1 / (Player Level ^ E))
    -- =====================================================

    v_earned_xp := ROUND(
        v_base_xp
        * (
            1.0
            / POWER(v_user_level::NUMERIC, v_decay_exponent)
        )
    );

    -- Đảm bảo nhận tối thiểu 1 XP khi bắt cá thành công
    IF v_earned_xp < 1 THEN
        v_earned_xp := 1;
    END IF;

    -- =====================================================
    -- 10. Xử lý lên Level và giữ XP dư
    -- =====================================================

    v_user_exp := v_user_exp + v_earned_xp;
    v_max_exp := v_user_level * 1000;

    WHILE v_user_exp >= v_max_exp LOOP
        v_user_exp := v_user_exp - v_max_exp;
        v_user_level := v_user_level + 1;
        v_max_exp := v_user_level * 1000;
    END LOOP;

    v_levels_gained := v_user_level - v_initial_level;

    -- =====================================================
    -- 11. Cập nhật Level / XP
    -- =====================================================

    UPDATE public.user_profile
    SET
        level = v_user_level,
        experience_point = v_user_exp
    WHERE id = v_user_id;

    -- =====================================================
    -- 12. Trả kết quả thành công cho client
    -- =====================================================

    RETURN jsonb_build_object(
        'success', TRUE,
        'caught_fish', TRUE,
        'result', 'CAUGHT',

        'caught', jsonb_build_object(
            'id', v_caught_id,
            'name', v_species.name,
            'rarity', v_species.rarity,
            'weight', v_session.secret_weight,
            'image', v_species.image,
            'area_id', v_session.area_id,
            'is_shiny', COALESCE(v_session.is_shiny, FALSE),
            'variant_type', COALESCE(v_session.variant_type, 'NORMAL'),
            'star_rating', COALESCE(v_session.star_rating, 1)
        ),

        'progression', jsonb_build_object(
            'earned_xp', v_earned_xp,
            'current_level', v_user_level,
            'current_exp', v_user_exp,
            'max_exp', v_max_exp,
            'is_level_up', (v_levels_gained > 0),
            'levels_gained', v_levels_gained
        )
    );
END;
$function$;

REVOKE ALL ON FUNCTION public.resolve_fishing_challenge(UUID, BOOLEAN, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_challenge(
    p_session_id UUID, p_success BOOLEAN, p_time_spent_ms INTEGER
) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_session public.fishing_sessions%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
    SELECT * INTO v_session FROM public.fishing_sessions
    WHERE id = p_session_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found or unauthorized'; END IF;
    IF v_session.challenge_data->>'type' = 'tension-challenge' THEN
        RAISE EXCEPTION 'Use submit_tension_challenge for this session';
    END IF;
    RETURN public.resolve_fishing_challenge(p_session_id, p_success, p_time_spent_ms);
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_challenge(UUID, BOOLEAN, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_challenge(UUID, BOOLEAN, INTEGER) TO authenticated;
