-- Authenticated API. All writes serialize on the player's profile before touching
-- ponds, fish, inventory or currency. Retries require the same request ID + input.
BEGIN;

CREATE FUNCTION public.get_aquaculture_farm() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user();
BEGIN
    PERFORM public.aquaculture_refresh(u);
    RETURN public.aquaculture_farm_json(u);
END; $$;

CREATE FUNCTION public.purchase_pond_slot(p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); n INTEGER; p UUID; v JSONB; wallet JSONB;
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'buy_slot','{}');
    IF v IS NOT NULL THEN RETURN v; END IF;
    SELECT pond_slot INTO n FROM public.user_profile WHERE id=u;
    IF n>=5 THEN RAISE EXCEPTION 'Maximum of 5 ponds reached'; END IF;
    wallet:=public.aquaculture_wallet_delta(u,0,-300);
    UPDATE public.user_profile SET pond_slot=n+1,updated_at=clock_timestamp() WHERE id=u;
    INSERT INTO public.aquaculture_ponds(user_id,slot_number,name) VALUES(u,n+1,'Ao '||(n+1)) RETURNING id INTO p;
    RETURN public.aquaculture_save_action(u,p_request_id,'buy_slot','{}',
        jsonb_build_object('pond_id',p,'pond_slot',n+1,'shells_spent',300,'wallet_at_purchase',wallet));
END; $$;

CREATE FUNCTION public.stock_aquaculture_batch(p_pond_id UUID,p_species_id UUID,p_quantity INTEGER,p_mode TEXT,p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); r public.aquaculture_species_rules%ROWTYPE;
    pond public.aquaculture_ponds%ROWTYPE; used BIGINT; cost BIGINT; b UUID; v JSONB;
    payload JSONB:=jsonb_build_object('pond_id',p_pond_id,'species_id',p_species_id,'quantity',p_quantity,'mode',p_mode);
    t TIMESTAMPTZ:=clock_timestamp(); ids UUID[]; wallet JSONB;
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'stock',payload);
    IF v IS NOT NULL THEN RETURN v; END IF;
    IF p_quantity IS NULL OR p_quantity NOT BETWEEN 1 AND 10000 OR p_mode IS NULL OR p_mode NOT IN ('simple','advanced') THEN
        RAISE EXCEPTION 'Invalid quantity or care mode' USING ERRCODE='22023';
    END IF;
    SELECT * INTO pond FROM public.aquaculture_ponds WHERE id=p_pond_id AND user_id=u FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pond not found'; END IF;
    SELECT * INTO r FROM public.aquaculture_species_rules WHERE species_id=p_species_id AND enabled;
    IF NOT FOUND THEN RAISE EXCEPTION 'Species not enabled for farming'; END IF;
    IF NOT EXISTS(SELECT 1 FROM public.caught_diary WHERE user_id=u AND species_id=p_species_id) THEN
        RAISE EXCEPTION 'Catch this species at least once before farming it';
    END IF;
    SELECT coalesce(sum(capacity),0) INTO used FROM public.aquaculture_fish WHERE pond_id=pond.id AND status IN ('growing','ready');
    IF used+p_quantity::BIGINT*r.capacity_per_fish>=pond.capacity THEN RAISE EXCEPTION 'Total fish capacity must be strictly less than pond capacity'; END IF;
    cost:=p_quantity::BIGINT*r.seed_cash;
    wallet:=public.aquaculture_wallet_delta(u,-cost,0);
    INSERT INTO public.aquaculture_batches(pond_id,user_id,species_id,mode,initial_fish_count,started_at,ready_at,rules_snapshot)
    VALUES(pond.id,u,r.species_id,p_mode,p_quantity,t,t+r.grow_seconds*INTERVAL '1 second',to_jsonb(r)) RETURNING id INTO b;
    WITH inserted AS (
        INSERT INTO public.aquaculture_fish(batch_id,pond_id,user_id,species_id,capacity,weight_kg)
        SELECT b,pond.id,u,r.species_id,r.capacity_per_fish,r.seed_weight_kg FROM generate_series(1,p_quantity) RETURNING id
    ) SELECT array_agg(id ORDER BY id) INTO ids FROM inserted;
    RETURN public.aquaculture_save_action(u,p_request_id,'stock',payload,jsonb_build_object(
        'batch_id',b,'fish_ids',to_jsonb(ids),'ready_at',t+r.grow_seconds*INTERVAL '1 second','cash_spent',cost,'wallet_at_stock',wallet));
