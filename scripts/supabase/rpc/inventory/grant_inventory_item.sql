-- Run this entire file as postgres in the Supabase SQL Editor.
-- DB-only helper: API roles, including service_role, cannot execute it.
-- Grants one catalog bundle (items.quantity), without charging currency.
-- Omitted or NULL p_user_id falls back to auth.uid(); requires an auth context.
-- Example: SELECT public.grant_inventory_item(p_item_id => 'ITEM_UUID', p_user_id => 'USER_UUID');
BEGIN;

CREATE OR REPLACE FUNCTION public.grant_inventory_item(p_item_id uuid, p_user_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
    v_user_id uuid := COALESCE(p_user_id, auth.uid());
    v_item public.items%ROWTYPE;
    v_inventory_id public.user_inventory.id%TYPE;
    v_quantity bigint;
    v_data jsonb;
BEGIN
    IF p_item_id IS NULL OR v_user_id IS NULL THEN
        RAISE EXCEPTION 'Item ID and user ID are required';
    END IF;

    SELECT * INTO v_item FROM public.items WHERE id = p_item_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found';
    END IF;
    IF v_item."isDisabled" IS TRUE THEN
        RAISE EXCEPTION 'Item is disabled';
    END IF;

    v_quantity := COALESCE(v_item.quantity, 1)::bigint;
    IF v_quantity <= 0 THEN
        RAISE EXCEPTION 'Item quantity must be greater than zero';
    END IF;

    -- Validate the recipient and serialize grants to the same user, including
    -- the first grant of a stack where there is no inventory row to lock yet.
    PERFORM id FROM auth.users WHERE id = v_user_id FOR NO KEY UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found';
    END IF;

    v_data := COALESCE(v_item.data, '{}'::jsonb) || jsonb_build_object(
        'id', v_item.id,
        'name', v_item.name,
        'image', v_item.image,
        'icon', v_item.icon,
        'category', v_item.category,
        'quantity', v_quantity,
        'information', v_item.information,
        'classification', v_item.classification
    );

    IF v_item.storage_type = 'stack' THEN
        SELECT id INTO v_inventory_id
        FROM public.user_inventory
        WHERE user_id = v_user_id AND data->>'id' = v_item.id::text
        ORDER BY id
        LIMIT 1
        FOR UPDATE;
    END IF;

    IF v_inventory_id IS NOT NULL THEN
        UPDATE public.user_inventory
        SET data = jsonb_set(
            data,
            '{quantity}',
            to_jsonb(COALESCE((data->>'quantity')::bigint, 0) + v_quantity)
        )
        WHERE id = v_inventory_id AND user_id = v_user_id;
    ELSE
        INSERT INTO public.user_inventory (user_id, rpc, data)
        VALUES (v_user_id, v_item.rpc, v_data)
        RETURNING id INTO v_inventory_id;
    END IF;

    RETURN v_inventory_id;
END;
$$;

-- PUBLIC has EXECUTE by default; revoke in the creation transaction.
-- Do not grant this helper to any API role.
REVOKE ALL ON FUNCTION public.grant_inventory_item(uuid, uuid)
    FROM PUBLIC, anon, authenticated, service_role;

COMMIT;
