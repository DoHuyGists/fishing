-- Preview only: never renew presence or enter the selected area.
BEGIN;
CREATE OR REPLACE FUNCTION public.get_fishing_fatigue(p_area_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_user UUID := auth.uid(); v_score NUMERIC; v_effects JSONB;
BEGIN
  IF v_user IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.fishing_areas WHERE id = p_area_id) THEN
    RAISE EXCEPTION 'Fishing area not found';
  END IF;
  SELECT public.fishing_fatigue_value(fatigue_score, calculated_at, active_until, clock_timestamp())
  INTO v_score FROM public.user_area_fatigue WHERE user_id = v_user AND area_id = p_area_id;
  v_score := COALESCE(v_score, 0);
  SELECT COALESCE(jsonb_agg(jsonb_build_object('code', m.code, 'name', m.name,
    'target', e.target, 'value', e.value) ORDER BY e.min_fatigue, e.id), '[]'::JSONB)
  INTO v_effects FROM public.fatigue_effects e JOIN public.modifiers m ON m.id = e.modifier_id
  WHERE e.enabled AND m.unit = 'PERCENT' AND v_score >= e.min_fatigue AND v_score < e.max_fatigue;
  RETURN jsonb_build_object('area_id', p_area_id, 'fatigue_score', v_score, 'effects', v_effects);
END;
$$;
REVOKE ALL ON FUNCTION public.get_fishing_fatigue(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_fishing_fatigue(UUID) TO authenticated;
NOTIFY pgrst, 'reload schema';
COMMIT;
