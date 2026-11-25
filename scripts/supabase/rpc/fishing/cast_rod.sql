-- Execute this complete definition, including the SECURITY DEFINER wrapper.
-- Deploy equipment_mechanics.sql, 20261115_ranked_fishing.sql and both submit RPC files first.
-- Requires fishing_areas.timezone and countries.default_timezone (IANA names).
-- Deploy 20261118_fishing_area_depth_tool.sql before this definition.
-- Rules v2; tension replay protocol remains v1 (only configuration changes).
-- Deploy the helpers and cast together; preview_fish_by_depth uses these helpers too.
BEGIN;

-- Normalize server-owned weather data only. Unsupported/malformed entries are
-- retained in the private audit, but cannot break fishing or change other stats.
CREATE OR REPLACE FUNCTION public.fishing_weather_modifiers(p_effects JSONB)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
    e JSONB; code TEXT; target TEXT; unit TEXT; rarity TEXT; amount NUMERIC;
    stats JSONB := '{}'; applied JSONB := '[]'; ignored JSONB := '[]';
    entry JSONB; addition NUMERIC; multiplier NUMERIC;
BEGIN
    IF jsonb_typeof(p_effects) IS DISTINCT FROM 'array' THEN
        RETURN jsonb_build_object('stats', stats, 'applied', applied, 'ignored',
            CASE WHEN p_effects IS NULL THEN '[]'::JSONB ELSE jsonb_build_array(p_effects) END);
    END IF;
    FOR e IN SELECT value FROM jsonb_array_elements(p_effects) LOOP
        code := upper(btrim(e->>'code'));
        unit := upper(btrim(e->>'unit'));
        target := CASE code
            WHEN 'EPIC_CATCH_RATE' THEN 'spawn_multiplier_EPIC'
            WHEN 'LEGENDARY_CATCH_RATE' THEN 'spawn_multiplier_LEGENDARY'
            WHEN 'RARE_CATCH_RATE' THEN 'spawn_multiplier_RARE'
            WHEN 'RARE_RATE_DOWN' THEN 'rare_spawn'
            WHEN 'FISHING_SPEED' THEN 'reel_speed'
            WHEN 'FISHING_SPEED_DOWN' THEN 'reel_speed'
            WHEN 'LUCK' THEN 'luck_bonus'
            WHEN 'LUCK_DOWN' THEN 'luck_bonus'
            WHEN 'FISH_WEIGHT_DOWN' THEN 'fish_weight'
            WHEN 'CATCH_RATE_DOWN' THEN 'catch_probability'
            ELSE lower(code) END;
        IF target IS NULL OR target <> ALL(ARRAY[
            'max_weight','pull_strength','durability','catch_rate','luck_bonus','fish_strength','catch_probability',
            'spawn_add','spawn_multiplier','rare_spawn','spawn_multiplier_RARE','spawn_multiplier_EPIC','spawn_multiplier_LEGENDARY',
            'matched_attraction','unmatched_attraction','matched_catch_factor','unmatched_catch_factor',
            'weight_cap','fish_weight_bias','fish_weight','alertness','wait_time','reel_speed','fight_seconds',
            'start_distance','burst_chance','burst_multiplier','stamina_drain','safe_min_ratio','safe_max_ratio',
            'start_tension_ratio','slack_escape_seconds','slack_distance_rate','slack_threshold_ratio',
            'fish_pull_multiplier','reel_rate','release_rate','pull_period_ticks','burst_min_ticks','burst_max_ticks',
            'base_pull','pull_amplitude','minimum_strength','extreme_weight','fatigue_score'
        ]) OR jsonb_typeof(e->'value') IS DISTINCT FROM 'number'
           OR unit IS NULL OR unit NOT IN ('PERCENT', 'POINT') THEN
            ignored := ignored || jsonb_build_array(e); CONTINUE;
        END IF;
        amount := (e->>'value')::NUMERIC;
        IF amount::TEXT IN ('NaN','Infinity','-Infinity') OR abs(amount) > 1000000
           OR (target = 'spawn_add' AND unit <> 'POINT')
           OR (unit = 'POINT' AND target NOT IN ('luck_bonus','spawn_add')) THEN
            ignored := ignored || jsonb_build_array(e); CONTINUE;
        END IF;
        IF code IN ('RARE_RATE_DOWN','FISHING_SPEED_DOWN','LUCK_DOWN','FISH_WEIGHT_DOWN','CATCH_RATE_DOWN') THEN
            amount := -abs(amount);
        END IF;
        -- Optional rarity scope for generic spawn effects. No scope means all
        -- species; a common multiplier cancels in relative encounter chances.
        IF target IN ('spawn_add','spawn_multiplier') AND e ? 'rarity' THEN
            rarity := upper(btrim(e->>'rarity'));
            IF rarity IS NULL OR rarity NOT IN ('COMMON','UNCOMMON','RARE','EPIC','LEGENDARY') THEN
                ignored := ignored || jsonb_build_array(e); CONTINUE;
            END IF;
            target := target || '_' || rarity;
        END IF;
        entry := stats->target;
        addition := COALESCE((entry->>'add')::NUMERIC, 0);
        multiplier := COALESCE((entry->>'multiplier')::NUMERIC, 1);
        IF unit = 'POINT' THEN addition := LEAST(1000000, GREATEST(-1000000, addition + amount));
        ELSE multiplier := LEAST(1000000, multiplier * GREATEST(0, 1 + amount / 100)); END IF;
        stats := jsonb_set(stats, ARRAY[target], jsonb_build_object('add', addition, 'multiplier', multiplier));
        applied := applied || jsonb_build_array(jsonb_build_object('code', code, 'target', target, 'unit', unit, 'value', amount));
    END LOOP;
    RETURN jsonb_build_object('stats', stats, 'applied', applied, 'ignored', ignored);
