-- Run after migrations/20261113_user_body_equipments.sql.
-- Six slot arrays contain only {"inventory_id":"<uuid>"}; stats come from inventory.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_body_equipment_set()
RETURNS SETOF public.user_body_equipments
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  RETURN QUERY INSERT INTO public.user_body_equipments(user_id, is_used)
    VALUES (v_user_id, NOT EXISTS (SELECT 1 FROM public.user_body_equipments WHERE user_id = v_user_id))
    RETURNING *;
END;
$$;

CREATE OR REPLACE FUNCTION public.save_body_equipment_set(
  p_set_id uuid, p_head jsonb, p_torso jsonb, p_hands jsonb,
  p_legs jsonb, p_feet jsonb, p_accessory jsonb
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_slot record;
  v_entry jsonb;
  v_inventory_id uuid;
  v_seen uuid[] := ARRAY[]::uuid[];
  v_data jsonb;
  v_entries jsonb;
  v_payload jsonb := '{}'::jsonb;
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập để lưu bộ trang bị.'; END IF;
  -- Serialize body-set changes for one player, including active-set switches.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  PERFORM id FROM public.user_body_equipments WHERE id = p_set_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy bộ trang bị cơ thể của bạn.'; END IF;

  FOR v_slot IN SELECT * FROM (VALUES
    ('head', p_head), ('torso', p_torso), ('hands', p_hands),
    ('legs', p_legs), ('feet', p_feet), ('accessory', p_accessory)
  ) AS slots(slot, entries) LOOP
    IF jsonb_typeof(v_slot.entries) IS DISTINCT FROM 'array' THEN
      RAISE EXCEPTION 'Danh sách ở ô % phải là một mảng.', v_slot.slot;
    END IF;
    v_entries := '[]'::jsonb;
    FOR v_entry IN SELECT value FROM jsonb_array_elements(v_slot.entries) LOOP
      IF jsonb_typeof(v_entry) IS DISTINCT FROM 'object'
         OR jsonb_typeof(v_entry->'inventory_id') IS DISTINCT FROM 'string' THEN
        RAISE EXCEPTION 'Vật phẩm phải có inventory_id hợp lệ.';
      END IF;
      BEGIN
        v_inventory_id := (v_entry->>'inventory_id')::uuid;
      EXCEPTION WHEN invalid_text_representation THEN
        RAISE EXCEPTION 'inventory_id không hợp lệ.';
      END;
      IF v_inventory_id = ANY(v_seen) THEN RAISE EXCEPTION 'Vật phẩm bị trùng trong bộ trang bị.'; END IF;
      v_seen := array_append(v_seen, v_inventory_id);
      SELECT data INTO v_data FROM public.user_inventory
        WHERE id = v_inventory_id AND user_id = v_user_id FOR SHARE;
      IF NOT FOUND THEN RAISE EXCEPTION 'Vật phẩm không nằm trong kho của bạn.'; END IF;
      IF jsonb_typeof(v_data) IS DISTINCT FROM 'object'
         OR (v_data->>'category') IS DISTINCT FROM v_slot.slot THEN
        RAISE EXCEPTION 'Vật phẩm không phù hợp ô %.', v_slot.slot;
      END IF;
      IF v_data->>'quantity' IS NOT NULL THEN
        IF (v_data->>'quantity') !~ '^[0-9]+([.][0-9]+)?$' THEN RAISE EXCEPTION 'Số lượng vật phẩm không hợp lệ.'; END IF;
        IF (v_data->>'quantity')::numeric < 1 THEN RAISE EXCEPTION 'Vật phẩm đã hết số lượng.'; END IF;
      END IF;
      -- Ignore client-provided names, stats, and flags.
      v_entries := v_entries || jsonb_build_array(jsonb_build_object('inventory_id', v_inventory_id));
    END LOOP;
    v_payload := jsonb_set(v_payload, ARRAY[v_slot.slot], v_entries);
  END LOOP;
  UPDATE public.user_body_equipments SET
    head = v_payload->'head', torso = v_payload->'torso', hands = v_payload->'hands',
    legs = v_payload->'legs', feet = v_payload->'feet', accessory = v_payload->'accessory'
  WHERE id = p_set_id AND user_id = v_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.switch_body_equipment(p_set_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id uuid := auth.uid();
BEGIN
  IF v_user_id IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập.'; END IF;
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(v_user_id::text, 0));
  PERFORM id FROM public.user_body_equipments WHERE id = p_set_id AND user_id = v_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy bộ trang bị cơ thể của bạn.'; END IF;
  UPDATE public.user_body_equipments SET is_used = false WHERE user_id = v_user_id AND is_used;
  UPDATE public.user_body_equipments SET is_used = true WHERE id = p_set_id AND user_id = v_user_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_body_equipment_set() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.save_body_equipment_set(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.switch_body_equipment(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_body_equipment_set() TO authenticated;
GRANT EXECUTE ON FUNCTION public.save_body_equipment_set(uuid, jsonb, jsonb, jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.switch_body_equipment(uuid) TO authenticated;
COMMIT;
