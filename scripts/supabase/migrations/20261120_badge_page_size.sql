-- Run in Supabase SQL Editor before deploying the client.
-- Reuse the existing per-user badge rules; only one page crosses the network.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_user_badges_page(
  p_page integer DEFAULT 1,
  p_search text DEFAULT '',
  p_type text DEFAULT 'all',
  p_status text DEFAULT 'all'
) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  result jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF p_status IS NULL OR p_status NOT IN ('all', 'earned', 'unearned', 'claimable') THEN
    RAISE EXCEPTION 'Invalid badge status';
  END IF;

  WITH badges AS MATERIALIZED (
    -- The status RPC returns a JSONB array, not a set of table rows.
    SELECT b.*, nullif(btrim(b.type), '') AS normalized_type
    FROM jsonb_to_recordset(public.get_user_badges_status()) AS b(
      badge_id uuid,
      name text,
      description text,
      icon_url text,
      type text,
      reward jsonb,
      is_earned boolean,
      quantity integer,
      earned_at timestamptz,
      is_claim boolean,
      can_claim boolean
    )
  ), filtered AS MATERIALIZED (
    SELECT * FROM badges b
    WHERE (coalesce(btrim(p_search), '') = '' OR EXISTS (
      SELECT 1 FROM unnest(ARRAY[b.name, b.description, b.type]) value
      WHERE strpos(lower(value), lower(btrim(p_search))) > 0
    ))
    AND (p_type = 'all' OR b.normalized_type = p_type)
    AND (p_status = 'all'
      OR (p_status = 'earned' AND b.is_earned)
      OR (p_status = 'unearned' AND NOT b.is_earned)
      OR (p_status = 'claimable' AND b.can_claim))
  ), page AS (
    SELECT * FROM filtered
    ORDER BY is_earned DESC, name, badge_id
    LIMIT 30 OFFSET (greatest(coalesce(p_page, 1), 1)::bigint - 1) * 30
  )
  SELECT jsonb_build_object(
    'items', coalesce((SELECT jsonb_agg(to_jsonb(p) - 'normalized_type'
      ORDER BY p.is_earned DESC, p.name, p.badge_id) FROM page p), '[]'::jsonb),
    'total', (SELECT count(*) FROM filtered),
    'collectionTotal', (SELECT count(*) FROM badges),
    'earnedTotal', (SELECT count(*) FROM badges WHERE is_earned),
    'types', coalesce((SELECT jsonb_agg(t.normalized_type ORDER BY t.normalized_type)
      FROM (SELECT DISTINCT normalized_type FROM badges WHERE normalized_type IS NOT NULL) t), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_badges_page(integer, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_badges_page(integer, text, text, text) TO authenticated;

-- Keep the endpoint covered by the existing server feature gate when installed.
DO $$
BEGIN
  IF to_regclass('feature_control.request_rules') IS NOT NULL THEN
    INSERT INTO feature_control.request_rules(feature_key, path)
    VALUES ('badge', 'rpc/get_user_badges_page') ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';
COMMIT;
