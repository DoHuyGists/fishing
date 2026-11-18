-- Run in Supabase SQL Editor before saving distributions in the admin UI.
-- Caller permissions/RLS remain in force; one RPC updates the complete lake atomically.
BEGIN;

CREATE OR REPLACE FUNCTION public.update_species_in_area_distribution(p_area_id uuid, p_weights jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  item jsonb;
  expected_count integer;
  actual_count integer;
  updated_count integer;
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.feature_flags_is_admin(), false) THEN
    RAISE EXCEPTION 'Admin access required' USING ERRCODE = '42501';
  END IF;
  IF p_area_id IS NULL OR jsonb_typeof(p_weights) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Invalid distribution' USING ERRCODE = '22023';
  END IF;
  expected_count := jsonb_array_length(p_weights);
  IF expected_count = 0 THEN
    RAISE EXCEPTION 'Distribution cannot be empty' USING ERRCODE = '22023';
  END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_weights) LOOP
    IF jsonb_typeof(item->'weight_rate') IS DISTINCT FROM 'number'
      OR jsonb_typeof(item->'previous_weight_rate') IS DISTINCT FROM 'number'
      OR (item->>'weight_rate')::numeric < 0
      OR (item->>'previous_weight_rate')::numeric < 0
      OR item->>'species_id' IS NULL THEN
      RAISE EXCEPTION 'Invalid species weight' USING ERRCODE = '22023';
    END IF;
  END LOOP;
  IF (SELECT count(DISTINCT (value->>'species_id')::uuid) FROM jsonb_array_elements(p_weights)) <> expected_count THEN
    RAISE EXCEPTION 'Duplicate species' USING ERRCODE = '22023';
  END IF;

  -- Serialize edits of the same lake, including concurrent membership changes
  -- that use the existing foreign key to fishing_areas.
  PERFORM 1 FROM public.fishing_areas WHERE id = p_area_id FOR UPDATE;
  PERFORM 1 FROM public.species_in_area WHERE area_id = p_area_id ORDER BY species_id FOR UPDATE;
  SELECT count(*) INTO actual_count FROM public.species_in_area WHERE area_id = p_area_id;
  IF actual_count <> expected_count OR EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_weights) w
    LEFT JOIN public.species_in_area sa ON sa.area_id = p_area_id AND sa.species_id = (w->>'species_id')::uuid
    WHERE sa.species_id IS NULL OR sa.weight_rate IS DISTINCT FROM (w->>'previous_weight_rate')::numeric
  ) THEN
    RAISE EXCEPTION 'Distribution changed; reload before saving' USING ERRCODE = '40001';
  END IF;

  UPDATE public.species_in_area sa SET weight_rate = (w.value->>'weight_rate')::numeric
  FROM jsonb_array_elements(p_weights) w(value)
  WHERE sa.area_id = p_area_id AND sa.species_id = (w.value->>'species_id')::uuid;
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  IF updated_count <> expected_count THEN
    RAISE EXCEPTION 'Some species could not be updated' USING ERRCODE = '42501';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.update_species_in_area_distribution(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_species_in_area_distribution(uuid, jsonb) TO authenticated;

COMMIT;
