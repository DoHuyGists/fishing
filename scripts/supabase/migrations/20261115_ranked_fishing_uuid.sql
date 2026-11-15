-- Run after 20261115_ranked_fishing.sql, including on existing deployments.
-- Preserve historical relationships; season_number is display data, not identity.
BEGIN;
LOCK TABLE public.fishing_seasons, public.fishing_score_catches,
  public.fishing_hall_of_fame, public.fishing_season_meta IN ACCESS EXCLUSIVE MODE;
DO $upgrade$
DECLARE v_table TEXT;
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'fishing_seasons' AND column_name = 'id') = 'bigint' THEN
    ALTER TABLE public.fishing_seasons ADD COLUMN season_number BIGINT;
    UPDATE public.fishing_seasons SET season_number = id;
    ALTER TABLE public.fishing_seasons ALTER COLUMN season_number SET NOT NULL;
    ALTER TABLE public.fishing_seasons ADD CONSTRAINT fishing_seasons_number_key UNIQUE (season_number);
    ALTER TABLE public.fishing_seasons ADD CONSTRAINT fishing_seasons_number_positive CHECK (season_number > 0);
    ALTER TABLE public.fishing_seasons ADD COLUMN new_id UUID NOT NULL DEFAULT gen_random_uuid();
    FOREACH v_table IN ARRAY ARRAY['fishing_score_catches','fishing_hall_of_fame','fishing_season_meta'] LOOP
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN season_uuid UUID', v_table);
      EXECUTE format('UPDATE public.%I c SET season_uuid = s.new_id FROM public.fishing_seasons s WHERE c.season_id = s.id', v_table);
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', v_table, v_table || '_season_id_fkey');
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN season_id TYPE UUID USING season_uuid', v_table);
      EXECUTE format('ALTER TABLE public.%I DROP COLUMN season_uuid', v_table);
    END LOOP;
    ALTER TABLE public.fishing_seasons ALTER COLUMN id DROP IDENTITY;
    ALTER TABLE public.fishing_seasons ALTER COLUMN id TYPE UUID USING new_id;
    ALTER TABLE public.fishing_seasons ALTER COLUMN id SET DEFAULT gen_random_uuid();
    ALTER TABLE public.fishing_seasons DROP COLUMN new_id;
    FOREACH v_table IN ARRAY ARRAY['fishing_score_catches','fishing_hall_of_fame','fishing_season_meta'] LOOP
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (season_id) REFERENCES public.fishing_seasons(id)', v_table, v_table || '_season_id_fkey');
    END LOOP;
  END IF;
END;
$upgrade$;

DROP FUNCTION IF EXISTS public.get_fishing_season_board(INTEGER,BIGINT);
DROP FUNCTION public.fishing_ensure_season(TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION public.fishing_ensure_season(p_now TIMESTAMPTZ) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_season public.fishing_seasons%ROWTYPE; v_next UUID;
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
    INSERT INTO public.fishing_seasons(season_number, starts_at, ends_at)
      VALUES(v_season.season_number + 1, v_season.ends_at, v_season.ends_at + INTERVAL '336 hours') RETURNING id INTO v_next;
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

CREATE OR REPLACE FUNCTION public.start_fishing_seasons(p_starts_at TIMESTAMPTZ) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(73115, 1);
  IF p_starts_at IS NULL OR NOT isfinite(p_starts_at) THEN RAISE EXCEPTION 'Invalid season start'; END IF;
  IF EXISTS (SELECT 1 FROM public.fishing_seasons) THEN RAISE EXCEPTION 'Fishing seasons already initialized'; END IF;
  INSERT INTO public.fishing_seasons(season_number, starts_at, ends_at) VALUES(1, p_starts_at, p_starts_at + INTERVAL '336 hours');
  UPDATE public.species SET season_weight = 1;
END;
$$;

-- Internal only. Called once by the validated resolver, after all rewards have
-- succeeded. Pre-migration casts intentionally receive no retroactive score.
CREATE OR REPLACE FUNCTION public.record_fishing_score(p_session UUID, p_caught UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_session public.fishing_sessions%ROWTYPE; v_snapshot JSONB; v_now TIMESTAMPTZ; v_season UUID;
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
  RETURN jsonb_build_object('score', v_score, 'season_id', v_season, 'season_number', (SELECT season_number FROM public.fishing_seasons WHERE id = v_season), 'caught_at', v_now, 'factors', v_factors);
END;
$$;

-- One consistent response for page, personal rank, season metadata and archive.
CREATE OR REPLACE FUNCTION public.get_fishing_season_board(p_page INTEGER DEFAULT 1, p_season_id UUID DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_now TIMESTAMPTZ; v_current UUID; v_selected UUID; v_result JSONB;
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


REVOKE ALL ON FUNCTION public.fishing_ensure_season(TIMESTAMPTZ),
  public.start_fishing_seasons(TIMESTAMPTZ), public.record_fishing_score(UUID,UUID),
  public.get_fishing_season_board(INTEGER,UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_fishing_season_board(INTEGER,UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.start_fishing_seasons(TIMESTAMPTZ) TO service_role;
NOTIFY pgrst, 'reload schema';
COMMIT;

