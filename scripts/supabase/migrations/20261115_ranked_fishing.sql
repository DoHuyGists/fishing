-- Requires equipment_mechanics.sql and the existing fishing / weather tables.
-- Deploy this migration, then the updated cast_rod and submit_challenge RPCs.
BEGIN;

ALTER TABLE public.species
  ADD COLUMN IF NOT EXISTS rare_weight NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS season_weight NUMERIC NOT NULL DEFAULT 1;
UPDATE public.species SET rare_weight = 1 WHERE rare_weight IS NULL;
UPDATE public.species SET season_weight = 1 WHERE season_weight IS NULL;
ALTER TABLE public.species ALTER COLUMN rare_weight SET DEFAULT 1, ALTER COLUMN rare_weight SET NOT NULL,
  ALTER COLUMN season_weight SET DEFAULT 1, ALTER COLUMN season_weight SET NOT NULL;
ALTER TABLE public.species
  ADD CONSTRAINT species_rare_weight_valid CHECK (rare_weight > 0 AND rare_weight <= 1000000),
  ADD CONSTRAINT species_season_weight_valid CHECK (season_weight > 0 AND season_weight <= 1000000);
-- The existing project calls this table weathers, rather than weather.
ALTER TABLE public.weathers ADD COLUMN IF NOT EXISTS extreme_weight NUMERIC NOT NULL DEFAULT 1;
UPDATE public.weathers SET extreme_weight = 1 WHERE extreme_weight IS NULL;
ALTER TABLE public.weathers ALTER COLUMN extreme_weight SET DEFAULT 1, ALTER COLUMN extreme_weight SET NOT NULL;
ALTER TABLE public.weathers ADD CONSTRAINT weather_extreme_weight_valid CHECK (extreme_weight > 0 AND extreme_weight <= 1000000);

CREATE TABLE public.user_area_fatigue (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.fishing_areas(id) ON DELETE CASCADE,
  fatigue_score NUMERIC NOT NULL DEFAULT 0 CHECK (fatigue_score BETWEEN 0 AND 100),
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  active_until TIMESTAMPTZ,
  PRIMARY KEY (user_id, area_id)
);
CREATE TABLE public.fatigue_effects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modifier_id UUID NOT NULL REFERENCES public.modifiers(id) ON DELETE RESTRICT,
  min_fatigue NUMERIC NOT NULL CHECK (min_fatigue BETWEEN 0 AND 100),
  -- An exclusive upper bound allows an explicit final tier including 100.
  max_fatigue NUMERIC NOT NULL DEFAULT 101 CHECK (max_fatigue > min_fatigue AND max_fatigue <= 101),
  target TEXT NOT NULL CHECK (target IN ('weight_cap', 'rare_spawn', 'score')),
  value NUMERIC NOT NULL CHECK (value BETWEEN -100 AND 0),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (modifier_id, min_fatigue)
);

-- Settle the occupied segment BEFORE applying recovery: the cap is per segment.
CREATE FUNCTION public.fishing_fatigue_value(p_score NUMERIC, p_at TIMESTAMPTZ,
  p_active_until TIMESTAMPTZ, p_now TIMESTAMPTZ) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT GREATEST(0, LEAST(100, p_score + CASE WHEN p_active_until IS NULL THEN 0
    ELSE GREATEST(0, EXTRACT(EPOCH FROM (LEAST(p_now, p_active_until) - p_at)) / 60) END)
    - GREATEST(0, EXTRACT(EPOCH FROM (p_now - GREATEST(p_at, COALESCE(p_active_until, p_at)))) / 60));
$$;

