-- Requires ranked fishing, its fatigue preview, and body equipment migrations.
-- Deploy before the updated cast / submit RPCs and frontend.
BEGIN;

ALTER TABLE public.fishing_areas ADD COLUMN IF NOT EXISTS survival_mode BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.fishing_survival_trips (
  trip_id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  area_id UUID NOT NULL REFERENCES public.fishing_areas(id) ON DELETE CASCADE,
  died_at TIMESTAMPTZ,
  lost_fish BIGINT NOT NULL DEFAULT 0
);
ALTER TABLE public.fishing_survival_trips ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.fishing_survival_trips FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fishing_survival_trips TO service_role;

-- Maximum values remain in health_bonuses. Only health_remaining is consumed.
-- A missing remaining key means the item has not been consumed yet.
CREATE OR REPLACE FUNCTION public.fishing_health_value(p_data JSONB, p_resource TEXT)
RETURNS NUMERIC LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT CASE WHEN jsonb_typeof(p_data->'health_bonuses'->p_resource) = 'number'
    THEN GREATEST(0, LEAST((p_data->'health_bonuses'->>p_resource)::NUMERIC,
      CASE WHEN jsonb_typeof(p_data->'health_remaining') = 'object' AND p_data->'health_remaining' ? p_resource THEN
        CASE WHEN jsonb_typeof(p_data->'health_remaining'->p_resource) = 'number'
          THEN (p_data->'health_remaining'->>p_resource)::NUMERIC ELSE 0 END
      ELSE (p_data->'health_bonuses'->>p_resource)::NUMERIC END)) ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION public.fishing_survival_settle(p_user UUID, p_trip UUID, p_consume BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_area UUID; v_dead TIMESTAMPTZ; v_lost BIGINT := 0;
  v_ids UUID[]; v_item RECORD; v_resource TEXT; v_value NUMERIC; v_total NUMERIC;
  v_cost NUMERIC; v_share NUMERIC; v_left NUMERIC; v_pool NUMERIC;
  v_totals JSONB := '{}'; v_remaining JSONB; v_items JSONB := '[]';
BEGIN
  -- Same lock as body equipment save/switch, acquired before any row locks.
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user::TEXT, 0));
  SELECT area_id INTO v_area FROM public.user_in_area
  WHERE user_id = p_user AND session_id = p_trip AND status = 'enter' FOR UPDATE;
  IF NOT FOUND OR p_trip IS NULL THEN RAISE EXCEPTION 'Survival trip is no longer active'; END IF;
  INSERT INTO public.fishing_survival_trips(trip_id,user_id,area_id)
    VALUES(p_trip,p_user,v_area) ON CONFLICT DO NOTHING;
  SELECT died_at,lost_fish INTO v_dead,v_lost FROM public.fishing_survival_trips
    WHERE trip_id = p_trip AND user_id = p_user AND area_id = v_area FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Invalid survival trip'; END IF;

  -- References may appear in several sets; an inventory item contributes once.
  SELECT COALESCE(array_agg(DISTINCT i.id ORDER BY i.id), ARRAY[]::UUID[]) INTO v_ids
  FROM public.user_body_equipments b
  CROSS JOIN LATERAL (VALUES ('head',b.head),('torso',b.torso),('hands',b.hands),
    ('legs',b.legs),('feet',b.feet),('accessory',b.accessory)) slots(slot,entries)
  CROSS JOIN LATERAL jsonb_array_elements(slots.entries) entry
  JOIN public.user_inventory i ON i.id::TEXT = entry->>'inventory_id' AND i.user_id = p_user
  WHERE b.user_id = p_user AND b.is_used AND i.data->>'category' = slots.slot
    AND CASE WHEN i.data->>'quantity' IS NULL THEN TRUE ELSE
      CASE WHEN i.data->>'quantity' ~ '^[0-9]+([.][0-9]+)?$'
        THEN (i.data->>'quantity')::NUMERIC >= 1 ELSE FALSE END END;
  PERFORM id FROM public.user_inventory WHERE id = ANY(v_ids) ORDER BY id FOR UPDATE;

  FOREACH v_resource IN ARRAY ARRAY['vitality','hydration','nutrition','energy','morale'] LOOP
    SELECT COALESCE(sum(public.fishing_health_value(data,v_resource)),0) INTO v_total
      FROM public.user_inventory WHERE id = ANY(v_ids);
    v_cost := CASE WHEN p_consume AND v_dead IS NULL THEN LEAST(1,v_total) ELSE 0 END;
    v_left := v_cost; v_pool := v_total;
    IF v_cost > 0 THEN
      FOR v_item IN SELECT id,data FROM public.user_inventory WHERE id = ANY(v_ids) ORDER BY id LOOP
        v_value := public.fishing_health_value(v_item.data,v_resource);
        IF v_value <= 0 THEN CONTINUE; END IF;
        -- Redistribute rounding remainder to the last contributing item.
        v_share := CASE WHEN v_value = v_pool THEN v_left
          ELSE LEAST(v_left,v_value,trunc(v_left * v_value / v_pool,6)) END;
        v_remaining := CASE WHEN jsonb_typeof(v_item.data->'health_remaining') = 'object'
          THEN v_item.data->'health_remaining' ELSE '{}'::JSONB END;
        UPDATE public.user_inventory SET data = jsonb_set(data,'{health_remaining}',
          jsonb_set(v_remaining,ARRAY[v_resource],to_jsonb(v_value-v_share))) WHERE id = v_item.id;
        v_left := v_left-v_share; v_pool := v_pool-v_value;
      END LOOP;
    END IF;
    v_totals := jsonb_set(v_totals,ARRAY[v_resource],to_jsonb(v_total-v_cost));
  END LOOP;

  IF v_dead IS NULL AND (v_totals->>'vitality')::NUMERIC <= 0 THEN
    v_dead := clock_timestamp();
    -- All fish from this trip, irrespective of their current bag/storage state.
    DELETE FROM public.caught WHERE user_id = p_user AND area_session_id = p_trip;
    GET DIAGNOSTICS v_lost = ROW_COUNT;
    UPDATE public.fishing_survival_trips SET died_at = v_dead,lost_fish = v_lost WHERE trip_id = p_trip;
    UPDATE public.fishing_sessions SET status = 'CANCELLED'
      WHERE user_id = p_user AND area_session_id = p_trip AND status IN ('WAITING','BITE');
  END IF;
  FOR v_item IN SELECT id,data FROM public.user_inventory WHERE id = ANY(v_ids) ORDER BY id LOOP
    v_remaining := '{}';
    FOREACH v_resource IN ARRAY ARRAY['vitality','hydration','nutrition','energy','morale'] LOOP
      v_remaining := jsonb_set(v_remaining,ARRAY[v_resource],to_jsonb(public.fishing_health_value(v_item.data,v_resource)));
    END LOOP;
    v_items := v_items || jsonb_build_array(jsonb_build_object('inventory_id',v_item.id,'remaining',v_remaining));
  END LOOP;
  RETURN jsonb_build_object('enabled',TRUE,'trip_id',p_trip,'dead',v_dead IS NOT NULL,
    'lost_fish',v_lost,'remaining',v_totals,'equipment',v_items);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fishing_survival() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_trip UUID; v_enabled BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(v_user::TEXT,0));
  SELECT u.session_id,a.survival_mode INTO v_trip,v_enabled FROM public.user_in_area u
    JOIN public.fishing_areas a ON a.id = u.area_id WHERE u.user_id = v_user AND u.status = 'enter';
  IF NOT COALESCE(v_enabled,FALSE) THEN RETURN jsonb_build_object('enabled',FALSE); END IF;
  RETURN public.fishing_survival_settle(v_user,v_trip,FALSE);
