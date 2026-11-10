-- Run before rpc/spining-wheel/spin-wheel.sql and deploying the frontend.
BEGIN;

CREATE TABLE public.spin_wheel_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at > starts_at),
  -- Adjacent seasons are allowed; enabled schedules must never overlap.
  EXCLUDE USING gist (tstzrange(starts_at, ends_at, '[)') WITH &&) WHERE (is_active)
);

CREATE TABLE public.spin_wheel_rewards (
  season_id uuid NOT NULL REFERENCES public.spin_wheel_seasons(id) ON DELETE CASCADE,
  item_id uuid NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
  sort_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (season_id, item_id)
);

ALTER TABLE public.spin_wheel_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.spin_wheel_rewards ENABLE ROW LEVEL SECURITY;
-- Manage seasons/rewards via SQL Editor or a trusted service_role backend.
REVOKE ALL ON public.spin_wheel_seasons, public.spin_wheel_rewards FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.spin_wheel_seasons, public.spin_wheel_rewards TO service_role;

CREATE OR REPLACE FUNCTION public.get_spin_wheel_rewards() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_season public.spin_wheel_seasons%ROWTYPE;
  v_rewards jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Bạn cần đăng nhập.';
  END IF;

  SELECT * INTO v_season FROM public.spin_wheel_seasons
  WHERE is_active AND starts_at <= now() AND ends_at > now();

  IF NOT FOUND THEN
    RETURN jsonb_build_object('season', NULL, 'rewards', '[]'::jsonb);
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object(
    'id', i.id, 'name', i.name, 'category', i.category,
    'image', i.image, 'information', i.information
  ) ORDER BY r.sort_order, i.id), '[]'::jsonb)
  INTO v_rewards
  FROM public.spin_wheel_rewards r
  JOIN public.items i ON i.id = r.item_id
  WHERE r.season_id = v_season.id AND i."isDisabled" = false;

  RETURN jsonb_build_object(
    'season', jsonb_build_object('id', v_season.id, 'name', v_season.name,
      'starts_at', v_season.starts_at, 'ends_at', v_season.ends_at),
    'rewards', v_rewards
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_spin_wheel_rewards() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_spin_wheel_rewards() TO authenticated;

COMMIT;
