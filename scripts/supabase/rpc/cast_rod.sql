-- Existing cast_rod(p_area_id uuid, p_cast_depth numeric) function body.
DECLARE
    v_user_id UUID := auth.uid();
    v_selected_species_id UUID;
    v_species_record RECORD;
    v_calculated_weight NUMERIC;
    v_session_id UUID;
    v_wait_time INT;
    v_challenge JSONB;
    v_bite_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
    v_area_session_id UUID;

    -- Dữ liệu trang bị
    v_equipment RECORD;
    v_bait_match_number BIGINT;
    v_player_luck NUMERIC := 0.0;
    v_hook_strength NUMERIC := 0.0;
    v_catch_probability NUMERIC := 1.0;
    v_has_fish BOOLEAN := TRUE;

    -- Khung giờ và biến thể
    v_current_hour INT;
    v_time_bucket TEXT;
    v_is_shiny BOOLEAN := FALSE;
    v_variant_type TEXT := 'NORMAL';
    v_star_rating INT := 1;
    v_weight_ratio NUMERIC;

    -- Minigame Challenge
    v_zone_width NUMERIC;
    v_bar_speed NUMERIC;
    v_is_tension BOOLEAN := FALSE;
BEGIN
    -- =====================================================
    -- 0. Kiểm tra đầu vào
    -- =====================================================

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'User not authenticated';
    END IF;

    IF p_area_id IS NULL THEN
        RAISE EXCEPTION 'Fishing area is required';
    END IF;

    IF p_cast_depth IS NULL OR p_cast_depth < 0 THEN
        RAISE EXCEPTION 'Invalid cast depth';
    END IF;


        -- =====================================================
    -- 1. Lấy thông tin trang bị đang sử dụng
    -- =====================================================

    SELECT
        (bait_item.data->>'match_number')::BIGINT
            AS bait_match_number,

        COALESCE(
            (hook_item.data->>'strength')::NUMERIC,
            0.0
        ) AS hook_strength,

        COALESCE((bait_item.data->>'luck_bonus')::NUMERIC, 0.0)
        + COALESCE((rod_item.data->>'luck_bonus')::NUMERIC, 0.0)
        + COALESCE((line_item.data->>'luck_bonus')::NUMERIC, 0.0)
        + COALESCE((reel_item.data->>'luck_bonus')::NUMERIC, 0.0)
        + COALESCE((hook_item.data->>'luck_bonus')::NUMERIC, 0.0)
            AS total_luck

    INTO v_equipment

    FROM public.user_equipments ue

    -- Cần câu
    LEFT JOIN LATERAL (
        SELECT COALESCE(ui.data, '{}'::JSONB) || elem.value AS data
        FROM jsonb_array_elements(
            COALESCE(ue.rod, '[]'::JSONB)
        ) AS elem(value)
        JOIN public.user_inventory ui
            ON ui.id = (elem.value->>'inventory_id')::UUID
           AND ui.user_id = ue.user_id
        WHERE elem.value->'is_used' = 'true'::JSONB
        LIMIT 1
    ) rod_item ON TRUE

    -- Máy câu
    LEFT JOIN LATERAL (
        SELECT COALESCE(ui.data, '{}'::JSONB) || elem.value AS data
        FROM jsonb_array_elements(
            COALESCE(ue.reel, '[]'::JSONB)
        ) AS elem(value)
        JOIN public.user_inventory ui
            ON ui.id = (elem.value->>'inventory_id')::UUID
           AND ui.user_id = ue.user_id
        WHERE elem.value->'is_used' = 'true'::JSONB
        LIMIT 1
    ) reel_item ON TRUE

    -- Dây câu
    LEFT JOIN LATERAL (
        SELECT COALESCE(ui.data, '{}'::JSONB) || elem.value AS data
        FROM jsonb_array_elements(
            COALESCE(ue.line, '[]'::JSONB)
        ) AS elem(value)
        JOIN public.user_inventory ui
            ON ui.id = (elem.value->>'inventory_id')::UUID
           AND ui.user_id = ue.user_id
        WHERE elem.value->'is_used' = 'true'::JSONB
        LIMIT 1
    ) line_item ON TRUE

    -- Mồi câu
    LEFT JOIN LATERAL (
        SELECT COALESCE(ui.data, '{}'::JSONB) || elem.value AS data
        FROM jsonb_array_elements(
            COALESCE(ue.bait, '[]'::JSONB)
        ) AS elem(value)
        JOIN public.user_inventory ui
            ON ui.id = (elem.value->>'inventory_id')::UUID
           AND ui.user_id = ue.user_id
        WHERE elem.value->'is_used' = 'true'::JSONB
        LIMIT 1
    ) bait_item ON TRUE

    -- Lưỡi câu
    LEFT JOIN LATERAL (
        SELECT COALESCE(ui.data, '{}'::JSONB) || elem.value AS data
        FROM jsonb_array_elements(
            COALESCE(ue.hook, '[]'::JSONB)
        ) AS elem(value)
        JOIN public.user_inventory ui
            ON ui.id = (elem.value->>'inventory_id')::UUID
           AND ui.user_id = ue.user_id
        WHERE elem.value->'is_used' = 'true'::JSONB
        LIMIT 1
    ) hook_item ON TRUE

    WHERE ue.user_id = v_user_id
      AND ue.is_used = TRUE

    ORDER BY ue.created_at DESC
    LIMIT 1;

    v_bait_match_number := v_equipment.bait_match_number;
    v_hook_strength := COALESCE(v_equipment.hook_strength, 0.0);
    v_player_luck := COALESCE(v_equipment.total_luck, 0.0);


    -- =====================================================
    -- 2. Xác định khung giờ hiện tại
    -- =====================================================

    v_current_hour := EXTRACT(HOUR FROM NOW());

    IF v_current_hour BETWEEN 6 AND 18 THEN
        v_time_bucket := 'DAY';
    ELSE
        v_time_bucket := 'NIGHT';
    END IF;


    -- =====================================================
    -- 3. Chọn loài cá theo trọng số động + độ sâu
    -- =====================================================

    WITH candidates AS (
        SELECT
            sa.species_id,
            sa.weight_rate,

            -- ---------------------------------------------
            -- Tính trọng số độ sâu từ depth_scope
            -- ---------------------------------------------

            CASE
                -- Chưa cấu hình depth_scope:
                -- giữ nguyên trọng số của hệ thống cũ.
                WHEN ds.id IS NULL
                    THEN 1.0::NUMERIC

                -- Ngoài vùng phân phối.
                WHEN p_cast_depth < ds.min_depth
                  OR p_cast_depth > ds.max_depth
                    THEN 0.0::NUMERIC

                -- Đỉnh tại đầu dưới của khoảng.
                WHEN ds.peak_depth = ds.min_depth
                    THEN POWER(
                        GREATEST(
                            SIN(
                                (
                                    PI() / 2.0
                                ) * (
                                    (
                                        ds.max_depth - p_cast_depth
                                    ) / (
                                        ds.max_depth - ds.min_depth
                                    )
                                )::DOUBLE PRECISION
                            ),
                            0.0
                        ),
                        ds.curve_power::DOUBLE PRECISION
                    )::NUMERIC

                -- Đỉnh tại đầu trên của khoảng.
                WHEN ds.peak_depth = ds.max_depth
                    THEN POWER(
                        GREATEST(
                            SIN(
                                (
                                    PI() / 2.0
                                ) * (
                                    (
                                        p_cast_depth - ds.min_depth
                                    ) / (
                                        ds.max_depth - ds.min_depth
                                    )
                                )::DOUBLE PRECISION
                            ),
                            0.0
                        ),
                        ds.curve_power::DOUBLE PRECISION
                    )::NUMERIC

                -- Nửa đường cong bên trái đỉnh.
                WHEN p_cast_depth <= ds.peak_depth
                    THEN POWER(
                        GREATEST(
                            SIN(
                                (
                                    PI() / 2.0
                                ) * (
                                    (
                                        p_cast_depth - ds.min_depth
                                    ) / (
                                        ds.peak_depth - ds.min_depth
                                    )
                                )::DOUBLE PRECISION
                            ),
                            0.0
                        ),
                        ds.curve_power::DOUBLE PRECISION
                    )::NUMERIC

                -- Nửa đường cong bên phải đỉnh.
                ELSE POWER(
                    GREATEST(
                        SIN(
                            (
                                PI() / 2.0
                            ) * (
                                (
                                    ds.max_depth - p_cast_depth
                                ) / (
                                    ds.max_depth - ds.peak_depth
                                )
                            )::DOUBLE PRECISION
                        ),
                        0.0
                    ),
                    ds.curve_power::DOUBLE PRECISION
                )::NUMERIC
            END AS depth_weight

        FROM public.species_in_area sa

        JOIN public.species s
            ON s.id = sa.species_id

        LEFT JOIN public.depth_scope ds
            ON ds.id = sa.depth_scope_id

        WHERE sa.area_id = p_area_id

          -- Điều kiện thời gian.
          AND (
              s.active_time IS NULL
              OR s.active_time = 'ALL'
              OR s.active_time = v_time_bucket
          )
    ),

    weighted_candidates AS (
        SELECT
            c.species_id,

            -- ---------------------------------------------
            -- Trọng số cuối cùng
            -- ---------------------------------------------

            c.weight_rate

            -- Mồi câu phù hợp.
            * CASE
                WHEN v_bait_match_number IS NOT NULL
                 AND s.bait_match_number = v_bait_match_number
                    THEN 1.8
                ELSE 1.0
              END

            -- May mắn của trang bị.
            * (1.0 + v_player_luck)

            -- Trọng số độ sâu.
            * c.depth_weight

            AS final_weight

        FROM candidates c

        JOIN public.species s
            ON s.id = c.species_id

        WHERE c.weight_rate > 0
          AND c.depth_weight > 0
    )

    -- Chọn ngẫu nhiên theo trọng số.
    SELECT wc.species_id
    INTO v_selected_species_id

    FROM weighted_candidates wc

    WHERE wc.final_weight > 0

    ORDER BY
        -LN(GREATEST(random(), 1e-9))
        / wc.final_weight

    LIMIT 1;


    -- IF v_selected_species_id IS NULL THEN
    --     RAISE EXCEPTION
    --         'No species found in this fishing area for current conditions and cast depth';
    -- END IF;


    -- =====================================================
    -- 4. Lấy thông tin loài cá và tính cân nặng
    -- =====================================================

    SELECT *
    INTO v_species_record
    FROM public.species
    WHERE id = v_selected_species_id;

    -- Trung bình 3 lần random để tạo phân phối cân nặng.
    v_weight_ratio := (
        random() + random() + random()
    ) / 3.0;

    v_calculated_weight :=
        COALESCE(v_species_record.weight_min, 0.5)
        + (
            v_weight_ratio
            * (
                COALESCE(v_species_record.weight_max, 5.0)
                - COALESCE(v_species_record.weight_min, 0.5)
            )
        );


        -- =====================================================
    -- 5. Kiểm tra tỉ lệ giữ được cá bằng strength của hook
    -- =====================================================

    -- Hook mạnh hơn hoặc bằng trọng lượng cá: 100%.
    -- Hook yếu hơn dưới 1 đơn vị: tỉ lệ giảm tuyến tính.
    -- Hook yếu hơn từ 1 đơn vị trở lên: 0%.
    v_catch_probability := GREATEST(
        0.0,
        LEAST(
            1.0,
            1.0 + v_hook_strength - v_calculated_weight
        )
    );

    v_has_fish := random() < v_catch_probability;

    -- =====================================================
    -- 6. Xác định cá có tuột hay không
    -- =====================================================

    IF NOT v_has_fish THEN
        -- Cá đã cắn câu nhưng móc không đủ sức giữ.
        -- Vẫn tạo challenge để client chạy minigame.
        v_selected_species_id := NULL;
        v_calculated_weight := NULL;
        v_is_shiny := FALSE;
        v_variant_type := 'NORMAL';
        v_star_rating := 1;
    ELSE
        -- Chỉ xác định biến thể nếu cá được giữ lại.
        IF random() < (0.04 + (v_player_luck * 0.02)) THEN
            v_is_shiny := TRUE;

            IF random() < 0.3 THEN
                v_variant_type := 'MUTATED';
            ELSE
                v_variant_type := 'GOLDEN';
            END IF;
        END IF;

        -- Tính số sao của cá.
        v_star_rating := CASE
            WHEN v_weight_ratio > 0.85 OR v_is_shiny THEN 5
            WHEN v_weight_ratio > 0.65 THEN 4
            WHEN v_weight_ratio > 0.40 THEN 3
            WHEN v_weight_ratio > 0.20 THEN 2
            ELSE 1
        END;
    END IF;

    -- =====================================================
    -- 7. Tạo Minigame Challenge
    -- Luôn tạo challenge, kể cả khi cá đã tuột.
    -- =====================================================

    -- Độ rộng vùng an toàn dựa trên độ hiếm của cá.
    v_zone_width := CASE
        WHEN UPPER(COALESCE(v_species_record.rarity, ''))
            = 'LEGENDARY' THEN 0.10
        WHEN UPPER(COALESCE(v_species_record.rarity, ''))
            = 'EPIC' THEN 0.14
        WHEN UPPER(COALESCE(v_species_record.rarity, ''))
            = 'RARE' THEN 0.18
        ELSE 0.25
    END;

    -- Tốc độ thanh dựa trên độ hiếm của cá.
    v_bar_speed := CASE
        WHEN UPPER(COALESCE(v_species_record.rarity, ''))
            = 'LEGENDARY' THEN 2.4
        WHEN UPPER(COALESCE(v_species_record.rarity, ''))
            = 'EPIC' THEN 1.9
        WHEN UPPER(COALESCE(v_species_record.rarity, ''))
            = 'RARE' THEN 1.5
        ELSE 1.1
    END;

    -- Cá có trọng lượng lớn khiến thanh chạy nhanh hơn.
    IF v_weight_ratio > 0.75 THEN
        v_bar_speed := v_bar_speed + 0.3;
    END IF;

    -- Chỉ cá Shiny thực sự mới được áp dụng hiệu ứng này.
    IF v_is_shiny THEN
        v_zone_width := v_zone_width * 0.85;
    END IF;

    -- Luôn sinh dữ liệu challenge.
    v_challenge := jsonb_build_object(
        'target_zone_start',
            ROUND((0.15 + random() * 0.5)::NUMERIC, 2),
        'target_zone_width',
            ROUND(v_zone_width::NUMERIC, 2),
        'bar_speed',
            ROUND(v_bar_speed::NUMERIC, 2),
        'max_duration_ms',
            5000
    );


    -- =====================================================
    -- 8. Tính thời gian chờ và lấy area_session_id
    -- =====================================================

    v_wait_time := FLOOR(2500 + random() * 3500);

    v_bite_at := NOW() + (v_wait_time || ' milliseconds')::INTERVAL;

    v_expires_at :=
        NOW() + ((v_wait_time + 60000) || ' milliseconds')::INTERVAL;

    -- Rare, Epic, Legendary and Shiny fish use the seeded fight.
    -- An empty hook keeps the original challenge.
    v_is_tension := v_selected_species_id IS NOT NULL AND (
        UPPER(COALESCE(v_species_record.rarity, '')) IN ('RARE', 'EPIC', 'LEGENDARY')
        OR v_is_shiny
    );
    IF v_is_tension THEN
        -- Provisional window to receive BITE and hold the reel control.
        -- start_tension_challenge anchors the actual fight once, preserving seed/config/fish.
        v_expires_at := v_bite_at + INTERVAL '90 seconds';
        v_challenge := jsonb_build_object(
            'type', 'tension-challenge',
            'version', 1,
            'seed', 1 + FLOOR(random() * 2147483646)::BIGINT,
            'startedAt', FLOOR(EXTRACT(EPOCH FROM v_bite_at) * 1000)::BIGINT,
            'expiresAt', FLOOR(EXTRACT(EPOCH FROM v_expires_at) * 1000)::BIGINT,
            'config', jsonb_build_object(
                'tickRate', 60, 'safeMin', 35, 'safeMax', 70,
                'maxTension', 100, 'startTension', 30, 'startDistance', 100,
                'reelRate', 24, 'releaseRate', -28, 'reelSpeed', 7,
                'slackEscapeSeconds', 2.5, 'slackThresholdRatio', 0.5,
                'slackDistanceRate', 2, 'fishPullMultiplier', 0.7,
                'minimumStrength', 0.4
            ),
            'fish', jsonb_build_object(
                'id', v_selected_species_id,
                'baseStrength', CASE UPPER(COALESCE(v_species_record.rarity, ''))
                    WHEN 'LEGENDARY' THEN 1.2 WHEN 'EPIC' THEN 1.1 ELSE 1.0 END,
                'burstChance', 0.55, 'burstMin', 25, 'burstMax', 60,
                'staminaDrain', 0.05, 'basePull', 10, 'pullAmplitude', 8,
                'pullPeriodTicks', 126, 'burstMinTicks', 24, 'burstMaxTicks', 84
            )
        );
    END IF;

    SELECT uia.session_id
    INTO v_area_session_id
    FROM public.user_in_area uia
    WHERE uia.user_id = v_user_id
    LIMIT 1;


    -- =====================================================
    -- 9. Tạo fishing session
    -- =====================================================

    INSERT INTO public.fishing_sessions (
        user_id,
        area_id,
        species_id,
        secret_weight,
        challenge_data,
        expires_at,
        area_session_id,
        is_shiny,
        variant_type,
        star_rating,
        cast_depth,
        bite_at
    )
    VALUES (
        v_user_id,
        p_area_id,
        v_selected_species_id,
        ROUND(v_calculated_weight, 2),
        v_challenge,
        v_expires_at,
        v_area_session_id,
        v_is_shiny,
        v_variant_type,
        v_star_rating,
        p_cast_depth,
        v_bite_at
    )
    RETURNING id INTO v_session_id;

    IF v_is_tension THEN
        UPDATE public.fishing_sessions
        SET challenge_data = v_challenge || jsonb_build_object('sessionId', v_session_id)
        WHERE id = v_session_id;
    END IF;


    -- =====================================================
    -- 10. Trả kết quả cho Client
    -- =====================================================

    RETURN jsonb_build_object(
        'session_id', v_session_id,
        'wait_time_ms', v_wait_time,
        'server_time_ms', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT
    );

END;