END; $$;

CREATE FUNCTION public.feed_aquaculture_batch(p_batch_id UUID,p_inventory_id UUID,p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); b public.aquaculture_batches%ROWTYPE;
    food public.aquaculture_species_foods%ROWTYPE; data JSONB; quantity NUMERIC; needed INTEGER; used BIGINT;
    v JSONB; t TIMESTAMPTZ:=clock_timestamp(); score NUMERIC;
    payload JSONB:=jsonb_build_object('batch_id',p_batch_id,'inventory_id',p_inventory_id);
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'feed',payload);
    IF v IS NOT NULL THEN RETURN v; END IF;
    PERFORM public.aquaculture_refresh(u);
    SELECT * INTO b FROM public.aquaculture_batches WHERE id=p_batch_id AND user_id=u FOR UPDATE;
    IF NOT FOUND OR b.status<>'growing' OR b.mode<>'advanced' THEN RAISE EXCEPTION 'Only growing advanced batches need optional feeding'; END IF;
    IF b.feed_available_at>t OR b.quality_score>=1 THEN RAISE EXCEPTION 'Feeding is on cooldown or quality is already full'; END IF;
    SELECT i.data INTO data FROM public.user_inventory i WHERE i.id=p_inventory_id AND i.user_id=u FOR UPDATE;
    IF NOT FOUND OR jsonb_typeof(data->'quantity') IS DISTINCT FROM 'number' THEN RAISE EXCEPTION 'Food inventory unavailable'; END IF;
    SELECT f.* INTO food FROM public.aquaculture_species_foods f JOIN public.items i ON i.id=f.item_id
    WHERE f.species_id=b.species_id AND f.item_id::TEXT=data->>'id' AND f.enabled AND NOT coalesce(i."isDisabled",FALSE);
    IF NOT FOUND THEN RAISE EXCEPTION 'This inventory item is not valid food for this species'; END IF;
    quantity:=(data->>'quantity')::NUMERIC;
    SELECT coalesce(sum(capacity),0) INTO used FROM public.aquaculture_fish WHERE batch_id=b.id AND status IN ('growing','ready');
    needed:=ceil(used::NUMERIC/food.capacity_units_per_item);
    IF needed<1 OR quantity<needed OR quantity<>trunc(quantity) OR quantity::TEXT IN ('NaN','Infinity','-Infinity') THEN
        RAISE EXCEPTION 'Not enough food for the batch';
    END IF;
    UPDATE public.user_inventory i SET data=jsonb_set(i.data,'{quantity}',to_jsonb(quantity-needed)) WHERE i.id=p_inventory_id AND i.user_id=u;
    score:=least(1,b.quality_score+food.quality_gain);
    UPDATE public.aquaculture_batches SET quality_score=score,
        feed_available_at=t+(b.rules_snapshot->>'feed_cooldown_seconds')::INTEGER*INTERVAL '1 second' WHERE id=b.id;
    RETURN public.aquaculture_save_action(u,p_request_id,'feed',payload,jsonb_build_object(
        'batch_id',b.id,'item_id',food.item_id,'quantity_consumed',needed,'quality_gain',food.quality_gain,'quality_score',score));
END; $$;

