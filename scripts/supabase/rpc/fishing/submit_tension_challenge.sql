-- Deploy after submit_challenge.sql. The replay function is private;
-- authenticated clients activate once, then submit their input replay.
CREATE OR REPLACE FUNCTION public.start_tension_challenge(p_session_id UUID)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_session public.fishing_sessions%ROWTYPE;
    v_now TIMESTAMPTZ;
    v_started_ms BIGINT;
    v_duration_ms BIGINT;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
    SELECT * INTO v_session FROM public.fishing_sessions
    WHERE id = p_session_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found or unauthorized'; END IF;
    v_now := clock_timestamp();
    IF v_session.status IS DISTINCT FROM 'BITE' OR v_now < v_session.bite_at THEN
        RAISE EXCEPTION 'Session is not ready or already processed';
    END IF;
    IF v_session.challenge_data->>'type' IS DISTINCT FROM 'tension-challenge'
       OR v_session.challenge_data->>'version' IS DISTINCT FROM '1'
       OR v_session.challenge_data->>'sessionId' IS DISTINCT FROM p_session_id::TEXT THEN
        RAISE EXCEPTION 'Session does not contain a tension challenge';
    END IF;
    IF v_now > v_session.expires_at THEN RAISE EXCEPTION 'Session expired'; END IF;

    -- Resolve no-fish, missed hooks and overloaded rods before starting a fight.
    -- These outcomes live in a private table, not client-readable challenge data.
    IF EXISTS (SELECT 1 FROM public.fishing_session_mechanics
        WHERE session_id = p_session_id AND failure_reason IS NOT NULL) THEN
        RETURN jsonb_build_object('resolution', public.resolve_fishing_challenge(p_session_id, FALSE, 0),
            'server_time_ms', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT);
    END IF;

    -- Resolve no-fish, missed hooks and overloaded rods before starting a fight.
    -- These outcomes live in a private table, not client-readable challenge data.
    IF EXISTS (SELECT 1 FROM public.fishing_session_mechanics
        WHERE session_id = p_session_id AND failure_reason IS NOT NULL) THEN
        RETURN jsonb_build_object('resolution', public.resolve_fishing_challenge(p_session_id, FALSE, 0),
            'server_time_ms', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT);
    END IF;

    -- Retry/reconnect must return the same start time, never restart the fight.
    IF NOT (v_session.challenge_data ? 'activatedAt') THEN
        v_duration_ms := (v_session.challenge_data->>'expiresAt')::BIGINT
            - (v_session.challenge_data->>'startedAt')::BIGINT;
        IF v_duration_ms IS NULL OR v_duration_ms NOT BETWEEN 1 AND 180000 THEN
            RAISE EXCEPTION 'Invalid challenge duration';
        END IF;
        v_started_ms := FLOOR(EXTRACT(EPOCH FROM v_now) * 1000)::BIGINT;
        UPDATE public.fishing_sessions
        SET challenge_data = challenge_data || jsonb_build_object(
                'startedAt', v_started_ms, 'activatedAt', v_started_ms,
                'expiresAt', v_started_ms + v_duration_ms),
            expires_at = to_timestamp((v_started_ms + v_duration_ms) / 1000.0)
        WHERE id = p_session_id
        RETURNING * INTO v_session;
    END IF;
    RETURN jsonb_build_object('challenge_data', v_session.challenge_data,
        'server_time_ms', FLOOR(EXTRACT(EPOCH FROM clock_timestamp()) * 1000)::BIGINT);
END;
$function$;