END;
$$;

CREATE OR REPLACE FUNCTION public.fishing_effective_stat(
    p_base NUMERIC, p_modifiers JSONB, p_target TEXT,
    p_min NUMERIC DEFAULT 0, p_max NUMERIC DEFAULT 1000000
) RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT LEAST(p_max, GREATEST(p_min,
        (p_base + COALESCE((p_modifiers#>>ARRAY[p_target,'add'])::NUMERIC, 0))
        * COALESCE((p_modifiers#>>ARRAY[p_target,'multiplier'])::NUMERIC, 1)));
$$;

CREATE OR REPLACE FUNCTION public.fishing_weather_spawn_weight(p_weight NUMERIC, p_rarity TEXT, p_modifiers JSONB)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
    SELECT GREATEST(0, p_weight
        + COALESCE((p_modifiers#>>'{spawn_add,add}')::NUMERIC, 0)
        + COALESCE((p_modifiers#>>ARRAY['spawn_add_' || upper(p_rarity),'add'])::NUMERIC, 0))
        * public.fishing_effective_stat(1, p_modifiers, 'spawn_multiplier')
        * public.fishing_effective_stat(1, p_modifiers, 'spawn_multiplier_' || upper(p_rarity))
        * CASE WHEN upper(p_rarity) IN ('RARE','EPIC','LEGENDARY')
            THEN public.fishing_effective_stat(1, p_modifiers, 'rare_spawn') ELSE 1 END;
$$;

REVOKE ALL ON FUNCTION public.fishing_weather_modifiers(JSONB) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fishing_effective_stat(NUMERIC, JSONB, TEXT, NUMERIC, NUMERIC) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fishing_weather_spawn_weight(NUMERIC, TEXT, JSONB) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.cast_rod(p_area_id UUID, p_cast_depth NUMERIC)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
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

    -- BALANCE defaults: selected weather adjustments are snapshotted below.
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
    v_allow_depth_tool BOOLEAN := FALSE;
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
    v_presence JSONB;
    v_weight_cap NUMERIC := 1;
    v_rare_spawn NUMERIC := 1;
    v_extreme_weight NUMERIC := 1;
    v_weather_id UUID;
    v_weather_effects JSONB;
    v_weather JSONB;
    v_zone_id UUID;
    v_weather_expires_at TIMESTAMPTZ;
    v_alertness NUMERIC;
    v_safe_min NUMERIC;
    v_safe_max NUMERIC;
    v_base_pull NUMERIC;
    v_burst_min_ticks INTEGER;
    v_burst_max_ticks INTEGER;
BEGIN
    -- ================================================================
    -- A. Snapshot exactly one equipped item per slot.
    -- Stats come from user_inventory.data; set entries contain references
    -- and selection flags only and cannot override inventory stats.
    -- ================================================================
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
    IF p_area_id IS NULL THEN RAISE EXCEPTION 'Fishing area is required'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.user_in_area
        WHERE user_id = v_user_id AND area_id = p_area_id AND status = 'enter') THEN
        RAISE EXCEPTION 'Player is not in this fishing area';
    END IF;
    v_presence := public.touch_fishing_presence();
    v_weight_cap := public.fishing_fatigue_multiplier(v_presence->'effects', 'weight_cap');
    v_rare_spawn := public.fishing_fatigue_multiplier(v_presence->'effects', 'rare_spawn');
    -- Snapshot the actual server-owned weather at cast time. An expired or
    -- missing weather is neutral, never supplied by the client.
    SELECT w.id, w.extreme_weight, z.id, z.weather_expires_at, z.weather_active_modifiers
    INTO v_weather_id, v_extreme_weight, v_zone_id, v_weather_expires_at, v_weather_effects
    FROM public.fishing_areas a JOIN public.zones z ON z.id = a.zone_id
    JOIN public.weathers w ON w.id = z.weather_id
    WHERE a.id = p_area_id AND z.weather_expires_at > clock_timestamp();
    v_extreme_weight := COALESCE(v_extreme_weight, 1);
    v_weather := public.fishing_weather_modifiers(v_weather_effects);
    v_modifiers := v_modifiers || (v_weather->'stats') || jsonb_build_object('_weather',
        jsonb_build_object('weather_id', v_weather_id, 'zone_id', v_zone_id,
            'expires_at', v_weather_expires_at, 'effects', COALESCE(v_weather_effects, '[]'::JSONB),
            'applied', v_weather->'applied', 'ignored', v_weather->'ignored'));
    v_extreme_weight := public.fishing_effective_stat(v_extreme_weight, v_modifiers, 'extreme_weight');
    v_weight_cap := public.fishing_effective_stat(v_weight_cap, v_modifiers, 'weight_cap', 0, 1);
    IF p_cast_depth IS NULL OR p_cast_depth < 0
       OR p_cast_depth::TEXT IN ('NaN', 'Infinity', '-Infinity') THEN
        RAISE EXCEPTION 'Invalid cast depth';
    END IF;

    -- Blank area values inherit the country's default; invalid values fail.
    SELECT COALESCE(NULLIF(btrim(a.timezone), ''), NULLIF(btrim(c.default_timezone), '')),
        COALESCE(a.allow_depth_tool, FALSE)
    INTO v_timezone, v_allow_depth_tool
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
    -- B. Weather has been normalized above; future server effects also compose
    -- before resolving player stats. Equipment JSON never supplies modifiers.
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
    FOREACH v_stat IN ARRAY ARRAY['matched_attraction','unmatched_attraction','matched_catch_factor','unmatched_catch_factor'] LOOP
        v_balance := jsonb_set(v_balance, ARRAY[v_stat], to_jsonb(
            public.fishing_effective_stat((v_balance->>v_stat)::NUMERIC, v_modifiers, v_stat)));
    END LOOP;
    v_balance := jsonb_set(v_balance, '{fight_seconds}', to_jsonb(
        public.fishing_effective_stat((v_balance->>'fight_seconds')::NUMERIC, v_modifiers, 'fight_seconds', 1, 180)));
    v_hour := EXTRACT(HOUR FROM (NOW() AT TIME ZONE v_timezone));
    v_time_bucket := CASE WHEN v_hour BETWEEN 6 AND 18 THEN 'DAY' ELSE 'NIGHT' END;

    -- ================================================================
    -- C. Encounter selection: optional depth -> relative frequency -> bait.
    -- Only areas with allow_depth_tool = TRUE use the cast depth/scopes.
    -- Bait cannot bypass active depth restrictions or active_time.
    -- P(species i) = final_weight_i / SUM(final_weight).
    -- A common multiplier on ALL species cancels and is intentionally absent.
    -- ================================================================
    WITH candidates AS (
        SELECT sa.species_id, sa.weight_rate, s.fish_type, s.rarity,
            CASE
                WHEN NOT v_allow_depth_tool THEN 1.0::NUMERIC
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
        LEFT JOIN public.depth_scope ds ON ds.id = sa.depth_scope_id AND v_allow_depth_tool
        WHERE sa.area_id = p_area_id
          AND (s.active_time IS NULL OR s.active_time = 'ALL' OR s.active_time = v_time_bucket)
          AND sa.weight_rate > 0
          AND sa.weight_rate::TEXT NOT IN ('NaN', 'Infinity', '-Infinity')
    ), weighted_candidates AS (
        SELECT species_id,
            public.fishing_weather_spawn_weight(GREATEST(0, weight_rate + spawn_add) * spawn_multiplier, rarity, v_modifiers) * depth_weight
            * CASE WHEN UPPER(rarity) IN ('RARE', 'EPIC', 'LEGENDARY') THEN v_rare_spawn ELSE 1 END
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
        v_burst_multiplier := public.fishing_effective_stat(v_burst_multiplier, v_modifiers, 'burst_multiplier', 1, 10);
        v_alertness := public.fishing_effective_stat(v_species.alertness, v_modifiers, 'alertness', 0, 1);
        v_weight_ratio := (random() + random() + random()) / 3.0;
        -- Positive bias favors heavy fish without exceeding the effective cap.
        v_value := public.fishing_effective_stat(1, v_modifiers, 'fish_weight_bias');
        IF v_value = 0 THEN v_weight_ratio := 0;
        ELSIF v_value <> 1 THEN
            v_weight_ratio := v_weight_ratio * v_value / (1 - v_weight_ratio + v_weight_ratio * v_value);
        END IF;
        v_weight_ratio := v_weight_ratio * v_weight_cap;
        v_weight := LEAST(ROUND(public.fishing_effective_stat(v_species.weight_min + v_weight_ratio *
            (v_species.weight_max - v_species.weight_min), v_modifiers, 'fish_weight', v_species.weight_min,
            v_species.weight_min + v_weight_cap * (v_species.weight_max - v_species.weight_min)), 2),
            v_species.weight_min + v_weight_cap * (v_species.weight_max - v_species.weight_min));
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
                * v_bait_factor * (1 - v_alertness))
                + (v_modifiers#>>'{catch_probability,add}')::NUMERIC)
            * (v_modifiers#>>'{catch_probability,multiplier}')::NUMERIC));
        IF random() >= v_catch_probability THEN v_failure_reason := 'HOOK_MISSED';
        ELSIF v_weight > (v_effective->>'max_weight')::NUMERIC THEN
            v_failure_reason := 'ROD_OVERWEIGHT';
        END IF;
        v_fish_snapshot := jsonb_build_object('species_id', v_species_id,
            'weight', v_weight, 'weight_ratio', v_weight_ratio, 'base_strength', v_species.strength,
            'effective_strength', v_fish_strength, 'burst_multiplier', v_burst_multiplier,
            'fish_type', v_species.fish_type, 'alertness', v_alertness, 'base_alertness', v_species.alertness,
            'base_catch_rate', v_species.base_catch_rate, 'bait_matches', v_bait_matches,
            'catch_probability', v_catch_probability,
            'scoring', jsonb_build_object(
                'w_norm', v_weight_ratio, 'rare_weight', v_species.rare_weight,
                'extreme_weight', v_extreme_weight, 'weather_id', v_weather_id,
                'fatigue_score', v_presence->'fatigue_score',
                'fatigue_multiplier', public.fishing_effective_stat(
                    public.fishing_fatigue_multiplier(v_presence->'effects', 'score'), v_modifiers, 'fatigue_score'),
                'fatigue_effects', v_presence->'effects',
                'fish', jsonb_build_object('species_id', v_species_id, 'name', v_species.name,
                    'image', v_species.image, 'rarity', v_species.rarity, 'weight', v_weight)));

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
    v_start_distance := ROUND(public.fishing_effective_stat(v_start_distance, v_modifiers, 'start_distance', 0.0001, 1000), 4);
    v_burst_chance := ROUND(public.fishing_effective_stat(v_burst_chance, v_modifiers, 'burst_chance', 0, 1), 4);
    v_stamina_drain := ROUND(public.fishing_effective_stat(v_stamina_drain, v_modifiers, 'stamina_drain', 0, 1), 4);

    -- ================================================================
    -- E. All casts use tension, with no timing-bar data.
    -- durability is accumulated tension capacity, NOT weight or a one-time
    -- comparison with fish force (which adds tension points per second).
    -- Stronger line increases headroom; fish forces are NOT scaled with it.
    -- ================================================================
    -- Quantize emitted values to the replay's 1/10000 precision so decimal
    -- half-rounding cannot differ between JSON/JavaScript and PostgreSQL.
    v_max_tension := ROUND((v_effective->>'durability')::NUMERIC, 4);
    v_reel_speed := (v_balance->>'base_reel_speed')::NUMERIC
        * (1 + (v_effective->>'pull_strength')::NUMERIC / v_fish_strength);
    v_reel_speed := ROUND(public.fishing_effective_stat(v_reel_speed, v_modifiers, 'reel_speed', 0.1, 1000), 4);
    v_wait_time := FLOOR(public.fishing_effective_stat(((v_balance->>'wait_min_ms')::NUMERIC
        + random() * (v_balance->>'wait_range_ms')::NUMERIC)::NUMERIC, v_modifiers, 'wait_time', 100, 120000));
    v_bite_at := NOW() + v_wait_time * INTERVAL '1 millisecond';
    v_expires_at := v_bite_at + (v_balance->>'fight_seconds')::NUMERIC * INTERVAL '1 second';
    v_safe_min := ROUND(v_max_tension * public.fishing_effective_stat(
        (v_balance->>'safe_min_ratio')::NUMERIC, v_modifiers, 'safe_min_ratio', 0.0001, 0.9998), 4);
    v_safe_max := LEAST(v_max_tension - 0.0001, GREATEST(v_safe_min + 0.0001,
        ROUND(v_max_tension * public.fishing_effective_stat(
            (v_balance->>'safe_max_ratio')::NUMERIC, v_modifiers, 'safe_max_ratio', 0.0001, 0.9999), 4)));
    v_base_pull := ROUND(public.fishing_effective_stat(0.8 * (v_balance->>'strength_reference')::NUMERIC,
        v_modifiers, 'base_pull', 0, 1000), 4);
    v_burst_min_ticks := ROUND(public.fishing_effective_stat(24, v_modifiers, 'burst_min_ticks', 1, 10800));
    v_burst_max_ticks := GREATEST(v_burst_min_ticks,
        ROUND(public.fishing_effective_stat(84, v_modifiers, 'burst_max_ticks', 1, 10800)));
    v_challenge := jsonb_build_object(
        'sessionId', v_session_id, 'type', 'tension-challenge', 'version', 1,
        'seed', 1 + FLOOR(random() * 2147483646)::BIGINT,
        'startedAt', FLOOR(EXTRACT(EPOCH FROM v_bite_at) * 1000)::BIGINT,
        'expiresAt', FLOOR(EXTRACT(EPOCH FROM v_expires_at) * 1000)::BIGINT,
        'config', jsonb_build_object(
            'tickRate', 60,
            'safeMin', v_safe_min,
            'safeMax', v_safe_max,
            'maxTension', v_max_tension,
            'startTension', LEAST(v_max_tension - 0.0001, ROUND(v_max_tension * public.fishing_effective_stat(
                (v_balance->>'start_tension_ratio')::NUMERIC, v_modifiers, 'start_tension_ratio', 0, 1), 4)),
            'startDistance', v_start_distance,
            'reelRate', ROUND(public.fishing_effective_stat(24, v_modifiers, 'reel_rate', 0.0001, 1000), 4),
            'releaseRate', ROUND(public.fishing_effective_stat(-48, v_modifiers, 'release_rate', -1000, -0.0001), 4),
            'reelSpeed', v_reel_speed,
            'slackEscapeSeconds', ROUND(public.fishing_effective_stat(2.5, v_modifiers, 'slack_escape_seconds', 0.0001, 180), 4),
            'slackThresholdRatio', ROUND(public.fishing_effective_stat(0.5, v_modifiers, 'slack_threshold_ratio', 0.0001, 1), 4),
            'slackDistanceRate', ROUND(public.fishing_effective_stat(2, v_modifiers, 'slack_distance_rate', 0, 1000), 4),
            'fishPullMultiplier', ROUND(public.fishing_effective_stat(1, v_modifiers, 'fish_pull_multiplier', 0, 10), 4),
            'minimumStrength', ROUND(public.fishing_effective_stat(0.4, v_modifiers, 'minimum_strength', 0, 1), 4)
        ),
        'fish', jsonb_build_object(
            'id', COALESCE(v_species_id::TEXT, ''),
            'baseStrength', ROUND(v_fish_strength / (v_balance->>'strength_reference')::NUMERIC, 4),
            -- Full-stamina peak pull = effective_strength * burst_multiplier.
            'basePull', v_base_pull,
            'pullAmplitude', LEAST(v_base_pull, ROUND(public.fishing_effective_stat(
                0.2 * (v_balance->>'strength_reference')::NUMERIC, v_modifiers, 'pull_amplitude', 0, 1000), 4)),
            'burstChance', v_burst_chance,
            'burstMin', ROUND(0.5 * (v_balance->>'strength_reference')::NUMERIC * (v_burst_multiplier - 1), 4),
            'burstMax', ROUND((v_balance->>'strength_reference')::NUMERIC * (v_burst_multiplier - 1), 4),
            'staminaDrain', v_stamina_drain,
            'pullPeriodTicks', ROUND(public.fishing_effective_stat(126, v_modifiers, 'pull_period_ticks', 4, 10800)),
            'burstMinTicks', v_burst_min_ticks, 'burstMaxTicks', v_burst_max_ticks
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
    PERFORM public.update_daily_mission_progress(event_type => 'CAST_ROD');

    RETURN jsonb_build_object('session_id', v_session_id, 'wait_time_ms', v_wait_time,
        'server_time_ms', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT);
END;
$function$;
REVOKE ALL ON FUNCTION public.cast_rod(UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cast_rod(UUID, NUMERIC) TO authenticated;
COMMIT;
