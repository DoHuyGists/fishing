-- Run migrations/spin_wheel_seasons.sql and rpc/inventory/grant_inventory_item.sql first.
-- Run as postgres so this SECURITY DEFINER function can call the DB-only grant helper.
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
  -- Step 3: Khóa dòng currency & kiểm tra số dư
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

  IF v_tickets IS NULL OR v_tickets < v_cost THEN
    RAISE EXCEPTION 'Không đủ vé. Hiện có % vé, cần % vé.', v_tickets, v_cost
      USING ERRCODE = 'P0005';
  END IF;

  -- =====================================================
  -- Step 4: Trừ vé trong cùng giao dịch cấp thưởng; giữ nguyên cash.
  -- =====================================================
  UPDATE public.currency
  SET tickets = tickets - v_cost
  WHERE user_id = v_user_id;

  -- Grant the catalog item using the shared inventory rules, in the same transaction.
  v_inventory_id := public.grant_inventory_item(
    p_item_id => v_item_id,
    p_user_id => v_user_id
  );

  -- Preserve the response shape using the actual inventory data (including stacks).
  SELECT data INTO v_data
  FROM public.user_inventory
  WHERE id = v_inventory_id AND user_id = v_user_id;

  -- =====================================================
  -- Step 6: Trả kết quả
  -- =====================================================
  RETURN jsonb_build_object(
    'inventory_id',   v_inventory_id,
    'item_id',        v_item_id,
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
