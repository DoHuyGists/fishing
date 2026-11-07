-- REVIEW DRAFT, replaces earlier unapplied drafts. Run 01 -> 05; 06 is optional mock data.
-- Existing tables: auth.users, user_profile, currency, species, caught_diary,
-- caught, items, user_inventory. No SQL is executed remotely by creating this file.
BEGIN;

ALTER TABLE public.user_profile ADD COLUMN pond_slot SMALLINT NOT NULL DEFAULT 1
    CONSTRAINT user_profile_pond_slot_range CHECK (pond_slot BETWEEN 1 AND 5);
COMMENT ON COLUMN public.user_profile.pond_slot IS 'Một suất ao đầu miễn phí; mỗi suất tiếp theo giá 300 shells, tối đa 5.';

CREATE TABLE public.aquaculture_species_rules (
    species_id UUID PRIMARY KEY REFERENCES public.species(id) ON DELETE RESTRICT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    rules_version INTEGER NOT NULL DEFAULT 1 CHECK (rules_version > 0),
    capacity_per_fish INTEGER NOT NULL CHECK (capacity_per_fish BETWEEN 1 AND 99),
    -- Per-species market balance. No inferred fishing timer or food speed-up.
    grow_seconds INTEGER NOT NULL CHECK (grow_seconds > 60),
    seed_cash BIGINT NOT NULL CHECK (seed_cash >= 0),
    seed_weight_kg NUMERIC(12,4) NOT NULL CHECK (seed_weight_kg > 0 AND seed_weight_kg < 'Infinity'::NUMERIC),
    adult_weight_kg NUMERIC(12,4) NOT NULL CHECK (adult_weight_kg > seed_weight_kg AND adult_weight_kg < 'Infinity'::NUMERIC),
    sale_cash_per_kg NUMERIC(12,2) NOT NULL CHECK (sale_cash_per_kg >= 0 AND sale_cash_per_kg < 'Infinity'::NUMERIC),
    rare_chance NUMERIC(7,6) NOT NULL DEFAULT 0.01 CHECK (rare_chance BETWEEN 0 AND 1),
    advanced_rare_bonus NUMERIC(7,6) NOT NULL DEFAULT 0.02 CHECK (advanced_rare_bonus BETWEEN 0 AND 1),
    rare_weight_multiplier NUMERIC(5,2) NOT NULL DEFAULT 1.5 CHECK (rare_weight_multiplier BETWEEN 1 AND 10),
    feed_cooldown_seconds INTEGER NOT NULL DEFAULT 3600 CHECK (feed_cooldown_seconds >= 1800),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (rare_chance + advanced_rare_bonus <= 1)
);

CREATE TABLE public.aquaculture_species_foods (
    species_id UUID NOT NULL REFERENCES public.aquaculture_species_rules(species_id) ON DELETE RESTRICT,
    item_id UUID NOT NULL REFERENCES public.items(id) ON DELETE RESTRICT,
    enabled BOOLEAN NOT NULL DEFAULT FALSE,
    capacity_units_per_item INTEGER NOT NULL CHECK (capacity_units_per_item > 0),
    quality_gain NUMERIC(4,3) NOT NULL CHECK (quality_gain > 0 AND quality_gain <= 1),
    PRIMARY KEY (species_id, item_id)
);
CREATE INDEX aquaculture_foods_item ON public.aquaculture_species_foods(item_id);

CREATE TABLE public.aquaculture_ponds (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    slot_number SMALLINT NOT NULL CHECK (slot_number BETWEEN 1 AND 5),
    name TEXT NOT NULL DEFAULT 'Ao cá' CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
    capacity INTEGER NOT NULL DEFAULT 100 CHECK (capacity >= 100),
    level INTEGER NOT NULL DEFAULT 1 CHECK (level > 0),
    care_available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, slot_number),
    UNIQUE (id, user_id)
);

