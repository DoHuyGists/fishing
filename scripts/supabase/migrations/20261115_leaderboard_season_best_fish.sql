-- Run after the UUID and permissions upgrades. Redeploy the updated
-- rpc/fishing/submit_challenge.sql FIRST to use the common season lock before
-- taking leaderboard row locks. Safe to rerun; no legacy catch history is deleted.
BEGIN;
SELECT pg_advisory_xact_lock(73115, 1);
LOCK TABLE public.leaderboard, public.fishing_seasons, public.fishing_score_catches,
  public.fishing_hall_of_fame, public.fishing_season_meta IN ACCESS EXCLUSIVE MODE;

-- Live season: leaderboard.best_fish is the only mutable ranking record.
-- Finished seasons: one immutable personal best per player and season.
CREATE TABLE IF NOT EXISTS public.fishing_season_results (
  season_id UUID NOT NULL REFERENCES public.fishing_seasons(id),
  user_id UUID NOT NULL,
  best_fish JSONB NOT NULL,
  display_name TEXT,
  PRIMARY KEY (season_id, user_id)
);
ALTER TABLE public.fishing_season_results ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fishing_season_results FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fishing_season_results TO service_role;
-- Best fish and lifetime totals are server-owned achievements.
REVOKE INSERT, UPDATE, DELETE ON public.leaderboard FROM PUBLIC, anon, authenticated;

-- New winners no longer have rows in the legacy per-catch log.
-- The Hall of Fame already contains a complete, independent fish snapshot.
ALTER TABLE public.fishing_hall_of_fame
  DROP CONSTRAINT IF EXISTS fishing_hall_of_fame_catch_id_fkey;

-- Preserve all completed seasonal boards, without copying every catch.
INSERT INTO public.fishing_season_results(season_id, user_id, best_fish, display_name)
SELECT season_id, user_id,
  fish || jsonb_build_object('id', id, 'species_id', species_id, 'score', score, 'caught_at', caught_at,
    'season_id', season_id, 'session_id', session_id, 'display_name', display_name),
  display_name
FROM (
  SELECT DISTINCT ON (c.season_id, c.user_id) c.*
  FROM public.fishing_score_catches c JOIN public.fishing_seasons s ON s.id = c.season_id
  WHERE s.finalized_at IS NOT NULL
  ORDER BY c.season_id, c.user_id, c.score DESC, c.caught_at DESC, c.id DESC
) best
ON CONFLICT (season_id, user_id) DO NOTHING;

-- Migrate each player's best existing catch in the latest unfinished season.
-- On reruns, a newer/better live record always wins over the legacy log.
INSERT INTO public.leaderboard AS board(id, score, total_caught, best_fish, created_at, updated_at)
SELECT c.user_id, 0, 0,
  c.fish || jsonb_build_object('id', c.id, 'species_id', c.species_id, 'score', c.score, 'caught_at', c.caught_at,
    'season_id', c.season_id, 'session_id', c.session_id, 'display_name', c.display_name),
  c.caught_at, c.caught_at
FROM (
  SELECT DISTINCT ON (c.user_id) c.*
  FROM public.fishing_score_catches c
  JOIN public.fishing_seasons s ON s.id = c.season_id
  JOIN public.user_profile p ON p.id = c.user_id
  WHERE s.finalized_at IS NULL AND s.id = (SELECT id FROM public.fishing_seasons ORDER BY starts_at DESC LIMIT 1)
  ORDER BY c.user_id, c.score DESC, c.caught_at DESC, c.id DESC
) c
ON CONFLICT (id) DO UPDATE SET best_fish = EXCLUDED.best_fish
WHERE board.best_fish->>'season_id' IS DISTINCT FROM EXCLUDED.best_fish->>'season_id'
  OR ((EXCLUDED.best_fish->>'score')::NUMERIC, (EXCLUDED.best_fish->>'caught_at')::TIMESTAMPTZ, (EXCLUDED.best_fish->>'id')::UUID) >
     ((board.best_fish->>'score')::NUMERIC, (board.best_fish->>'caught_at')::TIMESTAMPTZ, (board.best_fish->>'id')::UUID);

