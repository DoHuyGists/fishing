
DECLARE
    v_user_id UUID;
    v_area_id UUID;
    v_session_id UUID;
    v_status TEXT;
    v_result JSONB;
BEGIN
    -- 1. Xác định người chơi đang đăng nhập
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required'
            USING ERRCODE = '28000';
    END IF;

    -- 2. Kiểm tra độ sâu
    IF p_cast_depth IS NULL OR p_cast_depth < 0 THEN
        RAISE EXCEPTION 'Cast depth must be non-negative'
            USING ERRCODE = '22023';
    END IF;

    -- 3. Lấy khu vực và phiên hiện tại của người chơi
    SELECT
        uia.area_id,
        uia.session_id,
        uia.status
    INTO
        v_area_id,
        v_session_id,
        v_status
    FROM public.user_in_area uia
    WHERE uia.user_id = v_user_id;

    -- 4. Chỉ cho phép xem trước khi đang ở trong khu vực
    IF NOT FOUND
       OR v_area_id IS NULL
       OR v_session_id IS NULL
       OR v_status IS DISTINCT FROM 'enter'
    THEN
        RAISE EXCEPTION 'You are not in an active fishing area'
            USING ERRCODE = 'P0001';
    END IF;

    -- 5. Lấy danh sách cá có thể xuất hiện ở độ sâu đã chọn
    WITH raw_fishes AS (
        SELECT
            s.id AS species_id,
            s.name,
            s.image,
            s.information,
            s.rarity,
            s.weight_min,
            s.weight_max,
            si.weight_rate,

            -- Tính hệ số phù hợp với độ sâu
            CASE
                -- Không giới hạn độ sâu
                WHEN ds.id IS NULL THEN 1::NUMERIC

                -- Độ sâu nằm ngoài phạm vi của loài cá
                WHEN p_cast_depth < ds.min_depth
                  OR p_cast_depth > ds.max_depth
                    THEN 0::NUMERIC

                -- Đỉnh phân bố ở đầu dưới
                WHEN ds.peak_depth = ds.min_depth
                    THEN POWER(
                        (
                            (ds.max_depth - p_cast_depth)
                            / (ds.max_depth - ds.min_depth)
                        )::DOUBLE PRECISION,
                        ds.curve_power::DOUBLE PRECISION
                    )::NUMERIC

                -- Đỉnh phân bố ở đầu trên
                WHEN ds.peak_depth = ds.max_depth
                    THEN POWER(
                        (
                            (p_cast_depth - ds.min_depth)
                            / (ds.max_depth - ds.min_depth)
                        )::DOUBLE PRECISION,
                        ds.curve_power::DOUBLE PRECISION
                    )::NUMERIC

                -- Đường cong tăng từ min_depth đến peak_depth
                WHEN p_cast_depth <= ds.peak_depth
                    THEN POWER(
                        SIN(
                            (
                                PI() / 2.0 *
                                (
                                    (p_cast_depth - ds.min_depth)
                                    / (ds.peak_depth - ds.min_depth)
                                )
                            )::DOUBLE PRECISION
                        ),
                        ds.curve_power::DOUBLE PRECISION
                    )::NUMERIC

                -- Đường cong giảm từ peak_depth đến max_depth
                ELSE POWER(
                    SIN(
                        (
                            PI() / 2.0 *
                            (
                                (ds.max_depth - p_cast_depth)
                                / (ds.max_depth - ds.peak_depth)
                            )
                        )::DOUBLE PRECISION
                    ),
                    ds.curve_power::DOUBLE PRECISION
                )::NUMERIC
            END AS depth_factor,

            -- Người chơi đã khám phá loài cá này chưa?
            EXISTS (
                SELECT 1
                FROM public.caught_diary cd
                WHERE cd.user_id = v_user_id
                  AND cd.species_id = s.id
            ) AS is_discovered

        FROM public.species_in_area si
        JOIN public.species s
            ON s.id = si.species_id
        LEFT JOIN public.depth_scope ds
            ON ds.id = si.depth_scope_id

        WHERE si.area_id = v_area_id
          AND si.weight_rate > 0
    ),

    -- 6. Loại cá không thể xuất hiện ở độ sâu đã chọn
    candidates AS (
        SELECT
            *,
            weight_rate::NUMERIC * depth_factor AS spawn_weight
        FROM raw_fishes
        WHERE depth_factor > 0
    ),

    -- 7. Tính tổng trọng số để chuẩn hóa xác suất
    weighted_fishes AS (
        SELECT
            *,
            SUM(spawn_weight) OVER () AS total_weight
        FROM candidates
    )

    -- 8. Tạo JSON trả về Client
    SELECT JSONB_BUILD_OBJECT(
        'area_id', v_area_id,
        'session_id', v_session_id,
        'cast_depth', p_cast_depth,

        'total_species', COUNT(*),

        'discovered_species',
            COUNT(*) FILTER (WHERE is_discovered),

        'undiscovered_species',
            COUNT(*) FILTER (WHERE NOT is_discovered),

        'fishes',
            COALESCE(
                JSONB_AGG(
                    JSONB_BUILD_OBJECT(
                        'species_id', species_id,
                        'is_discovered', is_discovered,

                        'display_name',
                            CASE
                                WHEN is_discovered THEN name
                                ELSE 'Chưa khám phá'
                            END,

                        'name',
                            CASE
                                WHEN is_discovered THEN name
                                ELSE NULL
                            END,

                        'image',
                            CASE
                                WHEN is_discovered THEN image
                                ELSE NULL
                            END,

                        'information',
                            CASE
                                WHEN is_discovered THEN information
                                ELSE NULL
                            END,

                        'rarity',
                            CASE
                                WHEN is_discovered THEN rarity
                                ELSE NULL
                            END,

                        'weight_min',
                            CASE
                                WHEN is_discovered THEN weight_min
                                ELSE NULL
                            END,

                        'weight_max',
                            CASE
                                WHEN is_discovered THEN weight_max
                                ELSE NULL
                            END,

                        'spawn_weight', spawn_weight,

                        'spawn_chance',
                            ROUND(
                                (
                                    spawn_weight
                                    / NULLIF(total_weight, 0)
                                    * 100
                                )::NUMERIC,
                                2
                            )
                    )
                    ORDER BY spawn_weight DESC, species_id
                ),
                '[]'::JSONB
            )
    )
    INTO v_result
    FROM weighted_fishes;

    RETURN v_result;
END;