CREATE TABLE public.aquaculture_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pond_id UUID NOT NULL,
    user_id UUID NOT NULL,
    species_id UUID NOT NULL REFERENCES public.aquaculture_species_rules(species_id) ON DELETE RESTRICT,
    mode TEXT NOT NULL CHECK (mode IN ('simple', 'advanced')),
    status TEXT NOT NULL DEFAULT 'growing' CHECK (status IN ('growing','ready','closed')),
    initial_fish_count INTEGER NOT NULL CHECK (initial_fish_count BETWEEN 1 AND 10000),
    quality_score NUMERIC(4,3) NOT NULL DEFAULT 0 CHECK (quality_score BETWEEN 0 AND 1),
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ready_at TIMESTAMPTZ NOT NULL,
    closed_at TIMESTAMPTZ,
    feed_available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Immutable server-generated snapshot, including prices and rarity chances.
    rules_snapshot JSONB NOT NULL CHECK (jsonb_typeof(rules_snapshot) = 'object'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (pond_id,user_id) REFERENCES public.aquaculture_ponds(id,user_id) ON DELETE CASCADE,
    UNIQUE (id,pond_id,user_id,species_id),
    CHECK (ready_at > started_at + INTERVAL '60 seconds'),
    CHECK ((status = 'closed') = (closed_at IS NOT NULL)),
    CHECK (closed_at IS NULL OR closed_at >= started_at)
);
-- Multiple active batches, including different species, may share one pond.
CREATE INDEX aquaculture_batches_active ON public.aquaculture_batches(user_id,ready_at) WHERE status = 'growing';
CREATE INDEX aquaculture_batches_pond ON public.aquaculture_batches(pond_id,created_at DESC);
CREATE INDEX aquaculture_batches_species ON public.aquaculture_batches(species_id);

CREATE TABLE public.aquaculture_fish (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL,
    pond_id UUID NOT NULL,
    user_id UUID NOT NULL,
    species_id UUID NOT NULL,
    capacity INTEGER NOT NULL CHECK (capacity BETWEEN 1 AND 99),
    status TEXT NOT NULL DEFAULT 'growing' CHECK (status IN ('growing','ready','sold','transferred','released')),
    weight_kg NUMERIC(12,4) NOT NULL CHECK (weight_kg > 0 AND weight_kg < 'Infinity'::NUMERIC),
    star_rating SMALLINT NOT NULL DEFAULT 1 CHECK (star_rating BETWEEN 1 AND 5),
    variant_type TEXT NOT NULL DEFAULT 'NORMAL' CHECK (variant_type IN ('NORMAL','GOLDEN','MUTATED')),
    is_shiny BOOLEAN NOT NULL DEFAULT FALSE,
    is_super_special BOOLEAN NOT NULL DEFAULT FALSE,
    matured_at TIMESTAMPTZ,
    exited_at TIMESTAMPTZ,
    -- Immutable original destination ID, deliberately no FK: deleting/trading a
    -- caught row must not erase provenance or restore a fish to the pond.
    caught_id UUID UNIQUE,
    cash_earned BIGINT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    FOREIGN KEY (batch_id,pond_id,user_id,species_id)
        REFERENCES public.aquaculture_batches(id,pond_id,user_id,species_id) ON DELETE CASCADE,
    CHECK ((status IN ('sold','transferred','released')) = (exited_at IS NOT NULL)),
    CHECK ((status = 'transferred') = (caught_id IS NOT NULL)),
    CHECK ((status = 'sold') = (cash_earned IS NOT NULL)),
    CHECK (cash_earned IS NULL OR cash_earned >= 0),
    CHECK (status NOT IN ('ready','sold','transferred') OR matured_at IS NOT NULL),
    CHECK (NOT is_super_special OR is_shiny)
);
CREATE INDEX aquaculture_fish_active ON public.aquaculture_fish(pond_id,status) WHERE status IN ('growing','ready');
CREATE INDEX aquaculture_fish_owner ON public.aquaculture_fish(user_id,batch_id);
CREATE INDEX aquaculture_fish_species ON public.aquaculture_fish(species_id);

-- One action receipt for each mutation. Stores exact input/result for retries,
-- wallet/food receipts, and mappings of farm IDs to newly created caught IDs.
CREATE TABLE public.aquaculture_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('buy_slot','stock','feed','care','sell','transfer','release')),
    input JSONB NOT NULL,
    result JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id,request_id)
);
CREATE INDEX aquaculture_actions_history ON public.aquaculture_actions(user_id,created_at DESC);

COMMENT ON TABLE public.aquaculture_fish IS 'Từng cá trong ao có ID riêng; cá siêu đặc biệt sáng loáng vẫn ở ao, không có kho trưng bày riêng.';
COMMENT ON TABLE public.aquaculture_batches IS 'Nhiều lứa một loài có thể cùng ao; chế độ đơn giản hoặc thử thách, tăng trưởng offline không mất cá.';
COMMENT ON TABLE public.aquaculture_actions IS 'Biên nhận nguyên tử và chống lặp yêu cầu cho các RPC nuôi cá.';