CREATE FUNCTION public.fishing_set_presence(p_user UUID, p_area UUID, p_now TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fishing-fatigue:' || p_user::TEXT, 0));
  -- Never move a row's clock backwards after waiting for a concurrent request.
  SELECT GREATEST(p_now, COALESCE(max(calculated_at), p_now)) INTO p_now
  FROM public.user_area_fatigue WHERE user_id = p_user;
  UPDATE public.user_area_fatigue SET
    fatigue_score = public.fishing_fatigue_value(fatigue_score, calculated_at, active_until, p_now),
    calculated_at = p_now, active_until = NULL
  WHERE user_id = p_user AND active_until IS NOT NULL;
  IF p_area IS NOT NULL THEN
    INSERT INTO public.user_area_fatigue(user_id, area_id, calculated_at, active_until)
    VALUES (p_user, p_area, p_now, p_now + INTERVAL '90 seconds')
    ON CONFLICT (user_id, area_id) DO UPDATE SET
      fatigue_score = public.fishing_fatigue_value(user_area_fatigue.fatigue_score,
        user_area_fatigue.calculated_at, user_area_fatigue.active_until, p_now),
      calculated_at = p_now, active_until = p_now + INTERVAL '90 seconds';
  END IF;
END;
$$;

CREATE FUNCTION public.fishing_presence_changed() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_now TIMESTAMPTZ := clock_timestamp();
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.fishing_set_presence(OLD.user_id, NULL, v_now);
    RETURN OLD;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF (OLD.user_id, OLD.area_id, OLD.status) IS NOT DISTINCT FROM (NEW.user_id, NEW.area_id, NEW.status) THEN
      RETURN NEW;
    END IF;
    IF OLD.user_id IS DISTINCT FROM NEW.user_id THEN
      PERFORM public.fishing_set_presence(OLD.user_id, NULL, v_now);
    END IF;
  END IF;
  PERFORM public.fishing_set_presence(NEW.user_id, CASE WHEN NEW.status = 'enter' THEN NEW.area_id END, v_now);
  RETURN NEW;
END;
$$;
CREATE TRIGGER fishing_presence_changed AFTER INSERT OR UPDATE OR DELETE ON public.user_in_area
FOR EACH ROW EXECUTE FUNCTION public.fishing_presence_changed();

CREATE FUNCTION public.touch_fishing_presence() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_area UUID; v_score NUMERIC; v_effects JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  -- Lock membership before the per-player fatigue lock, just like enter/leave.
  -- A heartbeat can never reactivate a previous area after a concurrent leave.
  SELECT area_id INTO v_area FROM public.user_in_area WHERE user_id = v_user AND status = 'enter' FOR SHARE;
  IF v_area IS NULL THEN RAISE EXCEPTION 'Player is not in a fishing area'; END IF;
  PERFORM public.fishing_set_presence(v_user, v_area, clock_timestamp());
  SELECT fatigue_score INTO v_score FROM public.user_area_fatigue WHERE user_id = v_user AND area_id = v_area;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', m.code, 'name', m.name, 'target', e.target,
    'value', e.value) ORDER BY e.min_fatigue, e.id), '[]') INTO v_effects
  FROM public.fatigue_effects e JOIN public.modifiers m ON m.id = e.modifier_id
  WHERE e.enabled AND m.unit = 'PERCENT' AND v_score >= e.min_fatigue AND v_score < e.max_fatigue;
  RETURN jsonb_build_object('area_id', v_area, 'fatigue_score', v_score, 'effects', v_effects);
END;
$$;

CREATE FUNCTION public.fishing_fatigue_multiplier(p_effects JSONB, p_target TEXT) RETURNS NUMERIC
LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  -- Percent debuffs compose multiplicatively; a -100% effect yields zero.
  SELECT CASE WHEN COALESCE(bool_or((e->>'value')::NUMERIC = -100), FALSE) THEN 0
    ELSE COALESCE(EXP(SUM(LN(NULLIF(1 + (e->>'value')::NUMERIC / 100, 0)))), 1) END
  FROM jsonb_array_elements(p_effects) e WHERE e->>'target' = p_target;
$$;

