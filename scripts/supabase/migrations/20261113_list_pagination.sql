-- Apply after the existing friend/team schemas. Reads retain caller RLS.
BEGIN;

CREATE OR REPLACE FUNCTION public.get_friend_list_page(p_tab text DEFAULT 'friends', p_search text DEFAULT '', p_page integer DEFAULT 1)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  player uuid := auth.uid();
  skip integer := (greatest(1, least(coalesce(p_page, 1), 1000000)) - 1) * 10;
  needle text := lower(trim(coalesce(p_search, '')));
  result jsonb;
BEGIN
  IF player IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  IF p_tab NOT IN ('friends', 'received', 'sent', 'discover') OR p_tab IS NULL THEN
    RAISE EXCEPTION 'Invalid friend tab' USING ERRCODE = '22023';
  END IF;
  WITH relations AS MATERIALIZED (
    SELECT f.*, CASE WHEN f.user_id = player THEN f.friend_id ELSE f.user_id END AS target_id
    FROM public.user_friends f WHERE f.user_id = player OR f.friend_id = player
  ), counts AS (
    SELECT jsonb_build_object(
      'friends', count(*) FILTER (WHERE status = 'ACCEPTED'),
      'received', count(*) FILTER (WHERE status = 'PENDING' AND friend_id = player),
      'sent', count(*) FILTER (WHERE status = 'PENDING' AND user_id = player),
      'discover', (SELECT count(*) FROM public.user_profile WHERE id <> player)
    ) AS value FROM relations
  ), candidates AS MATERIALIZED (
    SELECT p.* FROM public.user_profile p
    WHERE p.id <> player
      AND (needle = '' OR strpos(lower(coalesce(p.display_name, '')), needle) > 0 OR strpos(p.id::text, needle) > 0)
      AND (p_tab = 'discover' OR EXISTS (
        SELECT 1 FROM relations r WHERE r.target_id = p.id AND
          ((p_tab = 'friends' AND r.status = 'ACCEPTED') OR
           (p_tab = 'received' AND r.status = 'PENDING' AND r.friend_id = player) OR
           (p_tab = 'sent' AND r.status = 'PENDING' AND r.user_id = player))
      ))
  ), page AS MATERIALIZED (
    SELECT p.* FROM candidates p
    ORDER BY CASE WHEN p_tab = 'discover' THEN p.level END DESC NULLS LAST,
      CASE WHEN p_tab <> 'discover' THEN (SELECT max(r.created_at) FROM relations r WHERE r.target_id = p.id) END DESC NULLS LAST,
      p.id
    LIMIT 10 OFFSET skip
  )
  SELECT jsonb_build_object(
    'profiles', coalesce((SELECT jsonb_agg(to_jsonb(p)) FROM page p), '[]'::jsonb),
    'friends', coalesce((SELECT jsonb_agg(to_jsonb(r) - 'target_id' ORDER BY r.created_at DESC, r.id)
      FROM relations r WHERE r.target_id IN (SELECT id FROM page)), '[]'::jsonb),
    'total', (SELECT count(*) FROM candidates), 'counts', (SELECT value FROM counts)
  ) INTO result;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_friend_list_page(text, text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_friend_list_page(text, text, integer) TO authenticated;

-- Only named admin catalogs are accepted. SECURITY INVOKER preserves each
-- table's grants/RLS; identifiers never come directly from request arguments.
CREATE OR REPLACE FUNCTION public.get_admin_list_page(p_table text, p_page integer DEFAULT 1, p_search text DEFAULT '', p_filters jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  source_sql text;
  order_sql text;
  result jsonb;
  skip integer := (greatest(1, least(coalesce(p_page, 1), 1000000)) - 1) * 10;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501'; END IF;
  CASE p_table
    WHEN 'weathers' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.weathers t'; order_sql := 'row->>''code'', row->>''id''';
    WHEN 'modifiers' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.modifiers t'; order_sql := 'row->>''code'', row->>''id''';
    WHEN 'zones' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.zones t'; order_sql := 'row->>''code'', row->>''id''';
    WHEN 'zone_allowed_weathers' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_zone_name'', z.name, ''_weather_name'', w.name) AS row FROM public.zone_allowed_weathers t LEFT JOIN public.zones z ON z.id=t.zone_id LEFT JOIN public.weathers w ON w.id=t.weather_id';
      order_sql := 'row->>''zone_id'', row->>''id''';
    WHEN 'weather_modifiers' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_weather_name'', w.name, ''_modifier_name'', m.name) AS row FROM public.weather_modifiers t LEFT JOIN public.weathers w ON w.id=t.weather_id LEFT JOIN public.modifiers m ON m.id=t.modifier_id';
      order_sql := 'row->>''weather_id'', row->>''id''';
    WHEN 'species' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.species t'; order_sql := 'row->>''name'', row->>''id''';
    WHEN 'fishing_areas' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_country_name'', c.name) AS row FROM public.fishing_areas t LEFT JOIN public.countries c ON c.id::text=t.country_id::text';
      order_sql := 'row->>''created_at'' DESC, row->>''id''';
    WHEN 'species_in_area' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''area'', to_jsonb(a), ''species'', to_jsonb(s), ''_country_name'', c.name) AS row FROM public.species_in_area t LEFT JOIN public.fishing_areas a ON a.id=t.area_id LEFT JOIN public.species s ON s.id=t.species_id LEFT JOIN public.countries c ON c.id::text=a.country_id::text';
      order_sql := '(row->>''weight_rate'')::numeric DESC, row->>''area_id'', row->>''species_id''';
    WHEN 'depth_scope' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.depth_scope t'; order_sql := 'row->>''code'', row->>''id''';
    WHEN 'blueprint' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_result_name'', i.name) AS row FROM public.blueprint t LEFT JOIN public.items i ON i.id=t.result_item_id';
      order_sql := 'row->>''created_at'', row->>''id''';
    WHEN 'aquaculture_species_rules' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_species_name'', s.name) AS row FROM public.aquaculture_species_rules t LEFT JOIN public.species s ON s.id=t.species_id';
      order_sql := 'row->>''species_id''';
    WHEN 'aquaculture_species_foods' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_species_name'', s.name, ''_item_name'', i.name) AS row FROM public.aquaculture_species_foods t LEFT JOIN public.species s ON s.id=t.species_id LEFT JOIN public.items i ON i.id=t.item_id';
      order_sql := 'row->>''species_id'', row->>''item_id''';
    WHEN 'items' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.items t'; order_sql := 'row->>''created_at'' DESC, row->>''id''';
    WHEN 'event' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.event t'; order_sql := 'row->>''created_at'' DESC, row->>''id''';
    WHEN 'event_schedule' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''event'', to_jsonb(e)) AS row FROM public.event_schedule t LEFT JOIN public.event e ON e.id=t.event_id';
      order_sql := 'row->>''start'' DESC, row->>''id''';
    WHEN 'hour_missions' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.hour_missions t'; order_sql := 'row->>''start'' NULLS LAST, row->>''id''';
    WHEN 'fishing_passes' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.fishing_passes t'; order_sql := 'row->>''created_at'' DESC, row->>''id''';
    WHEN 'fishing_pass_rewards' THEN
      source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''pass'', to_jsonb(p), ''item'', to_jsonb(i)) AS row FROM public.fishing_pass_rewards t LEFT JOIN public.fishing_passes p ON p.id=t.pass_id LEFT JOIN public.items i ON i.id=t.item_id';
      order_sql := 'row->''pass''->>''name'', (row->>''day_number'')::integer, row->>''reward_type'', row->>''id''';
    WHEN 'skills' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.skills t'; order_sql := '(row->>''sort_order'')::integer, row->>''name'', row->>''id''';
    WHEN 'guides' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.guides t'; order_sql := '(row->>''sort_order'')::integer, row->>''id''';
    WHEN 'redeem_code' THEN source_sql := 'SELECT to_jsonb(t) || jsonb_build_object(''_expired'', t.expires_at IS NOT NULL AND t.expires_at <= now()) AS row FROM public.redeem_code t'; order_sql := 'row->>''created_at'' DESC, row->>''id''';
    WHEN 'daily_mission_templates' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.daily_mission_templates t'; order_sql := 'row->>''code'', row->>''id''';
    WHEN 'daily_mission_rewards' THEN source_sql := 'SELECT to_jsonb(t) AS row FROM public.daily_mission_rewards t'; order_sql := '(row->>''required_points'')::numeric, row->>''id''';
    ELSE RAISE EXCEPTION 'Unsupported catalog' USING ERRCODE = '22023';
  END CASE;
  IF jsonb_typeof(p_filters) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Invalid filters' USING ERRCODE = '22023'; END IF;
  EXECUTE 'WITH source AS MATERIALIZED (' || source_sql || '), filtered AS MATERIALIZED (SELECT row FROM source
    WHERE row @> $1 AND ($2 = '''' OR EXISTS (SELECT 1 FROM jsonb_each_text(row) f WHERE strpos(lower(f.value), $2) > 0))),
    page AS (SELECT row FROM filtered ORDER BY ' || order_sql || ' LIMIT 10 OFFSET $3)
    SELECT jsonb_build_object(''items'', coalesce((SELECT jsonb_agg(row) FROM page), ''[]''::jsonb), ''total'', (SELECT count(*) FROM filtered),
      ''facets'', coalesce((SELECT jsonb_object_agg(key, values) FROM (
        SELECT f.key, jsonb_agg(DISTINCT f.value ORDER BY f.value) AS values
        FROM source CROSS JOIN LATERAL jsonb_each_text(row) f
        WHERE f.key IN (''category'', ''status'', ''rarity'', ''country_id'', ''area_id'', ''species_id'') AND f.value IS NOT NULL AND trim(f.value) <> '''' GROUP BY f.key
      ) facets), ''{}''::jsonb))'
    INTO result USING p_filters, lower(trim(coalesce(p_search, ''))), skip;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.get_admin_list_page(text, integer, text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_admin_list_page(text, integer, text, jsonb) TO authenticated;


CREATE INDEX IF NOT EXISTS user_friends_user_status_page_idx ON public.user_friends(user_id, status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS user_friends_friend_status_page_idx ON public.user_friends(friend_id, status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS user_teams_status_page_idx ON public.user_teams(status, created_at DESC, id);
CREATE INDEX IF NOT EXISTS personal_notifications_user_page_idx ON public.personal_notifications(user_id, created_at DESC, id);
CREATE INDEX IF NOT EXISTS system_notifications_page_idx ON public.system_notifications(created_at DESC, id);

NOTIFY pgrst, 'reload schema';
COMMIT;
