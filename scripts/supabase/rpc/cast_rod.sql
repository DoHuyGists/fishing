-- Body of public.cast_rod(p_area_id UUID, p_cast_depth NUMERIC), RETURNS JSONB.
-- Keep the existing SECURITY DEFINER wrapper and SET search_path = public.
-- Deploy equipment_mechanics.sql and both submit RPC files first.
-- Requires fishing_areas.timezone and countries.default_timezone (IANA names).
-- Rules v2; tension replay protocol remains v1 (only configuration changes).
DECLARE
    v_user_id UUID := auth.uid();
    v_set RECORD;
    v_slot RECORD;
    v_item JSONB;
    v_inventory_id UUID;
    v_selected_count INTEGER;
    v_equipment JSONB := '{}'::JSONB;
    v_base JSONB;
    v_effective JSONB;
    v_stat TEXT;
    v_value NUMERIC;

    -- SERVER EFFECTS: future skills, weather, buffs and events contribute here.
    -- effective = (base + SUM(add)) * PRODUCT(multiplier), then domain limits.
    -- Never accept these modifiers from RPC arguments or equipment-set JSON.
    v_modifiers JSONB := '{
        "max_weight": {"add": 0, "multiplier": 1},
        "pull_strength": {"add": 0, "multiplier": 1},
        "durability": {"add": 0, "multiplier": 1},
        "catch_rate": {"add": 0, "multiplier": 1},
        "luck_bonus": {"add": 0, "multiplier": 1},
        "fish_strength": {"add": 0, "multiplier": 1},
        "catch_probability": {"add": 0, "multiplier": 1}
    }'::JSONB;

    -- BALANCE: independent of equipment values and external effect sources.
    v_balance JSONB := '{
        "matched_attraction": 1.8, "unmatched_attraction": 1,
        "matched_catch_factor": 1, "unmatched_catch_factor": 0.5,
        "base_reel_speed": 2, "strength_reference": 40,
        "safe_min_ratio": 0.35, "safe_max_ratio": 0.7,
        "start_tension_ratio": 0.5,
        "fight_seconds": 90, "wait_min_ms": 2500, "wait_range_ms": 3500
    }'::JSONB;
    v_bait_types JSONB;
    v_bait_matches BOOLEAN := FALSE;
    v_bait_factor NUMERIC;
    v_timezone TEXT;
    v_hour INTEGER;
    v_time_bucket TEXT;
    v_species public.species%ROWTYPE;
    v_species_id UUID;
    v_weight NUMERIC;
    v_weight_ratio NUMERIC := 0.5;
    v_fish_strength NUMERIC := 40;
    v_burst_multiplier NUMERIC := 1.5;
    v_catch_probability NUMERIC := 0;
    v_failure_reason TEXT;
    v_is_shiny BOOLEAN := FALSE;
    v_variant_type TEXT := 'NORMAL';
    v_star_rating INTEGER := 1;
    v_fish_snapshot JSONB := '{}'::JSONB;
    v_max_tension NUMERIC;
    v_reel_speed NUMERIC;
    v_start_distance NUMERIC := 30;
    v_burst_chance NUMERIC := 0.35;
    v_stamina_drain NUMERIC := 0.08;
    v_challenge JSONB;
    v_session_id UUID := gen_random_uuid();
    v_area_session_id UUID;
    v_wait_time INTEGER;
    v_bite_at TIMESTAMPTZ;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- ================================================================
    -- A. Snapshot exactly one equipped item per slot.
    -- Stats come from user_inventory.data; set entries contain references
    -- and selection flags only and cannot override inventory stats.
    -- ================================================================
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
    IF p_area_id IS NULL THEN RAISE EXCEPTION 'Fishing area is required'; END IF;
    IF p_cast_depth IS NULL OR p_cast_depth < 0
       OR p_cast_depth::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Invalid cast depth';
    END IF;

    -- Blank area values inherit the country's default; invalid values fail.
    SELECT COALESCE(NULLIF(btrim(a.timezone), ''), NULLIF(btrim(c.default_timezone), ''))
    INTO v_timezone
    FROM public.fishing_areas a
    LEFT JOIN public.countries c ON c.id = a.country_id
    WHERE a.id = p_area_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Fishing area not found'; END IF;
    IF v_timezone IS NULL THEN
        RAISE EXCEPTION 'Missing timezone for fishing area % or its country', p_area_id;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name = v_timezone) THEN
        RAISE EXCEPTION 'Invalid fishing area timezone: %', v_timezone;
    END IF;
    -- Preserve the resolved timezone in the private session balance snapshot.
    v_balance := jsonb_set(v_balance, '{timezone}', to_jsonb(v_timezone));

    SELECT * INTO v_set FROM public.user_equipments
    WHERE user_id = v_user_id AND is_used = TRUE
    ORDER BY created_at DESC, id DESC LIMIT 1 FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No active equipment set'; END IF;

    FOR v_slot IN SELECT * FROM (VALUES
        ('rod', v_set.rod), ('reel', v_set.reel), ('line', v_set.line),
        ('bait', v_set.bait), ('hook', v_set.hook)
    ) AS slots(tool, entries) LOOP
        IF jsonb_typeof(v_slot.entries) IS DISTINCT FROM 'array' THEN
            RAISE EXCEPTION 'Missing equipment slot: %', v_slot.tool;
        END IF;
        SELECT count(*), (array_agg(value->>'inventory_id'))[1]::UUID
        INTO v_selected_count, v_inventory_id
        FROM jsonb_array_elements(v_slot.entries)
        WHERE value->'is_used' = 'true'::JSONB;
        IF v_selected_count <> 1 OR v_inventory_id IS NULL THEN
            RAISE EXCEPTION 'Equip exactly one item in slot: %', v_slot.tool;
        END IF;
        SELECT data INTO v_item FROM public.user_inventory
        WHERE id = v_inventory_id AND user_id = v_user_id FOR SHARE;
        IF NOT FOUND OR jsonb_typeof(v_item) IS DISTINCT FROM 'object' THEN
            RAISE EXCEPTION 'Invalid inventory item in slot: %', v_slot.tool;
        END IF;
        v_equipment := jsonb_set(v_equipment, ARRAY[v_slot.tool],
            jsonb_build_object('inventory_id', v_inventory_id, 'data', v_item));
    END LOOP;

    v_base := jsonb_build_object(
        'max_weight', v_equipment#>'{rod,data,max_weight}',
        'pull_strength', v_equipment#>'{reel,data,pull_strength}',
        'durability', v_equipment#>'{line,data,durability}',
        'catch_rate', v_equipment#>'{hook,data,catch_rate}',
        'luck_bonus', 0
    );
    FOREACH v_stat IN ARRAY ARRAY['max_weight', 'pull_strength', 'durability', 'catch_rate'] LOOP
        IF jsonb_typeof(v_base->v_stat) IS DISTINCT FROM 'number' THEN
            RAISE EXCEPTION 'Equipment requires numeric % in user_inventory.data', v_stat;
        END IF;
        v_value := (v_base->>v_stat)::NUMERIC;
        IF v_value < 0 OR (v_stat IN ('max_weight', 'durability') AND v_value = 0)
           OR (v_stat = 'catch_rate' AND v_value > 1) THEN
            RAISE EXCEPTION 'Invalid equipment stat: %', v_stat;
        END IF;
    END LOOP;
    -- luck_bonus remains optional and affects shiny only, never spawn weights.
    FOR v_item IN SELECT value->'data' FROM jsonb_each(v_equipment) LOOP
        IF v_item ? 'luck_bonus' THEN
            IF jsonb_typeof(v_item->'luck_bonus') IS DISTINCT FROM 'number' THEN
                RAISE EXCEPTION 'luck_bonus must be numeric';
            END IF;
            v_base := jsonb_set(v_base, '{luck_bonus}',
                to_jsonb((v_base->>'luck_bonus')::NUMERIC + (v_item->>'luck_bonus')::NUMERIC));
        END IF;
    END LOOP;

    v_bait_types := v_equipment#>'{bait,data,fish_type}';
    IF jsonb_typeof(v_bait_types) IS DISTINCT FROM 'array' THEN
        RAISE EXCEPTION 'Bait fish_type must be a nonempty array of group codes';
    END IF;
    IF jsonb_array_length(v_bait_types) = 0 OR EXISTS (
        SELECT 1 FROM jsonb_array_elements(v_bait_types) AS groups(code)
        WHERE jsonb_typeof(code) IS DISTINCT FROM 'string' OR btrim(code#>>'{}') = ''
    ) THEN RAISE EXCEPTION 'Invalid bait fish_type group codes'; END IF;
    IF jsonb_typeof(v_equipment#>'{bait,data,quantity}') IS DISTINCT FROM 'number' THEN
        RAISE EXCEPTION 'Bait requires numeric quantity';
    END IF;
    v_value := (v_equipment#>>'{bait,data,quantity}')::NUMERIC;
    IF v_value < 1 OR trunc(v_value) <> v_value THEN RAISE EXCEPTION 'No usable bait remaining'; END IF;

    -- ================================================================
    -- B. Resolve effective player stats once. INSERT FUTURE SERVER EFFECT
    -- QUERIES HERE to aggregate v_modifiers before applying the formulas.
    -- ================================================================
    v_effective := '{}'::JSONB;
    FOREACH v_stat IN ARRAY ARRAY['max_weight', 'pull_strength', 'durability', 'catch_rate', 'luck_bonus'] LOOP
        v_value := ((v_base->>v_stat)::NUMERIC + (v_modifiers#>>ARRAY[v_stat, 'add'])::NUMERIC)
            * (v_modifiers#>>ARRAY[v_stat, 'multiplier'])::NUMERIC;
        v_value := CASE v_stat
            WHEN 'max_weight' THEN GREATEST(0, v_value)
            WHEN 'pull_strength' THEN GREATEST(0, v_value)
            WHEN 'durability' THEN LEAST(1000, GREATEST(10, v_value))
            WHEN 'catch_rate' THEN LEAST(1, GREATEST(0, v_value))
            ELSE v_value END;
        v_effective := jsonb_set(v_effective, ARRAY[v_stat], to_jsonb(v_value));
    END LOOP;
    v_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE v_timezone));
    v_time_bucket := CASE WHEN v_hour BETWEEN 6 AND 18 THEN 'DAY' ELSE 'NIGHT' END;

    -- ================================================================
    -- C. Encounter selection: depth -> relative frequency -> bait.
    -- Bait cannot attract fish outside their depth/time distribution.
    -- P(species i) = final_weight_i / SUM(final_weight).
    -- A common multiplier on ALL species cancels and is intentionally absent.
    -- ================================================================
    WITH candidates AS (
        SELECT sa.species_id, sa.weight_rate, s.fish_type,
            CASE
                WHEN ds.id IS NULL THEN 1.0::NUMERIC
                WHEN ds.min_depth IS NULL OR ds.max_depth IS NULL OR ds.peak_depth IS NULL
                  OR ds.curve_power IS NULL OR ds.curve_power <= 0
                  OR ds.min_depth::TEXT IN ('NaN', 'Infinity', '-Infinity')
                  OR ds.max_depth::TEXT IN ('NaN', 'Infinity', '-Infinity')
                  OR ds.peak_depth::TEXT IN ('NaN', 'Infinity', '-Infinity')
                  OR ds.curve_power::TEXT IN ('NaN', 'Infinity', '-Infinity')
                  OR ds.min_depth > ds.max_depth
                  OR ds.peak_depth NOT BETWEEN ds.min_depth AND ds.max_depth THEN 0.0
                WHEN p_cast_depth < ds.min_depth OR p_cast_depth > ds.max_depth THEN 0.0
                -- Includes point scopes (min = peak = max), without dividing by zero.
                WHEN p_cast_depth = ds.peak_depth THEN 1.0
                WHEN p_cast_depth = ds.min_depth OR p_cast_depth = ds.max_depth THEN 0.0
                WHEN p_cast_depth < ds.peak_depth THEN POWER(
                    LEAST(1.0, GREATEST(0.0, SIN((PI() / 2 *
                        (p_cast_depth - ds.min_depth) / NULLIF(ds.peak_depth - ds.min_depth, 0))::DOUBLE PRECISION))),
                    ds.curve_power::DOUBLE PRECISION)::NUMERIC
                ELSE POWER(
                    LEAST(1.0, GREATEST(0.0, SIN((PI() / 2 *
                        (ds.max_depth - p_cast_depth) / NULLIF(ds.max_depth - ds.peak_depth, 0))::DOUBLE PRECISION))),
                    ds.curve_power::DOUBLE PRECISION)::NUMERIC
            END AS depth_weight,
            -- Future PER-SPECIES effects: join server-owned effect data here.
            0.0::NUMERIC AS spawn_add, 1.0::NUMERIC AS spawn_multiplier
        FROM public.species_in_area sa
        JOIN public.species s ON s.id = sa.species_id
        LEFT JOIN public.depth_scope ds ON ds.id = sa.depth_scope_id
        WHERE sa.area_id = p_area_id
          AND (s.active_time IS NULL OR s.active_time = 'ALL' OR s.active_time = v_time_bucket)
          AND sa.weight_rate > 0
          AND sa.weight_rate::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    ), weighted_candidates AS (
        SELECT species_id,
            GREATEST(0, weight_rate + spawn_add) * spawn_multiplier * depth_weight
            * CASE WHEN v_bait_types ? fish_type
                THEN (v_balance->>'matched_attraction')::NUMERIC
                ELSE (v_balance->>'unmatched_attraction')::NUMERIC END AS final_weight
        FROM candidates WHERE depth_weight > 0
    )
    SELECT species_id INTO v_species_id FROM weighted_candidates
    WHERE final_weight > 0
    ORDER BY -LN(GREATEST(random(), 1e-9)) / final_weight LIMIT 1;

    -- ================================================================
    -- D. Selected fish: weight -> effective strength -> hook -> rod.
    -- Selection is independent of carrying capacity: heavy fish can bite.
    -- Round weight ONCE before both the rod check and reward snapshot.
    -- ================================================================
    IF v_species_id IS NULL THEN
        v_failure_reason := 'NO_FISH';
    ELSE
        SELECT * INTO STRICT v_species FROM public.species WHERE id = v_species_id;
        IF NULLIF(btrim(v_species.fish_type), '') IS NULL
           OR v_species.strength IS NULL OR v_species.strength <= 0
           OR v_species.strength::TEXT IN ('NaN', 'Infinity', '-Infinity')
           OR v_species.alertness IS NULL OR v_species.alertness NOT BETWEEN 0 AND 1
           OR v_species.base_catch_rate IS NULL OR v_species.base_catch_rate NOT BETWEEN 0 AND 1
           OR v_species.weight_min IS NULL OR v_species.weight_max IS NULL
           OR v_species.weight_min < 0.01 OR v_species.weight_max < v_species.weight_min
           OR v_species.weight_min::TEXT IN ('NaN', 'Infinity', '-Infinity')
           OR v_species.weight_max::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
            RAISE EXCEPTION 'Incomplete or invalid fishing stats for species %', v_species_id;
        END IF;
        v_burst_multiplier := COALESCE(v_species.burst_multiplier, 1.5);
        IF v_burst_multiplier NOT BETWEEN 1 AND 10 THEN
            RAISE EXCEPTION 'Species burst_multiplier must be between 1 and 10';
        END IF;
        v_weight_ratio := (random() + random() + random()) / 3.0;
        v_weight := ROUND(v_species.weight_min + v_weight_ratio *
            (v_species.weight_max - v_species.weight_min), 2);
        v_weight_ratio := CASE WHEN v_species.weight_max = v_species.weight_min THEN 0.5
            ELSE LEAST(1, GREATEST(0, (v_weight - v_species.weight_min)
                / (v_species.weight_max - v_species.weight_min))) END;
        -- Weight affects strength once (0.75..1.25 within the species).
        v_fish_strength := LEAST(400, GREATEST(0.4,
            (v_species.strength * (0.75 + 0.5 * v_weight_ratio)
                + (v_modifiers#>>'{fish_strength,add}')::NUMERIC)
            * (v_modifiers#>>'{fish_strength,multiplier}')::NUMERIC));
        v_bait_matches := v_bait_types ? v_species.fish_type;
        v_bait_factor := CASE WHEN v_bait_matches
            THEN (v_balance->>'matched_catch_factor')::NUMERIC
            ELSE (v_balance->>'unmatched_catch_factor')::NUMERIC END;

        -- Attraction and hooking are two distinct, intentional effects.
        -- Roll hooking ONCE. There is no second probability roll at submit.
        v_catch_probability := LEAST(1, GREATEST(0,
            (((v_species.base_catch_rate + (v_effective->>'catch_rate')::NUMERIC)
                * v_bait_factor * (1 - v_species.alertness))
                + (v_modifiers#>>'{catch_probability,add}')::NUMERIC)
            * (v_modifiers#>>'{catch_probability,multiplier}')::NUMERIC));
        IF random() >= v_catch_probability THEN v_failure_reason := 'HOOK_MISSED';
        ELSIF v_weight > (v_effective->>'max_weight')::NUMERIC THEN
            v_failure_reason := 'ROD_OVERWEIGHT';
        END IF;
        v_fish_snapshot := jsonb_build_object('species_id', v_species_id,
            'weight', v_weight, 'weight_ratio', v_weight_ratio, 'base_strength', v_species.strength,
            'effective_strength', v_fish_strength, 'burst_multiplier', v_burst_multiplier,
            'fish_type', v_species.fish_type, 'alertness', v_species.alertness,
            'base_catch_rate', v_species.base_catch_rate, 'bait_matches', v_bait_matches,
            'catch_probability', v_catch_probability);

        IF v_failure_reason IS NULL THEN
            IF random() < LEAST(1, GREATEST(0, 0.04 + (v_effective->>'luck_bonus')::NUMERIC * 0.02)) THEN
                v_is_shiny := TRUE;
                v_variant_type := CASE WHEN random() < 0.3 THEN 'MUTATED' ELSE 'GOLDEN' END;
            END IF;
            v_star_rating := CASE WHEN v_weight_ratio > 0.85 OR v_is_shiny THEN 5
                WHEN v_weight_ratio > 0.65 THEN 4 WHEN v_weight_ratio > 0.40 THEN 3
                WHEN v_weight_ratio > 0.20 THEN 2 ELSE 1 END;
        END IF;
        -- Rarity changes pacing, not another strength multiplier.
        CASE UPPER(COALESCE(v_species.rarity, 'COMMON'))
            WHEN 'LEGENDARY' THEN v_start_distance := 100; v_burst_chance := 0.65; v_stamina_drain := 0.03;
            WHEN 'EPIC' THEN v_start_distance := 90; v_burst_chance := 0.6; v_stamina_drain := 0.04;
            WHEN 'RARE' THEN v_start_distance := 70; v_burst_chance := 0.55; v_stamina_drain := 0.05;
            WHEN 'UNCOMMON' THEN v_start_distance := 50; v_burst_chance := 0.45; v_stamina_drain := 0.06;
            ELSE NULL;
        END CASE;
    END IF;

    -- ================================================================
    -- E. All casts use tension, with no timing-bar data.
    -- durability is accumulated tension capacity, NOT weight or a one-time
    -- comparison with fish force (which adds tension points per second).
    -- Stronger line increases headroom; fish forces are NOT scaled with it.
    -- ================================================================
    -- Quantize emitted values to the replay's 1/10000 precision so decimal
    -- half-rounding cannot differ between JSON/JavaScript and PostgreSQL.
    v_max_tension := ROUND((v_effective->>'durability')::NUMERIC, 4);
    v_reel_speed := ROUND(LEAST(1000, GREATEST(0.1,
        (v_balance->>'base_reel_speed')::NUMERIC
        * (1 + (v_effective->>'pull_strength')::NUMERIC / v_fish_strength))), 4);
    v_wait_time := FLOOR((v_balance->>'wait_min_ms')::NUMERIC
        + random() * (v_balance->>'wait_range_ms')::NUMERIC);
    v_bite_at := NOW() + v_wait_time * INTERVAL '1 millisecond';
    v_expires_at := v_bite_at + (v_balance->>'fight_seconds')::INTEGER * INTERVAL '1 second';
    v_challenge := jsonb_build_object(
        'sessionId', v_session_id, 'type', 'tension-challenge', 'version', 1,
        'seed', 1 + FLOOR(random() * 2147483646)::BIGINT,
        'startedAt', FLOOR(EXTRACT(EPOCH FROM v_bite_at) * 1000)::BIGINT,
        'expiresAt', FLOOR(EXTRACT(EPOCH FROM v_expires_at) * 1000)::BIGINT,
        'config', jsonb_build_object(
            'tickRate', 60,
            'safeMin', ROUND(v_max_tension * (v_balance->>'safe_min_ratio')::NUMERIC, 4),
            'safeMax', ROUND(v_max_tension * (v_balance->>'safe_max_ratio')::NUMERIC, 4),
            'maxTension', v_max_tension,
            'startTension', ROUND(v_max_tension * (v_balance->>'start_tension_ratio')::NUMERIC, 4),
            'startDistance', v_start_distance,
            'reelRate', 24, 'releaseRate', -48, 'reelSpeed', v_reel_speed,
            'slackEscapeSeconds', 2.5, 'slackThresholdRatio', 0.5,
            'slackDistanceRate', 2, 'fishPullMultiplier', 1, 'minimumStrength', 0.4
        ),
        'fish', jsonb_build_object(
            'id', COALESCE(v_species_id::TEXT, ''),
            'baseStrength', ROUND(v_fish_strength / (v_balance->>'strength_reference')::NUMERIC, 4),
            -- Full-stamina peak pull = effective_strength * burst_multiplier.
            'basePull', 0.8 * (v_balance->>'strength_reference')::NUMERIC,
            'pullAmplitude', 0.2 * (v_balance->>'strength_reference')::NUMERIC,
            'burstChance', v_burst_chance,
            'burstMin', ROUND(0.5 * (v_balance->>'strength_reference')::NUMERIC * (v_burst_multiplier - 1), 4),
            'burstMax', ROUND((v_balance->>'strength_reference')::NUMERIC * (v_burst_multiplier - 1), 4),
            'staminaDrain', v_stamina_drain,
            'pullPeriodTicks', 126, 'burstMinTicks', 24, 'burstMaxTicks', 84
        )
    );

    SELECT session_id INTO v_area_session_id FROM public.user_in_area
    WHERE user_id = v_user_id LIMIT 1;
    INSERT INTO public.fishing_sessions (
        id, user_id, area_id, species_id, secret_weight, challenge_data, expires_at,
        area_session_id, is_shiny, variant_type, star_rating, cast_depth, bite_at
    ) VALUES (
        v_session_id, v_user_id, p_area_id,
        CASE WHEN v_failure_reason IS NULL THEN v_species_id END,
        CASE WHEN v_failure_reason IS NULL THEN v_weight END,
        v_challenge, v_expires_at, v_area_session_id,
        v_is_shiny, v_variant_type, v_star_rating, p_cast_depth, v_bite_at
    );
    -- Private snapshot: never embed predetermined failure, hook roll, exact
    -- weight or bait inventory ID in client-readable challenge_data.
    INSERT INTO public.fishing_session_mechanics (
        session_id, equipment_snapshot, fish_snapshot, modifiers, balance, failure_reason
    ) VALUES (
        v_session_id, jsonb_build_object('items', v_equipment, 'base', v_base, 'effective', v_effective),
        v_fish_snapshot, v_modifiers, v_balance, v_failure_reason
    );
    RETURN jsonb_build_object('session_id', v_session_id, 'wait_time_ms', v_wait_time,
        'server_time_ms', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT);
END;