CREATE TABLE public.fishing_seasons (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  starts_at TIMESTAMPTZ NOT NULL UNIQUE,
  ends_at TIMESTAMPTZ NOT NULL UNIQUE,
  finalized_at TIMESTAMPTZ,
  CHECK (ends_at = starts_at + INTERVAL '336 hours')
);
-- No FK to caught/species/users: selling/releasing fish, deleting accounts or
-- editing catalog entries must never erase or rewrite historical achievements.
CREATE TABLE public.fishing_score_catches (
  id UUID PRIMARY KEY,
  session_id UUID NOT NULL UNIQUE,
  season_id BIGINT NOT NULL REFERENCES public.fishing_seasons(id),
  user_id UUID NOT NULL,
  species_id UUID NOT NULL,
  caught_at TIMESTAMPTZ NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0 AND score < 'Infinity'::NUMERIC),
  fish JSONB NOT NULL,
  display_name TEXT,
  factors JSONB NOT NULL
);
CREATE INDEX fishing_score_player_best ON public.fishing_score_catches(season_id, user_id, score DESC, caught_at DESC, id DESC);
CREATE INDEX fishing_score_species_best ON public.fishing_score_catches(season_id, species_id, score DESC, caught_at DESC, id DESC);
CREATE TABLE public.fishing_hall_of_fame (
  season_id BIGINT NOT NULL REFERENCES public.fishing_seasons(id),
  rank INTEGER NOT NULL CHECK (rank BETWEEN 1 AND 3),
  catch_id UUID NOT NULL REFERENCES public.fishing_score_catches(id),
  user_id UUID NOT NULL,
  species_id UUID NOT NULL,
  fish JSONB NOT NULL,
  display_name TEXT,
  caught_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (season_id, rank), UNIQUE (season_id, species_id)
);
CREATE TABLE public.fishing_season_meta (
  season_id BIGINT NOT NULL REFERENCES public.fishing_seasons(id),
  species_id UUID NOT NULL,
  name TEXT NOT NULL,
  image TEXT,
  season_weight NUMERIC NOT NULL CHECK (season_weight IN (0.7, 1.3)),
  PRIMARY KEY (season_id, species_id)
);

-- Caller must hold the common season lock. Catch time is captured AFTER that
-- lock, so an older in-flight transaction cannot insert into an archived season.
CREATE FUNCTION public.fishing_ensure_season(p_now TIMESTAMPTZ) RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_season public.fishing_seasons%ROWTYPE; v_next BIGINT;
BEGIN
  SELECT * INTO v_season FROM public.fishing_seasons ORDER BY starts_at DESC LIMIT 1;
  IF NOT FOUND OR p_now < v_season.starts_at THEN RETURN NULL; END IF;
  WHILE p_now >= v_season.ends_at LOOP
    INSERT INTO public.fishing_hall_of_fame(season_id, rank, catch_id, user_id, species_id, fish, display_name, caught_at)
    SELECT v_season.id, row_number() OVER (ORDER BY score DESC, caught_at DESC, id DESC),
      id, user_id, species_id, fish, display_name, caught_at
    FROM (
      SELECT DISTINCT ON (species_id) * FROM public.fishing_score_catches
      WHERE season_id = v_season.id ORDER BY species_id, score DESC, caught_at DESC, id DESC
    ) best ORDER BY best.score DESC, best.caught_at DESC, best.id DESC LIMIT 3;
    UPDATE public.fishing_seasons SET finalized_at = p_now WHERE id = v_season.id;
    INSERT INTO public.fishing_seasons(starts_at, ends_at)
      VALUES(v_season.ends_at, v_season.ends_at + INTERVAL '336 hours') RETURNING id INTO v_next;
    INSERT INTO public.fishing_season_meta(season_id, species_id, name, image, season_weight)
    SELECT v_next, h.species_id, h.fish->>'name', h.fish->>'image', 0.7
    FROM public.fishing_hall_of_fame h WHERE h.season_id = v_season.id;
    INSERT INTO public.fishing_season_meta(season_id, species_id, name, image, season_weight)
    SELECT v_next, s.id, s.name, s.image, 1.3 FROM public.species s
    WHERE NOT EXISTS (SELECT 1 FROM public.fishing_hall_of_fame h WHERE h.season_id = v_season.id AND h.species_id = s.id)
      AND EXISTS (SELECT 1 FROM public.species_in_area sa JOIN public.fishing_areas a ON a.id = sa.area_id
        WHERE sa.species_id = s.id AND sa.weight_rate > 0 AND a.is_available)
    ORDER BY random() LIMIT 3;
    UPDATE public.species s SET season_weight = COALESCE(
      (SELECT m.season_weight FROM public.fishing_season_meta m WHERE m.season_id = v_next AND m.species_id = s.id), 1);
    SELECT * INTO v_season FROM public.fishing_seasons WHERE id = v_next;
  END LOOP;
  RETURN v_season.id;