END;
$$;

-- Survival areas never accumulate fatigue, including membership-trigger updates.
CREATE OR REPLACE FUNCTION public.fishing_set_presence(p_user UUID,p_area UUID,p_now TIMESTAMPTZ)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('fishing-fatigue:' || p_user::TEXT,0));
  SELECT GREATEST(p_now,COALESCE(max(calculated_at),p_now)) INTO p_now
    FROM public.user_area_fatigue WHERE user_id = p_user;
  UPDATE public.user_area_fatigue SET
    fatigue_score = public.fishing_fatigue_value(fatigue_score,calculated_at,active_until,p_now),
    calculated_at = p_now,active_until = NULL WHERE user_id = p_user AND active_until IS NOT NULL;
  IF p_area IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.fishing_areas WHERE id = p_area AND survival_mode) THEN
    INSERT INTO public.user_area_fatigue(user_id,area_id,calculated_at,active_until)
      VALUES(p_user,p_area,p_now,p_now+INTERVAL '90 seconds')
    ON CONFLICT(user_id,area_id) DO UPDATE SET
      fatigue_score = public.fishing_fatigue_value(user_area_fatigue.fatigue_score,
        user_area_fatigue.calculated_at,user_area_fatigue.active_until,p_now),
      calculated_at = p_now,active_until = p_now+INTERVAL '90 seconds';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_fishing_fatigue(p_area_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_score NUMERIC; v_effects JSONB; v_survival BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  SELECT survival_mode INTO v_survival FROM public.fishing_areas WHERE id = p_area_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fishing area not found'; END IF;
  IF v_survival THEN
    RETURN jsonb_build_object('area_id',p_area_id,'fatigue_score',0,'effects','[]'::JSONB);
  END IF;
  SELECT public.fishing_fatigue_value(fatigue_score,calculated_at,active_until,clock_timestamp())
    INTO v_score FROM public.user_area_fatigue WHERE user_id = v_user AND area_id = p_area_id;
  v_score := COALESCE(v_score,0);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code',m.code,'name',m.name,'target',e.target,'value',e.value)
    ORDER BY e.min_fatigue,e.id),'[]'::JSONB) INTO v_effects
    FROM public.fatigue_effects e JOIN public.modifiers m ON m.id = e.modifier_id
    WHERE e.enabled AND m.unit = 'PERCENT' AND v_score >= e.min_fatigue AND v_score < e.max_fatigue;
  RETURN jsonb_build_object('area_id',p_area_id,'fatigue_score',v_score,'effects',v_effects);
END;
$$;

CREATE OR REPLACE FUNCTION public.touch_fishing_presence() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_area UUID;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  SELECT area_id INTO v_area FROM public.user_in_area WHERE user_id = v_user AND status = 'enter' FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Player is not in a fishing area'; END IF;
  PERFORM public.fishing_set_presence(v_user,v_area,clock_timestamp());
  RETURN public.get_fishing_fatigue(v_area);
END;
$$;

-- Stop existing survival-area leases without changing any stored fatigue score.
UPDATE public.user_area_fatigue f SET active_until = NULL,calculated_at = clock_timestamp()
  FROM public.fishing_areas a WHERE a.id = f.area_id AND a.survival_mode AND f.active_until IS NOT NULL;

REVOKE ALL ON FUNCTION public.fishing_health_value(JSONB,TEXT),
  public.fishing_survival_settle(UUID,UUID,BOOLEAN),public.get_fishing_survival() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.get_fishing_survival() TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
