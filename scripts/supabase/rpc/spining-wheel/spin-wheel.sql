-- Run migrations/spin_wheel_seasons.sql first.
BEGIN;

-- Remove the old entry point so clients cannot supply their own reward pool.
DROP FUNCTION IF EXISTS public.spin_wheel(uuid[]);

CREATE OR REPLACE FUNCTION public.spin_wheel() RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_user_id        uuid := auth.uid();
  v_tickets        bigint;
  v_cost           constant bigint := 1;
  
  v_pool           jsonb;
  v_eligible_count int;
  
  v_item           public.items%ROWTYPE;
  v_data           jsonb;
  v_inventory_id   uuid;

  v_random_index   int;
  v_item_id        uuid;
BEGIN
  -- =====================================================
  -- Step 0: Kiểm tra đăng nhập
  -- =====================================================
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated'
      USING ERRCODE = 'P0001';
  END IF;

  -- =====================================================
  -- Step 1: Lấy danh sách thưởng từ mùa hiện tại, không nhận item từ client.
  -- =====================================================
  v_pool := public.get_spin_wheel_rewards();
  IF v_pool->>'season' IS NULL THEN
    RAISE EXCEPTION 'Chưa có mùa quay đang diễn ra.'
      USING ERRCODE = 'P0002';
  END IF;

  v_eligible_count := jsonb_array_length(v_pool->'rewards');

  IF v_eligible_count = 0 THEN
    RAISE EXCEPTION 'Mùa quay chưa có phần thưởng khả dụng.'
      USING ERRCODE = 'P0006';
  END IF;

  -- =====================================================
  -- Step 2: Mỗi lượt tốn 1 vé. Các vật phẩm trong mùa có xác suất bằng nhau.
  -- =====================================================
  v_random_index := floor(random() * v_eligible_count)::int;
  v_item_id := (v_pool->'rewards'->v_random_index->>'id')::uuid;

  -- =====================================================
  -- Step 4: Lấy thông tin item trúng
  -- =====================================================
  SELECT *
  INTO v_item
  FROM public.items
  WHERE id = v_item_id
    AND "isDisabled" = false;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Item not found or disabled: %', v_item_id
      USING ERRCODE = 'P0003';
  END IF;

  -- =====================================================
  -- Step 5: Khóa dòng currency & kiểm tra số dư
  -- =====================================================
  SELECT tickets
  INTO v_tickets
  FROM public.currency
  WHERE user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Currency record not found for user_id = %', v_user_id
      USING ERRCODE = 'P0004';
  END IF;

  IF v_tickets < v_cost THEN
    RAISE EXCEPTION 'Không đủ vé. Hiện có % vé, cần % vé.', v_tickets, v_cost
      USING ERRCODE = 'P0005';
  END IF;

  -- =====================================================
  -- Step 6: Trừ vé trong cùng giao dịch cấp thưởng; giữ nguyên cash.
  -- =====================================================
  UPDATE public.currency
  SET tickets = tickets - v_cost
  WHERE user_id = v_user_id;

  -- =====================================================
  -- Step 7: Xây dựng json payload theo category
  -- =====================================================
  CASE v_item.category

    WHEN 'rod' THEN
      v_data := jsonb_build_object(
        'id',           v_item.id,
        'category',     v_item.category,
        'icon',         v_item.icon,
        'image',        v_item.image,
        'name',         v_item.name,
        'detail',       v_item.information,
        'rodMaxWeight', round((random() * (3.0 - 0.1) + 0.1)::numeric, 2),
        'luck_bonus',   round((0.1 + random() * (10 - 0.1))::numeric, 2)
      );

    WHEN 'hook' THEN
      v_data := jsonb_build_object(
        'id',           v_item.id,
        'category',     v_item.category,
        'icon',         v_item.icon,
        'image',        v_item.image,
        'name',         v_item.name,
        'detail',       v_item.information,
        'strength', round((0.1 + random() * (10 - 0.1))::numeric, 2),
        'luck_bonus',   round((0.1 + random() * (10 - 0.1))::numeric, 2)
      );

    WHEN 'bait' THEN
      v_data := jsonb_build_object(
        'id',           v_item.id,
        'category',     v_item.category,
        'icon',         v_item.icon,
        'image',        v_item.image,
        'name',         v_item.name,
        'detail',       v_item.information,
        'quantity',     v_item.quantity,
        'match_number', floor(random() * (100 - 1 + 1) + 1)::int,
        'luck_bonus',   round((0.1 + random() * (10 - 0.1))::numeric, 2)
      );

    ELSE
      v_data := jsonb_build_object(
        'id',         v_item.id,
        'category',   v_item.category,
        'icon',       v_item.icon,
        'image',      v_item.image,
        'name',       v_item.name,
        'detail',     v_item.information,
        'luck_bonus', round((0.1 + random() * (10 - 0.1))::numeric, 2)
      );

  END CASE;

  -- =====================================================
  -- Step 8: Lưu vào inventory
  -- =====================================================
  INSERT INTO public.user_inventory (user_id, data)
  VALUES (v_user_id, v_data)
  RETURNING id INTO v_inventory_id;

  -- =====================================================
  -- Step 9: Trả kết quả
  -- =====================================================
  RETURN jsonb_build_object(
    'inventory_id',   v_inventory_id,
    'item_id',        v_item.id,
    'data',           v_data,
    'cost',           v_cost,
    'remaining_tickets', v_tickets - v_cost,
    'season',        v_pool->'season',
    'rewards',       v_pool->'rewards'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.spin_wheel() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.spin_wheel() TO authenticated;

COMMIT;