END;
$$;

CREATE FUNCTION public.start_fishing_seasons(p_starts_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(73115, 1);
  IF p_starts_at IS NULL OR NOT isfinite(p_starts_at) THEN RAISE EXCEPTION 'Invalid season start'; END IF;
  IF EXISTS (SELECT 1 FROM public.fishing_seasons) THEN RAISE EXCEPTION 'Fishing seasons already initialized'; END IF;
  INSERT INTO public.fishing_seasons(starts_at, ends_at) VALUES(p_starts_at, p_starts_at + INTERVAL '336 hours');
  UPDATE public.species SET season_weight = 1;
END;
$$;

-- Internal only. Called once by the validated resolver, after all rewards have
-- succeeded. Pre-migration casts intentionally receive no retroactive score.
CREATE FUNCTION public.record_fishing_score(p_session UUID, p_caught UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.fishing_sessions%ROWTYPE; v_snapshot JSONB; v_now TIMESTAMPTZ; v_season BIGINT;
  v_season_weight NUMERIC; v_score NUMERIC; v_fish JSONB; v_name TEXT; v_factors JSONB;
BEGIN
  SELECT * INTO v_session FROM public.fishing_sessions WHERE id = p_session AND user_id = auth.uid() AND status = 'SUCCESS';
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid scoring session'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.caught WHERE id = p_caught AND user_id = v_session.user_id
    AND species_id = v_session.species_id AND area_id = v_session.area_id AND weight = v_session.secret_weight) THEN
    RAISE EXCEPTION 'Catch does not match session';
  END IF;
  SELECT fish_snapshot->'scoring' INTO v_snapshot FROM public.fishing_session_mechanics WHERE session_id = p_session;
  IF v_snapshot IS NULL THEN RETURN NULL; END IF;
  -- Serialize only the short score / rollover section, not the whole minigame.
  PERFORM pg_advisory_xact_lock(73115, 1);
  v_now := clock_timestamp();
  v_season := public.fishing_ensure_season(v_now);
  IF v_season IS NULL THEN RETURN NULL; END IF;
  SELECT season_weight INTO STRICT v_season_weight FROM public.species WHERE id = v_session.species_id;
  v_score := POWER((v_snapshot->>'w_norm')::NUMERIC, 1.5)
    * POWER((v_snapshot->>'rare_weight')::NUMERIC, 2)
    * (v_snapshot->>'extreme_weight')::NUMERIC * v_season_weight
    * (v_snapshot->>'fatigue_multiplier')::NUMERIC;
  v_factors := v_snapshot || jsonb_build_object('season_weight', v_season_weight);
  v_fish := (v_snapshot->'fish') || jsonb_build_object('id', p_caught, 'score', v_score, 'caught_at', v_now);
  SELECT display_name INTO v_name FROM public.user_profile WHERE id = v_session.user_id;
  INSERT INTO public.fishing_score_catches(id, session_id, season_id, user_id, species_id, caught_at, score, fish, display_name, factors)
    VALUES(p_caught, p_session, v_season, v_session.user_id, v_session.species_id, v_now, v_score, v_fish, v_name, v_factors)
    ON CONFLICT (session_id) DO NOTHING;
  RETURN jsonb_build_object('score', v_score, 'season_id', v_season, 'caught_at', v_now, 'factors', v_factors);
END;
$$;

-- One consistent response for page, personal rank, season metadata and archive.
CREATE FUNCTION public.get_fishing_season_board(p_page INTEGER DEFAULT 1, p_season_id BIGINT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_now TIMESTAMPTZ; v_current BIGINT; v_selected BIGINT; v_result JSONB;
BEGIN
  IF p_page IS NULL OR p_page < 1 OR p_page > 1000000 THEN RAISE EXCEPTION 'Invalid leaderboard page'; END IF;
  PERFORM pg_advisory_xact_lock(73115, 1);
  v_now := clock_timestamp();
  v_current := public.fishing_ensure_season(v_now);
  v_selected := COALESCE(p_season_id, v_current);
  IF p_season_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fishing_seasons WHERE id = p_season_id AND starts_at <= v_now) THEN
    RAISE EXCEPTION 'Season not available';
  END IF;
  WITH best AS (
    SELECT DISTINCT ON (user_id) * FROM public.fishing_score_catches
    WHERE season_id = v_selected ORDER BY user_id, score DESC, caught_at DESC, id DESC
  ), ranked AS (
    SELECT user_id AS id, display_name, score, fish AS best_fish, caught_at AS updated_at, caught_at AS created_at,
      row_number() OVER (ORDER BY score DESC, caught_at DESC, id DESC) AS rank FROM best
  ) SELECT jsonb_build_object(
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY rank) FROM
      (SELECT * FROM ranked ORDER BY rank LIMIT 10 OFFSET (p_page - 1) * 10) r), '[]'),
    'total', (SELECT count(*) FROM ranked),
    'my_entry', (SELECT to_jsonb(r) FROM ranked r WHERE id = auth.uid()),
    'season', (SELECT to_jsonb(s) FROM public.fishing_seasons s WHERE id = v_selected),
    'current_season_id', v_current,
    'previous_season_id', (SELECT id FROM public.fishing_seasons WHERE starts_at < (SELECT starts_at FROM public.fishing_seasons WHERE id = v_selected) ORDER BY starts_at DESC LIMIT 1),
    'next_season_id', (SELECT id FROM public.fishing_seasons WHERE starts_at > (SELECT starts_at FROM public.fishing_seasons WHERE id = v_selected) AND starts_at <= v_now ORDER BY starts_at LIMIT 1),
    'hall_of_fame', COALESCE((SELECT jsonb_agg(to_jsonb(h) ORDER BY rank) FROM public.fishing_hall_of_fame h WHERE season_id = v_selected), '[]'),
    'meta', COALESCE((SELECT jsonb_agg(to_jsonb(m) ORDER BY season_weight, species_id) FROM public.fishing_season_meta m WHERE season_id = v_selected), '[]'),
    'server_time', v_now
  ) INTO v_result;
  RETURN v_result;
