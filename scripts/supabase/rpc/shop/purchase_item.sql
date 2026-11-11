DECLARE
    v_user_id uuid := auth.uid();
    v_item record;
    v_total_price bigint;
    v_received_quantity bigint;
    v_user_cash bigint;
    v_item_data jsonb;
    v_inventory_id public.user_inventory.id%TYPE;
BEGIN
    -- 1. Kiểm tra đăng nhập
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    -- Kiểm tra số lượng mua hợp lệ
    IF p_quantity IS NULL OR p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than zero';
    END IF;

    -- 2. Lấy thông tin item và kiểm tra trạng thái
    SELECT id, name, price, quantity, "isDisabled", information, image, icon, category, classification, rpc, storage_type
    INTO v_item
    FROM public.items
    WHERE id = p_item_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;

    IF v_item."isDisabled" IS TRUE THEN
        RAISE EXCEPTION 'Item is currently disabled for purchase';
    END IF;

    -- 3. Tính tổng tiền cần trả
    v_total_price := v_item.price * p_quantity;
    -- quantity của item là số lượng nhận mỗi lượt mua, không phải tồn kho.
    v_received_quantity := COALESCE(v_item.quantity, 1)::bigint * p_quantity;

    IF v_received_quantity <= 0 THEN
        RAISE EXCEPTION 'Item quantity per purchase must be greater than zero';
    END IF;

    -- 4. Kiểm tra số dư tiền của user (khóa dòng để tránh race condition)
    SELECT cash
    INTO v_user_cash
    FROM public.currency
    WHERE user_id = v_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'User currency record not found';
    END IF;

    IF v_user_cash < v_total_price THEN
        RAISE EXCEPTION 'Insufficient funds';
    END IF;

    -- 5. Trừ tiền của user
    UPDATE public.currency
    SET cash = cash - v_total_price
    WHERE user_id = v_user_id;

    -- 6. Cộng dồn item dạng stack hoặc tạo record mới
    v_item_data := jsonb_build_object(
        'id', v_item.id,
        'name', v_item.name,
        'image', v_item.image,
        'icon', v_item.icon,
        'category', v_item.category,
        'quantity', v_received_quantity,
        'information', v_item.information,
        'classification', v_item.classification
    );

    IF v_item.storage_type = 'stack' THEN
        SELECT id
        INTO v_inventory_id
        FROM public.user_inventory
        WHERE user_id = v_user_id
          AND data->>'id' = v_item.id::text
        ORDER BY id
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_inventory_id IS NOT NULL THEN
        UPDATE public.user_inventory
        SET data = jsonb_set(
            data,
            '{quantity}',
            to_jsonb(COALESCE((data->>'quantity')::bigint, 0) + v_received_quantity)
        )
        WHERE id = v_inventory_id
          AND user_id = v_user_id;
    ELSE
        INSERT INTO public.user_inventory (user_id, rpc, data)
        VALUES (v_user_id, v_item.rpc, v_item_data);
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Purchase successful',
        'remaining_cash', v_user_cash - v_total_price
    );
END;
