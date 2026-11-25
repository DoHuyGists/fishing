-- Run in Supabase SQL Editor before deploying the frontend.
BEGIN;

CREATE OR REPLACE FUNCTION public.reset_skill(p_skill_id uuid, p_expected_level integer)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_level integer;
  v_points integer;
  v_cash numeric;
  v_cost numeric;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;
  IF NOT coalesce(public.feature_is_enabled('skill'), false) THEN
    RAISE EXCEPTION 'Feature disabled' USING ERRCODE = '42501', DETAIL = 'FEATURE_DISABLED:skill';
  END IF;

  SELECT skill_points INTO v_points FROM public.user_profile WHERE id = v_user FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Skill profile not found'; END IF;
  SELECT level INTO v_level FROM public.user_skills
    WHERE user_id = v_user AND skill_id = p_skill_id FOR UPDATE;
  IF NOT FOUND OR v_level IS NULL OR v_level <= 0 THEN
    RAISE EXCEPTION 'Skill has no invested points';
  END IF;
  IF p_expected_level IS DISTINCT FROM v_level THEN
    RAISE EXCEPTION 'Skill level changed; reload before resetting';
  END IF;

  v_cost := v_level::numeric * 10000;
  UPDATE public.currency SET cash = cash - v_cost
    WHERE user_id = v_user AND cash >= v_cost RETURNING cash INTO v_cash;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient cash'; END IF;

  DELETE FROM public.user_skills WHERE user_id = v_user AND skill_id = p_skill_id;
  UPDATE public.user_profile SET skill_points = coalesce(skill_points, 0) + v_level
    WHERE id = v_user RETURNING skill_points INTO v_points;
  RETURN jsonb_build_object('success', true, 'skill_id', p_skill_id,
    'refunded_points', v_level, 'remaining_skill_points', v_points, 'remaining_cash', v_cash);
END;
$$;

REVOKE ALL ON FUNCTION public.reset_skill(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_skill(uuid, integer) TO authenticated;

INSERT INTO feature_control.request_rules(feature_key, path, writes_only)
VALUES ('skill', 'rpc/reset_skill', false) ON CONFLICT DO NOTHING;

NOTIFY pgrst, 'reload schema';
COMMIT;