END;
$$;

-- Only trusted server code may mutate fatigue, scores, history or meta.
DO $$ DECLARE t TEXT; BEGIN
  FOREACH t IN ARRAY ARRAY['user_area_fatigue','fatigue_effects','fishing_seasons','fishing_score_catches','fishing_hall_of_fame','fishing_season_meta'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC, anon, authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
REVOKE ALL ON FUNCTION public.fishing_fatigue_value(NUMERIC,TIMESTAMPTZ,TIMESTAMPTZ,TIMESTAMPTZ),
  public.fishing_set_presence(UUID,UUID,TIMESTAMPTZ), public.fishing_presence_changed(),
  public.fishing_fatigue_multiplier(JSONB,TEXT), public.fishing_ensure_season(TIMESTAMPTZ),
  public.start_fishing_seasons(TIMESTAMPTZ), public.record_fishing_score(UUID,UUID),
  public.touch_fishing_presence(), public.get_fishing_season_board(INTEGER,BIGINT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.touch_fishing_presence() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_fishing_season_board(INTEGER,BIGINT) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_fishing_seasons(TIMESTAMPTZ) TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.fishing_seasons_id_seq TO service_role;

-- Keep server pre-request feature rules synchronized with the client catalog.
INSERT INTO feature_control.request_rules(feature_key, path, writes_only)
VALUES ('leaderboard', 'rpc/get_fishing_season_board', FALSE)
ON CONFLICT (feature_key, path) DO NOTHING;
NOTIFY pgrst, 'reload schema';
COMMIT;