-- Lock existing and future ponds to the authoritative profile limit.
CREATE FUNCTION public.aquaculture_guard_profile_slots() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF current_user IN ('anon','authenticated') AND NEW.pond_slot <> 1 THEN
            RAISE EXCEPTION 'Use purchase_pond_slot' USING ERRCODE = '42501';
        END IF;
    ELSIF NEW.pond_slot IS DISTINCT FROM OLD.pond_slot THEN
        IF current_user IN ('anon','authenticated') THEN
            RAISE EXCEPTION 'Use purchase_pond_slot' USING ERRCODE = '42501';
        END IF;
        IF NEW.pond_slot < OLD.pond_slot AND EXISTS (
            SELECT 1 FROM public.aquaculture_ponds p WHERE p.user_id=NEW.id AND p.slot_number>NEW.pond_slot
        ) THEN RAISE EXCEPTION 'Slot contains an existing pond'; END IF;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER aquaculture_profile_slots BEFORE INSERT OR UPDATE OF pond_slot ON public.user_profile
    FOR EACH ROW EXECUTE FUNCTION public.aquaculture_guard_profile_slots();

CREATE FUNCTION public.aquaculture_guard_pond() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_limit INTEGER; v_used BIGINT;
BEGIN
    SELECT pond_slot INTO v_limit FROM public.user_profile WHERE id=NEW.user_id FOR UPDATE;
    IF NOT FOUND OR NEW.slot_number>v_limit THEN RAISE EXCEPTION 'Pond slot not unlocked'; END IF;
    IF TG_OP='UPDATE' THEN
        IF NEW.user_id<>OLD.user_id OR NEW.slot_number<>OLD.slot_number THEN
            RAISE EXCEPTION 'Pond owner and slot are immutable';
        END IF;
        SELECT coalesce(sum(capacity),0) INTO v_used FROM public.aquaculture_fish
        WHERE pond_id=NEW.id AND status IN ('growing','ready');
        IF v_used>=NEW.capacity THEN RAISE EXCEPTION 'Capacity must exceed occupied units'; END IF;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER aquaculture_pond_limit BEFORE INSERT OR UPDATE ON public.aquaculture_ponds
    FOR EACH ROW EXECUTE FUNCTION public.aquaculture_guard_pond();

-- Defense in depth for strict SUM(capacity) < pond.capacity, not <=.
CREATE FUNCTION public.aquaculture_guard_fish_capacity() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_limit INTEGER; v_used BIGINT; v_owner UUID;
BEGIN
    SELECT user_id INTO v_owner FROM public.aquaculture_ponds WHERE id=NEW.pond_id;
    PERFORM 1 FROM public.user_profile WHERE id=v_owner FOR UPDATE;
    SELECT capacity INTO v_limit FROM public.aquaculture_ponds WHERE id=NEW.pond_id FOR UPDATE;
    IF TG_OP='UPDATE' AND (NEW.pond_id<>OLD.pond_id OR NEW.batch_id<>OLD.batch_id OR NEW.user_id<>OLD.user_id OR NEW.capacity<>OLD.capacity) THEN
        RAISE EXCEPTION 'Fish location and capacity are immutable';
    END IF;
    IF NEW.status IN ('growing','ready') THEN
        SELECT coalesce(sum(capacity),0) INTO v_used FROM public.aquaculture_fish
        WHERE pond_id=NEW.pond_id AND status IN ('growing','ready') AND id<>NEW.id;
        IF v_used+NEW.capacity>=v_limit THEN RAISE EXCEPTION 'Pond capacity exceeded'; END IF;
    END IF;
    RETURN NEW;
END; $$;
CREATE TRIGGER aquaculture_fish_capacity BEFORE INSERT OR UPDATE ON public.aquaculture_fish
    FOR EACH ROW EXECUTE FUNCTION public.aquaculture_guard_fish_capacity();

DO $$ DECLARE t TEXT; BEGIN
    FOREACH t IN ARRAY ARRAY['aquaculture_species_rules','aquaculture_species_foods','aquaculture_ponds',
        'aquaculture_batches','aquaculture_fish','aquaculture_actions'] LOOP
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',t);
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC,anon,authenticated',t);
    END LOOP;
END; $$;
REVOKE ALL ON FUNCTION public.aquaculture_guard_profile_slots(),public.aquaculture_guard_pond(),
    public.aquaculture_guard_fish_capacity() FROM PUBLIC,anon,authenticated,service_role;
COMMIT;