CREATE FUNCTION public.care_aquaculture_pond(p_pond_id UUID,p_task TEXT,p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); p public.aquaculture_ponds%ROWTYPE;
    v JSONB; n INTEGER; gain NUMERIC; cooldown INTERVAL; t TIMESTAMPTZ:=clock_timestamp();
    payload JSONB:=jsonb_build_object('pond_id',p_pond_id,'task',p_task);
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'care',payload);
    IF v IS NOT NULL THEN RETURN v; END IF;
    IF p_task='water' THEN gain:=0.1; cooldown:=INTERVAL '4 hours';
    ELSIF p_task='oxygen' THEN gain:=0.03; cooldown:=INTERVAL '1 hour';
    ELSE RAISE EXCEPTION 'Task must be water or oxygen' USING ERRCODE='22023'; END IF;
    PERFORM public.aquaculture_refresh(u);
    SELECT * INTO p FROM public.aquaculture_ponds WHERE id=p_pond_id AND user_id=u FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Pond not found'; END IF;
    IF p.care_available_at>t THEN RAISE EXCEPTION 'Pond care is on cooldown'; END IF;
    UPDATE public.aquaculture_batches SET quality_score=least(1,quality_score+gain)
    WHERE pond_id=p.id AND mode='advanced' AND status='growing' AND quality_score<1;
    GET DIAGNOSTICS n=ROW_COUNT;
    IF n=0 THEN RAISE EXCEPTION 'No growing advanced batch benefits from this care'; END IF;
    UPDATE public.aquaculture_ponds SET care_available_at=t+cooldown,updated_at=t WHERE id=p.id;
    RETURN public.aquaculture_save_action(u,p_request_id,'care',payload,
        jsonb_build_object('pond_id',p.id,'affected_batches',n,'quality_gain',gain,'care_available_at',t+cooldown));
END; $$;

CREATE FUNCTION public.sell_aquaculture_fish(p_fish_ids UUID[],p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); ids UUID[]:=public.aquaculture_fish_ids(p_fish_ids);
    v JSONB; payload JSONB:=jsonb_build_object('fish_ids',to_jsonb(ids)); n INTEGER; amount BIGINT; wallet JSONB;
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'sell',payload);
    IF v IS NOT NULL THEN RETURN v; END IF;
    PERFORM public.aquaculture_refresh(u);
    SELECT count(*) INTO n FROM public.aquaculture_fish WHERE user_id=u AND id=ANY(ids) AND status='ready';
    IF n<>cardinality(ids) THEN RAISE EXCEPTION 'Every selected fish must belong to you and be ready'; END IF;
    SELECT sum(round(f.weight_kg*(b.rules_snapshot->>'sale_cash_per_kg')::NUMERIC))::BIGINT INTO amount
    FROM public.aquaculture_fish f JOIN public.aquaculture_batches b ON b.id=f.batch_id WHERE f.id=ANY(ids) AND f.user_id=u;
    wallet:=public.aquaculture_wallet_delta(u,amount,0);
    UPDATE public.aquaculture_fish f SET status='sold',exited_at=clock_timestamp(),
        cash_earned=round(f.weight_kg*(b.rules_snapshot->>'sale_cash_per_kg')::NUMERIC)::BIGINT
    FROM public.aquaculture_batches b WHERE b.id=f.batch_id AND f.id=ANY(ids) AND f.user_id=u;
    PERFORM public.aquaculture_close_empty_batches(u);
    RETURN public.aquaculture_save_action(u,p_request_id,'sell',payload,
        jsonb_build_object('fish_ids',to_jsonb(ids),'cash_earned',amount,'wallet_at_sale',wallet));
END; $$;

CREATE FUNCTION public.release_aquaculture_fish(p_fish_ids UUID[],p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); ids UUID[]:=public.aquaculture_fish_ids(p_fish_ids);
    v JSONB; payload JSONB:=jsonb_build_object('fish_ids',to_jsonb(ids)); n INTEGER;
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'release',payload);
    IF v IS NOT NULL THEN RETURN v; END IF;
    PERFORM public.aquaculture_refresh(u);
    SELECT count(*) INTO n FROM public.aquaculture_fish WHERE id=ANY(ids) AND user_id=u AND status IN ('growing','ready');
    IF n<>cardinality(ids) THEN RAISE EXCEPTION 'Every selected fish must still belong to your ponds'; END IF;
    UPDATE public.aquaculture_fish SET status='released',exited_at=clock_timestamp() WHERE id=ANY(ids) AND user_id=u;
    PERFORM public.aquaculture_close_empty_batches(u);
    RETURN public.aquaculture_save_action(u,p_request_id,'release',payload,jsonb_build_object('released_fish_ids',to_jsonb(ids),'refund',0));
