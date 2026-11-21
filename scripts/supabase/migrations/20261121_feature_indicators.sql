-- Apply in Supabase SQL Editor before deploying the client.
-- Dependencies: feature flags, daily missions, badges, dispatch and friend tables.
-- Reuse authoritative reward rules; never load modal lists just to render a dot.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_my_feature_indicators(
  p_features text[] DEFAULT ARRAY['attendance', 'mission', 'badge', 'dispatch', 'friend']::text[]
) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  u uuid := auth.uid();
  checked_at timestamptz := clock_timestamp();
  next_at timestamptz;
  rewards bigint;
  pending bigint;
  result jsonb := '{}'::jsonb;
  mission_data jsonb;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;

  IF 'attendance' = ANY(p_features) AND public.feature_is_enabled('attendance') THEN
    SELECT next_claim_daily_reward_at INTO next_at FROM public.user_flag WHERE user_id = u;
    result := result || jsonb_build_object('attendance', jsonb_build_object(
      'rewardCount', CASE WHEN next_at IS NULL OR next_at <= checked_at THEN 1 ELSE 0 END,
      'attentionCount', 0, 'nextChangeAt', CASE WHEN next_at > checked_at THEN next_at END));
  END IF;

  IF 'mission' = ANY(p_features) AND public.feature_is_enabled('mission') THEN
    mission_data := public.get_daily_missions();
    SELECT count(*) INTO rewards FROM jsonb_array_elements(coalesce(mission_data->'rewards', '[]'::jsonb)) r
      WHERE (r->>'can_claim')::boolean IS TRUE;
    result := result || jsonb_build_object('mission', jsonb_build_object(
      'rewardCount', rewards, 'attentionCount', 0, 'nextChangeAt', NULL));
  END IF;

  IF 'badge' = ANY(p_features) AND public.feature_is_enabled('badge') THEN
    SELECT count(*) INTO rewards FROM jsonb_array_elements(public.get_user_badges_status()) b
      WHERE (b->>'can_claim')::boolean IS TRUE;
    result := result || jsonb_build_object('badge', jsonb_build_object(
      'rewardCount', rewards, 'attentionCount', 0, 'nextChangeAt', NULL));
  END IF;

  IF 'dispatch' = ANY(p_features) AND public.feature_is_enabled('dispatch') THEN
    SELECT count(*) FILTER (WHERE ends_at <= checked_at), min(ends_at) FILTER (WHERE ends_at > checked_at)
      INTO rewards, next_at FROM public.dispatch_runs WHERE user_id = u AND status = 'running';
    result := result || jsonb_build_object('dispatch', jsonb_build_object(
      'rewardCount', rewards, 'attentionCount', 0, 'nextChangeAt', next_at));
  END IF;

  IF 'friend' = ANY(p_features) AND public.feature_is_enabled('friend') THEN
    SELECT count(*) INTO pending FROM public.user_friends WHERE friend_id = u AND status = 'PENDING';
    result := result || jsonb_build_object('friend', jsonb_build_object(
      'rewardCount', 0, 'attentionCount', pending, 'nextChangeAt', NULL));
  END IF;

  RETURN jsonb_build_object('serverTime', checked_at, 'indicators', result);
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_feature_indicators(text[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_feature_indicators(text[]) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