REVOKE ALL ON FUNCTION public.start_tension_challenge(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_tension_challenge(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.replay_tension_challenge(
    p_challenge JSONB, p_inputs JSONB, p_total_ticks INTEGER
) RETURNS JSONB
LANGUAGE plpgsql IMMUTABLE SET search_path = public
AS $function$
DECLARE
    -- Fixed-point scale 10000, identical to src/data/tensionChallenge.ts.
    v_scale CONSTANT BIGINT := 10000;
    v_mod CONSTANT BIGINT := 2147483647;
    v_rng BIGINT := (p_challenge->>'seed')::BIGINT;
    v_rate INTEGER := (p_challenge#>>'{config,tickRate}')::INTEGER;
    v_max_ticks INTEGER;
    v_safe_min BIGINT := ROUND((p_challenge#>>'{config,safeMin}')::NUMERIC * 10000);
    v_safe_max BIGINT := ROUND((p_challenge#>>'{config,safeMax}')::NUMERIC * 10000);
    v_max_tension BIGINT := ROUND((p_challenge#>>'{config,maxTension}')::NUMERIC * 10000);
    v_tension BIGINT := ROUND((p_challenge#>>'{config,startTension}')::NUMERIC * 10000);
    v_start_distance BIGINT := ROUND((p_challenge#>>'{config,startDistance}')::NUMERIC * 10000);
    v_distance BIGINT := v_start_distance;
    v_reel_rate BIGINT := ROUND((p_challenge#>>'{config,reelRate}')::NUMERIC * 10000);
    v_release_rate BIGINT := ROUND((p_challenge#>>'{config,releaseRate}')::NUMERIC * 10000);
    v_reel_speed BIGINT := ROUND((p_challenge#>>'{config,reelSpeed}')::NUMERIC * 10000);
    v_slack_limit NUMERIC := (p_challenge#>>'{config,slackEscapeSeconds}')::NUMERIC * v_rate;
    v_slack_ratio BIGINT := ROUND((p_challenge#>>'{config,slackThresholdRatio}')::NUMERIC * 10000);
    v_slack_distance BIGINT := ROUND((p_challenge#>>'{config,slackDistanceRate}')::NUMERIC * 10000);
    v_pull_multiplier BIGINT := ROUND((p_challenge#>>'{config,fishPullMultiplier}')::NUMERIC * 10000);
    v_min_strength BIGINT := ROUND((p_challenge#>>'{config,minimumStrength}')::NUMERIC * 10000);
    v_base_strength BIGINT := ROUND((p_challenge#>>'{fish,baseStrength}')::NUMERIC * 10000);
    v_burst_chance DOUBLE PRECISION := (p_challenge#>>'{fish,burstChance}')::DOUBLE PRECISION;
    v_burst_min BIGINT := ROUND((p_challenge#>>'{fish,burstMin}')::NUMERIC * 10000);
    v_burst_max BIGINT := ROUND((p_challenge#>>'{fish,burstMax}')::NUMERIC * 10000);
    v_drain BIGINT := ROUND((p_challenge#>>'{fish,staminaDrain}')::NUMERIC * 10000);
    v_base_pull BIGINT := ROUND((p_challenge#>>'{fish,basePull}')::NUMERIC * 10000);
    v_amplitude BIGINT := ROUND((p_challenge#>>'{fish,pullAmplitude}')::NUMERIC * 10000);
    v_period INTEGER := (p_challenge#>>'{fish,pullPeriodTicks}')::INTEGER;
    v_burst_min_ticks INTEGER := (p_challenge#>>'{fish,burstMinTicks}')::INTEGER;
    v_burst_max_ticks INTEGER := (p_challenge#>>'{fish,burstMaxTicks}')::INTEGER;
    v_stamina BIGINT := 10000;
    v_slack_ticks INTEGER := 0;
    v_burst BIGINT := 0;
    v_burst_left INTEGER := 0;
    v_chance BIGINT;
    v_magnitude BIGINT;
    v_duration BIGINT;
    v_phase INTEGER;
    v_wave BIGINT;
    v_strength BIGINT;
    v_pull BIGINT;
    v_reeling BOOLEAN := FALSE;
    v_result TEXT := 'fighting';
    v_tick INTEGER;
    v_input JSONB;
    v_input_tick INTEGER;
    v_previous_tick INTEGER := -1;
    v_previous_reeling BOOLEAN := FALSE;
    v_input_ticks INTEGER[] := ARRAY[]::INTEGER[];
    v_input_states BOOLEAN[] := ARRAY[]::BOOLEAN[];
    v_input_index INTEGER := 1;
BEGIN
    IF p_challenge->>'type' IS DISTINCT FROM 'tension-challenge'
       OR p_challenge->>'version' IS DISTINCT FROM '1'
       OR v_rate IS NULL OR v_rate NOT BETWEEN 1 AND 120
       OR v_rng IS NULL OR v_rng NOT BETWEEN 1 AND 2147483646 THEN
        RAISE EXCEPTION 'Unsupported tension challenge';
    END IF;
    v_max_ticks := FLOOR(((p_challenge->>'expiresAt')::BIGINT - (p_challenge->>'startedAt')::BIGINT) * v_rate / 1000.0);
    IF v_max_ticks IS NULL OR v_max_ticks NOT BETWEEN 1 AND 21600
       OR p_total_ticks IS NULL OR p_total_ticks NOT BETWEEN 1 AND v_max_ticks THEN
        RAISE EXCEPTION 'Invalid totalTicks';
    END IF;
    IF jsonb_typeof(p_inputs) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'inputs must be an array'; END IF;
    IF jsonb_array_length(p_inputs) > p_total_ticks THEN RAISE EXCEPTION 'Too many input changes'; END IF;

    FOR v_input IN SELECT value FROM jsonb_array_elements(p_inputs) LOOP
        IF jsonb_typeof(v_input) IS DISTINCT FROM 'object'
           OR jsonb_typeof(v_input->'tick') IS DISTINCT FROM 'number'
           OR COALESCE(v_input->>'tick', '') !~ '^[0-9]{1,5}$'
           OR jsonb_typeof(v_input->'reeling') IS DISTINCT FROM 'boolean' THEN
            RAISE EXCEPTION 'Invalid input event';
        END IF;
        v_input_tick := (v_input->>'tick')::INTEGER;
        IF v_input_tick <= v_previous_tick OR v_input_tick >= p_total_ticks
           OR (v_input->>'reeling')::BOOLEAN = v_previous_reeling THEN
            RAISE EXCEPTION 'Inputs must be ordered state changes within totalTicks';
        END IF;
        v_input_ticks := array_append(v_input_ticks, v_input_tick);
        v_previous_reeling := (v_input->>'reeling')::BOOLEAN;
        v_input_states := array_append(v_input_states, v_previous_reeling);
        v_previous_tick := v_input_tick;
    END LOOP;

    FOR v_tick IN 0..p_total_ticks - 1 LOOP
        IF v_input_ticks[v_input_index] = v_tick THEN
            v_reeling := v_input_states[v_input_index];
            v_input_index := v_input_index + 1;
        END IF;
        IF v_burst_left <= 0 THEN
            v_rng := (v_rng * 48271) % v_mod; v_chance := v_rng;
            v_rng := (v_rng * 48271) % v_mod; v_magnitude := v_rng;
            v_rng := (v_rng * 48271) % v_mod; v_duration := v_rng;
            v_burst := CASE WHEN v_chance::DOUBLE PRECISION / v_mod < v_burst_chance
                THEN v_burst_min + (v_burst_max - v_burst_min) * v_magnitude / v_mod ELSE 0 END;
            v_burst_left := v_burst_min_ticks + (v_burst_max_ticks - v_burst_min_ticks + 1)::BIGINT * v_duration / v_mod;
        END IF;
        v_burst_left := v_burst_left - 1;
        v_phase := v_tick % v_period;
        v_wave := 4 * v_scale * LEAST(v_phase, v_period - v_phase) / v_period - v_scale;
        v_strength := v_min_strength + (v_scale - v_min_strength) * v_stamina / v_scale;
        v_pull := v_base_pull + v_amplitude * v_wave / v_scale + v_burst;
        v_pull := v_pull * v_base_strength / v_scale;
        v_pull := v_pull * v_strength / v_scale;
        v_pull := v_pull * v_pull_multiplier / v_scale;
        v_tension := GREATEST(0, v_tension + (v_pull + CASE WHEN v_reeling THEN v_reel_rate ELSE v_release_rate END) / v_rate);
        IF v_tension BETWEEN v_safe_min AND v_safe_max THEN
            v_stamina := GREATEST(0, v_stamina - v_drain / v_rate);
        END IF;
        IF v_reeling AND v_tension >= v_safe_min THEN v_distance := v_distance - v_reel_speed / v_rate; END IF;
        IF v_tension < v_safe_min THEN v_distance := LEAST(v_start_distance, v_distance + v_slack_distance / v_rate); END IF;
        v_slack_ticks := CASE WHEN v_tension < v_safe_min * v_slack_ratio / v_scale THEN v_slack_ticks + 1 ELSE 0 END;
        IF v_tension >= v_max_tension THEN v_result := 'snapped';
        ELSIF v_slack_ticks > v_slack_limit THEN v_result := 'escaped';
        ELSIF v_distance <= 0 THEN v_result := 'won';
        ELSIF v_tick + 1 >= v_max_ticks THEN v_result := 'timeout';
        END IF;
        IF v_result <> 'fighting' THEN
            IF v_tick + 1 <> p_total_ticks THEN RAISE EXCEPTION 'Inputs continue after the fight ended'; END IF;
            RETURN jsonb_build_object('result', v_result, 'totalTicks', v_tick + 1,
                'tension', v_tension, 'distance', v_distance, 'stamina', v_stamina, 'rng', v_rng);
        END IF;
    END LOOP;
    RAISE EXCEPTION 'Fight has not finished';
END;
$function$;

REVOKE ALL ON FUNCTION public.replay_tension_challenge(JSONB, JSONB, INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_tension_challenge(p_payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_session public.fishing_sessions%ROWTYPE;
    v_session_id UUID;
    v_total_ticks INTEGER;
    v_rate INTEGER;
    v_verified JSONB;
    v_response JSONB;
    v_claimed TEXT;
    v_now TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
    IF jsonb_typeof(p_payload) IS DISTINCT FROM 'object'
       OR jsonb_typeof(p_payload->'sessionId') IS DISTINCT FROM 'string'
       OR jsonb_typeof(p_payload->'totalTicks') IS DISTINCT FROM 'number'
       OR COALESCE(p_payload->>'totalTicks', '') !~ '^[0-9]{1,5}$'
       OR jsonb_typeof(p_payload->'claimedResult') IS DISTINCT FROM 'string'
       OR COALESCE(p_payload->>'claimedResult', '') NOT IN ('won', 'snapped', 'escaped', 'timeout') THEN
        RAISE EXCEPTION 'Invalid tension submission';
    END IF;
    v_session_id := (p_payload->>'sessionId')::UUID;
    v_total_ticks := (p_payload->>'totalTicks')::INTEGER;
    v_claimed := p_payload->>'claimedResult';
    SELECT * INTO v_session FROM public.fishing_sessions
    WHERE id = v_session_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found or unauthorized'; END IF;
    v_now := clock_timestamp();
    IF v_session.status IS DISTINCT FROM 'BITE' THEN RAISE EXCEPTION 'Session is not ready or already processed'; END IF;
    IF v_session.challenge_data->>'type' IS DISTINCT FROM 'tension-challenge'
       OR v_session.challenge_data->>'sessionId' IS DISTINCT FROM v_session_id::TEXT THEN
        RAISE EXCEPTION 'Session does not contain a tension challenge';
    END IF;
    IF v_session.challenge_data->>'activatedAt' IS NULL
       OR v_session.challenge_data->>'activatedAt' IS DISTINCT FROM v_session.challenge_data->>'startedAt' THEN
        RAISE EXCEPTION 'Tension challenge has not been started';
    END IF;
    IF v_now > v_session.expires_at + INTERVAL '5 seconds' THEN
        RETURN public.resolve_fishing_challenge(v_session_id, FALSE, 0);
    END IF;
    v_rate := (v_session.challenge_data#>>'{config,tickRate}')::INTEGER;
    IF v_rate IS NULL OR v_rate NOT BETWEEN 1 AND 120 THEN RAISE EXCEPTION 'Invalid tick rate'; END IF;
    IF v_now < v_session.bite_at OR v_total_ticks::BIGINT * 1000 >
        (EXTRACT(EPOCH FROM v_now) * 1000 - (v_session.challenge_data->>'startedAt')::BIGINT + 500) * v_rate THEN
        RAISE EXCEPTION 'Invalid execution time';
    END IF;
    v_verified := public.replay_tension_challenge(v_session.challenge_data, p_payload->'inputs', v_total_ticks);
    UPDATE public.fishing_sessions SET challenge_data = challenge_data || jsonb_build_object(
        'verification', jsonb_build_object('claimedResult', v_claimed, 'verifiedResult', v_verified->>'result',
            'matched', v_claimed = v_verified->>'result', 'totalTicks', v_total_ticks, 'submittedAt', v_now)
    ) WHERE id = v_session_id;
    IF v_claimed IS DISTINCT FROM v_verified->>'result' THEN
        RAISE LOG 'Tension result mismatch: session %, claimed %, verified %', v_session_id, v_claimed, v_verified->>'result';
    END IF;
    -- claimedResult is only diagnostic. The replay decides rewards and XP.
    v_response := public.resolve_fishing_challenge(v_session_id, v_verified->>'result' = 'won', (v_total_ticks * 1000) / v_rate);
    IF v_session.species_id IS NOT NULL AND v_response->>'result' = 'FISH_ESCAPED' THEN
        v_response := v_response || jsonb_build_object(
            'result', CASE v_verified->>'result' WHEN 'snapped' THEN 'LINE_SNAPPED'
                WHEN 'timeout' THEN 'TIMEOUT' ELSE 'FISH_ESCAPED' END,
            'message', CASE v_verified->>'result'
                WHEN 'snapped' THEN 'Dây câu đã đứt vì lực căng vượt ngưỡng chịu lực.'
                WHEN 'timeout' THEN 'Hết thời gian kéo cá về bờ.'
                ELSE 'Dây quá chùng, cá đã thoát.' END);
    END IF;
    RETURN v_response || jsonb_build_object('verifiedResult', v_verified->>'result', 'claimedResultMatched', v_claimed = v_verified->>'result');
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_tension_challenge(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_tension_challenge(JSONB) TO authenticated;
