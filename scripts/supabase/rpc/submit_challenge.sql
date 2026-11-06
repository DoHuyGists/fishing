-- Deploy equipment_mechanics.sql first, then this file, then submit_tension_challenge.sql.
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

    v_mechanics public.fishing_session_mechanics%ROWTYPE;
    v_has_mechanics BOOLEAN;
    v_bait_inventory_id UUID;
    v_failure_reason TEXT;
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

    SELECT * INTO v_mechanics FROM public.fishing_session_mechanics
    WHERE session_id = p_session_id FOR UPDATE;
    v_has_mechanics := FOUND;
    IF v_has_mechanics THEN
        -- Freeze inventory identity at cast time, even if the player switches sets.
        v_bait_inventory_id := (v_mechanics.equipment_snapshot#>>'{items,bait,inventory_id}')::UUID;
        v_failure_reason := v_mechanics.failure_reason;
    ELSE
        -- Compatibility for sessions created before rules v2.
        SELECT (bait_item.value->>'inventory_id')::UUID INTO v_bait_inventory_id
        FROM public.user_equipments ue
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(ue.bait, '[]'::JSONB)) AS bait_item(value)
        WHERE ue.user_id = v_user_id AND ue.is_used = TRUE
          AND bait_item.value->'is_used' = 'true'::JSONB
        ORDER BY ue.created_at DESC, ue.id DESC LIMIT 1 FOR UPDATE OF ue;
    END IF;

    IF NOT v_has_mechanics OR NOT v_mechanics.bait_consumed THEN
        SELECT data INTO v_bait_data FROM public.user_inventory
        WHERE id = v_bait_inventory_id AND user_id = v_user_id FOR UPDATE;
        IF FOUND AND jsonb_typeof(v_bait_data->'quantity') = 'number' THEN
            v_bait_quantity := (v_bait_data->>'quantity')::NUMERIC;
        END IF;
        IF v_bait_quantity >= 1 AND trunc(v_bait_quantity) = v_bait_quantity THEN
            UPDATE public.user_inventory SET data = jsonb_set(data, '{quantity}', to_jsonb(v_bait_quantity - 1))
            WHERE id = v_bait_inventory_id AND user_id = v_user_id;
            IF v_has_mechanics THEN
                UPDATE public.fishing_session_mechanics SET bait_consumed = TRUE WHERE session_id = p_session_id;
            END IF;
        ELSIF v_has_mechanics THEN
            -- Concurrent casts cannot earn fish from the same last unit of bait.
            UPDATE public.fishing_sessions SET status = 'FAILED' WHERE id = p_session_id;
            RETURN jsonb_build_object('success', FALSE, 'caught_fish', FALSE,
                'result', 'BAIT_UNAVAILABLE', 'message', 'Mồi của lượt câu này đã hết hoặc không còn trong túi.',
                'session_id', p_session_id);
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

    -- Tension already verifies simulated time and the complete input replay.
    -- A fast reel may legitimately finish in under 300 ms; retain the old
    -- minimum only for legacy timing challenges.
    IF p_time_spent_ms < 300 AND p_success = TRUE
       AND v_session.challenge_data->>'type' IS DISTINCT FROM 'tension-challenge' THEN
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

    -- Server-owned decisions are fixed at cast, never rerolled at submit.
    IF v_has_mechanics AND v_failure_reason IS NULL AND
       (v_session.secret_weight > (v_mechanics.equipment_snapshot#>>'{effective,max_weight}')::NUMERIC) THEN
        v_failure_reason := 'ROD_OVERWEIGHT';
    END IF;
    IF v_failure_reason IS NOT NULL THEN
        UPDATE public.fishing_sessions SET status = 'FAILED' WHERE id = p_session_id;
        RETURN jsonb_build_object('success', FALSE, 'caught_fish', FALSE,
            'result', v_failure_reason,
            'message', CASE v_failure_reason
                WHEN 'NO_FISH' THEN 'Không có cá phù hợp ở độ sâu và khung giờ này.'
                WHEN 'HOOK_MISSED' THEN 'Móc trượt! Thử đổi mồi hoặc nâng cấp lưỡi câu.'
                WHEN 'ROD_OVERWEIGHT' THEN 'Cá vượt tải trọng của cần và đã xổng mất.'
                ELSE 'Cá đã thoát.' END,
            'session_id', p_session_id);
    END IF;

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