CREATE OR REPLACE FUNCTION public.fishing_ensure_season(p_now TIMESTAMPTZ) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_season public.fishing_seasons%ROWTYPE; v_next UUID;
BEGIN
  SELECT * INTO v_season FROM public.fishing_seasons ORDER BY starts_at DESC LIMIT 1;
  IF NOT FOUND OR p_now < v_season.starts_at THEN RETURN NULL; END IF;
  WHILE p_now >= v_season.ends_at LOOP
    IF v_season.finalized_at IS NULL THEN
    -- Archive exactly one personal best per player before clearing the live board.
    INSERT INTO public.fishing_season_results(season_id, user_id, best_fish, display_name)
    SELECT v_season.id, id, best_fish, best_fish->>'display_name'
    FROM public.leaderboard WHERE best_fish->>'season_id' = v_season.id::TEXT
    ON CONFLICT (season_id, user_id) DO NOTHING;

    INSERT INTO public.fishing_hall_of_fame(season_id, rank, catch_id, user_id, species_id, fish, display_name, caught_at)
    SELECT v_season.id, row_number() OVER (ORDER BY score DESC, caught_at DESC, id DESC),
      id, user_id, species_id, best_fish, display_name, caught_at
    FROM (
      SELECT DISTINCT ON ((best_fish->>'species_id')::UUID)
        (best_fish->>'id')::UUID AS id, user_id, (best_fish->>'species_id')::UUID AS species_id,
        (best_fish->>'score')::NUMERIC AS score, (best_fish->>'caught_at')::TIMESTAMPTZ AS caught_at,
        best_fish, display_name
      FROM public.fishing_season_results WHERE season_id = v_season.id
      ORDER BY (best_fish->>'species_id')::UUID, (best_fish->>'score')::NUMERIC DESC,
        (best_fish->>'caught_at')::TIMESTAMPTZ DESC, (best_fish->>'id')::UUID DESC
    ) best ORDER BY best.score DESC, best.caught_at DESC, best.id DESC LIMIT 3;

    UPDATE public.leaderboard SET best_fish = NULL
    WHERE best_fish->>'season_id' = v_season.id::TEXT;
    UPDATE public.fishing_seasons SET finalized_at = p_now WHERE id = v_season.id;
    END IF;
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
  v_fish := v_fish || jsonb_build_object('season_id', v_season, 'session_id', p_session, 'display_name', v_name);
  INSERT INTO public.leaderboard AS board(id, score, total_caught, best_fish, created_at, updated_at)
  VALUES(v_session.user_id, 0, 0, v_fish, v_now, v_now)
  ON CONFLICT (id) DO UPDATE SET best_fish = EXCLUDED.best_fish
  WHERE board.best_fish->>'season_id' IS DISTINCT FROM v_season::TEXT
    OR (v_score, v_now, p_caught) >
       ((board.best_fish->>'score')::NUMERIC, (board.best_fish->>'caught_at')::TIMESTAMPTZ, (board.best_fish->>'id')::UUID);
  RETURN jsonb_build_object('score', v_score, 'season_id', v_season, 'season_number', (SELECT season_number FROM public.fishing_seasons WHERE id = v_season), 'caught_at', v_now, 'factors', v_factors);
END;
$$;

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
    SELECT l.id AS user_id, COALESCE(p.display_name, l.best_fish->>'display_name') AS display_name, l.best_fish
    FROM public.leaderboard l LEFT JOIN public.user_profile p ON p.id = l.id
    WHERE l.best_fish->>'season_id' = v_selected::TEXT AND v_selected = v_current
    UNION ALL
    SELECT r.user_id, r.display_name, r.best_fish
    FROM public.fishing_season_results r JOIN public.fishing_seasons s ON s.id = r.season_id
    WHERE r.season_id = v_selected AND s.finalized_at IS NOT NULL
  ), ranked AS (
    SELECT user_id AS id, display_name, (best_fish->>'score')::NUMERIC AS score, best_fish,
      (best_fish->>'caught_at')::TIMESTAMPTZ AS updated_at,
      (best_fish->>'caught_at')::TIMESTAMPTZ AS created_at,
      row_number() OVER (ORDER BY (best_fish->>'score')::NUMERIC DESC,
        (best_fish->>'caught_at')::TIMESTAMPTZ DESC, (best_fish->>'id')::UUID DESC) AS rank FROM best
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
  public.record_fishing_score(UUID,UUID), public.get_fishing_season_board(INTEGER,UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_fishing_season_board(INTEGER,UUID) TO anon, authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