END; $$;

CREATE FUNCTION public.transfer_aquaculture_fish(p_fish_ids UUID[],p_request_id UUID) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=public.aquaculture_lock_user(); ids UUID[]:=public.aquaculture_fish_ids(p_fish_ids);
    v JSONB; payload JSONB:=jsonb_build_object('fish_ids',to_jsonb(ids)); n INTEGER; occupied BIGINT; storage_limit INTEGER;
    f public.aquaculture_fish%ROWTYPE; target UUID; links JSONB:='[]';
BEGIN
    v:=public.aquaculture_previous_action(u,p_request_id,'transfer',payload);
    IF v IS NOT NULL THEN RETURN v; END IF;
    PERFORM public.aquaculture_refresh(u);
    SELECT count(*) INTO n FROM public.aquaculture_fish WHERE id=ANY(ids) AND user_id=u AND status='ready';
    IF n<>cardinality(ids) THEN RAISE EXCEPTION 'Every selected fish must belong to you and be ready'; END IF;
    SELECT species_storage_capacity INTO storage_limit FROM public.user_profile WHERE id=u;
    SELECT count(*) INTO occupied FROM public.caught WHERE user_id=u AND status='normal';
    IF storage_limit IS NULL OR occupied+cardinality(ids)>storage_limit THEN RAISE EXCEPTION 'Not enough room in fish storage'; END IF;
    FOR f IN SELECT * FROM public.aquaculture_fish WHERE id=ANY(ids) AND user_id=u ORDER BY id FOR UPDATE LOOP
        target:=gen_random_uuid();
        -- Publish provenance before inserting caught, so existing insert triggers
        -- can recognize a farm transfer by aquaculture_fish.caught_id if needed.
        UPDATE public.aquaculture_fish SET status='transferred',exited_at=clock_timestamp(),caught_id=target WHERE id=f.id;
        INSERT INTO public.caught(id,user_id,species_id,weight,star_rating,variant_type,is_shiny,status,area_id,area_session_id)
        VALUES(target,u,f.species_id,f.weight_kg,f.star_rating,f.variant_type,f.is_shiny,'normal',NULL,NULL);
        links:=links||jsonb_build_array(jsonb_build_object('fish_id',f.id,'caught_id',target,'is_super_special',f.is_super_special));
    END LOOP;
    PERFORM public.aquaculture_close_empty_batches(u);
    RETURN public.aquaculture_save_action(u,p_request_id,'transfer',payload,jsonb_build_object('transferred',links));
END; $$;

REVOKE ALL ON FUNCTION public.get_aquaculture_farm(),public.purchase_pond_slot(UUID),
    public.stock_aquaculture_batch(UUID,UUID,INTEGER,TEXT,UUID),public.feed_aquaculture_batch(UUID,UUID,UUID),
    public.care_aquaculture_pond(UUID,TEXT,UUID),public.sell_aquaculture_fish(UUID[],UUID),
    public.release_aquaculture_fish(UUID[],UUID),public.transfer_aquaculture_fish(UUID[],UUID)
    FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION public.get_aquaculture_farm(),public.purchase_pond_slot(UUID),
    public.stock_aquaculture_batch(UUID,UUID,INTEGER,TEXT,UUID),public.feed_aquaculture_batch(UUID,UUID,UUID),
    public.care_aquaculture_pond(UUID,TEXT,UUID),public.sell_aquaculture_fish(UUID[],UUID),
    public.release_aquaculture_fish(UUID[],UUID),public.transfer_aquaculture_fish(UUID[],UUID) TO authenticated;
COMMIT;
