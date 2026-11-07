-- Internal functions. Not callable through the public API; all names qualified.
BEGIN;
CREATE FUNCTION public.aquaculture_lock_user() RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=auth.uid(); slots INTEGER;
BEGIN
    IF u IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
    SELECT pond_slot INTO slots FROM public.user_profile WHERE id=u FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
    -- Materialize the free first pond (and any previously unlocked empty slots).
    INSERT INTO public.aquaculture_ponds(user_id,slot_number,name)
    SELECT u,n,'Ao '||n FROM generate_series(1,slots) n ON CONFLICT(user_id,slot_number) DO NOTHING;
    RETURN u;
END; $$;

CREATE FUNCTION public.aquaculture_wallet_delta(u UUID,dc BIGINT,ds BIGINT) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE w public.currency%ROWTYPE;
BEGIN
    BEGIN
        SELECT * INTO STRICT w FROM public.currency WHERE user_id=u FOR UPDATE;
    EXCEPTION WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN RAISE EXCEPTION 'Expected exactly one currency wallet'; END;
    IF w.cash IS NULL OR w.shells IS NULL OR w.cash::TEXT IN ('NaN','Infinity','-Infinity')
        OR w.shells::TEXT IN ('NaN','Infinity','-Infinity') OR w.cash+dc<0 OR w.shells+ds<0 THEN
        RAISE EXCEPTION 'Insufficient or invalid wallet balance';
    END IF;
    UPDATE public.currency SET cash=cash+dc,shells=shells+ds WHERE id=w.id RETURNING * INTO w;
    RETURN jsonb_build_object('cash',w.cash,'shells',w.shells);
END; $$;

CREATE FUNCTION public.aquaculture_previous_action(u UUID,r UUID,k TEXT,p JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE a public.aquaculture_actions%ROWTYPE;
BEGIN
    IF r IS NULL THEN RAISE EXCEPTION 'Request ID required' USING ERRCODE='22023'; END IF;
    SELECT * INTO a FROM public.aquaculture_actions WHERE user_id=u AND request_id=r;
    IF FOUND THEN
        IF a.kind<>k OR a.input<>p THEN RAISE EXCEPTION 'Request ID reused with different input' USING ERRCODE='22023'; END IF;
        RETURN a.result;
    END IF;
    RETURN NULL;
END; $$;

CREATE FUNCTION public.aquaculture_save_action(u UUID,r UUID,k TEXT,p JSONB,v JSONB) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    INSERT INTO public.aquaculture_actions(user_id,request_id,kind,input,result) VALUES(u,r,k,p,v);
    RETURN v;
END; $$;

CREATE FUNCTION public.aquaculture_fish_ids(ids UUID[]) RETURNS UUID[]
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE result UUID[]; n INTEGER;
BEGIN
    IF ids IS NULL OR coalesce(cardinality(ids),0)=0 OR array_ndims(ids)<>1 OR cardinality(ids)>500 THEN
        RAISE EXCEPTION 'Select between 1 and 500 fish IDs' USING ERRCODE='22023';
    END IF;
    SELECT array_agg(DISTINCT x ORDER BY x),count(x) INTO result,n FROM unnest(ids) x;
    IF n<>cardinality(ids) OR cardinality(result)<>cardinality(ids) THEN
        RAISE EXCEPTION 'Duplicate or null fish IDs' USING ERRCODE='22023';
    END IF;
    RETURN result;
END; $$;

CREATE FUNCTION public.aquaculture_refresh(u UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE b public.aquaculture_batches%ROWTYPE; f public.aquaculture_fish%ROWTYPE;
    special BOOLEAN; probability NUMERIC; weight NUMERIC; t TIMESTAMPTZ:=clock_timestamp();
BEGIN
    FOR b IN SELECT * FROM public.aquaculture_batches WHERE user_id=u AND status='growing' AND ready_at<=t ORDER BY id FOR UPDATE LOOP
        probability:=(b.rules_snapshot->>'rare_chance')::NUMERIC;
        IF b.mode='advanced' THEN probability:=probability+b.quality_score*(b.rules_snapshot->>'advanced_rare_bonus')::NUMERIC; END IF;
        FOR f IN SELECT * FROM public.aquaculture_fish WHERE batch_id=b.id AND status='growing' ORDER BY id FOR UPDATE LOOP
            special:=random()<probability;
            weight:=(b.rules_snapshot->>'adult_weight_kg')::NUMERIC*(0.9+random()*0.2)*(1+b.quality_score*0.2);
            IF special THEN weight:=weight*(b.rules_snapshot->>'rare_weight_multiplier')::NUMERIC; END IF;
            UPDATE public.aquaculture_fish SET status='ready',weight_kg=greatest(0.0001,round(weight,4)),
                is_super_special=special,is_shiny=special,star_rating=CASE WHEN special THEN 5 ELSE 1+floor(b.quality_score*3)::INTEGER END,
                matured_at=b.ready_at WHERE id=f.id;
        END LOOP;
        UPDATE public.aquaculture_batches SET status='ready' WHERE id=b.id;
    END LOOP;
END; $$;

CREATE FUNCTION public.aquaculture_close_empty_batches(u UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
    UPDATE public.aquaculture_batches b SET status='closed',closed_at=clock_timestamp()
    WHERE b.user_id=u AND b.status<>'closed' AND NOT EXISTS (
        SELECT 1 FROM public.aquaculture_fish f WHERE f.batch_id=b.id AND f.status IN ('growing','ready')
    );
END; $$;

CREATE FUNCTION public.aquaculture_farm_json(u UUID) RETURNS JSONB
LANGUAGE sql SECURITY DEFINER SET search_path='' AS $$
SELECT jsonb_build_object('pond_slot',(SELECT pond_slot FROM public.user_profile WHERE id=u),
    'server_time',clock_timestamp(),
    'ponds',coalesce((SELECT jsonb_agg(to_jsonb(p)||jsonb_build_object(
        'used_capacity',o.used_capacity,'available_capacity',o.available_capacity,
        'batches',coalesce((SELECT jsonb_agg(to_jsonb(b) ORDER BY b.started_at,b.id)
            FROM public.aquaculture_batches b WHERE b.pond_id=p.id AND b.status<>'closed'),'[]'::JSONB),
        'fish',coalesce((SELECT jsonb_agg(to_jsonb(f) ORDER BY f.created_at,f.id)
            FROM public.aquaculture_fish f WHERE f.pond_id=p.id AND f.status IN ('growing','ready')),'[]'::JSONB)
        ) ORDER BY p.slot_number)
        FROM public.aquaculture_ponds p JOIN public.aquaculture_pond_occupancy o ON o.pond_id=p.id WHERE p.user_id=u),'[]'::JSONB),
    'species',coalesce((SELECT jsonb_agg(to_jsonb(s)||jsonb_build_object('can_stock',EXISTS(
        SELECT 1 FROM public.caught_diary d WHERE d.user_id=u AND d.species_id=s.species_id
    )) ORDER BY s.species_id) FROM public.aquaculture_species_rules s WHERE s.enabled),'[]'::JSONB));
$$;

REVOKE ALL ON FUNCTION public.aquaculture_lock_user(),public.aquaculture_wallet_delta(UUID,BIGINT,BIGINT),
    public.aquaculture_previous_action(UUID,UUID,TEXT,JSONB),public.aquaculture_save_action(UUID,UUID,TEXT,JSONB,JSONB),
    public.aquaculture_fish_ids(UUID[]),public.aquaculture_refresh(UUID),public.aquaculture_close_empty_batches(UUID),
    public.aquaculture_farm_json(UUID) FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
