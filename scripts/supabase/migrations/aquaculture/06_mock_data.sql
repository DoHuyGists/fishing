-- OPTIONAL MOCK ONLY. No user currency, inventory or caught_diary is granted.
-- Resolves existing Carp/Pangasius/Snakehead species. Edit matching below if your
-- database names/images differ. Any missing/ambiguous species rolls back this file.
-- Existing species rules/items are preserved on conflict; no price reset on rerun.
BEGIN;
INSERT INTO public.items(id,name,information,category,classification,quantity,price,"isDisabled",rpc,image,icon)
VALUES
    ('a9000000-0000-4000-8000-000000000001','[MOCK] Cám viên cơ bản','Khẩu phần chăm cá thử nghiệm; không bắt buộc để cá sống hoặc lớn.','aquaculture_food','common',1,20,FALSE,NULL,NULL,NULL),
    ('a9000000-0000-4000-8000-000000000002','[MOCK] Cám thực vật','Khẩu phần mẫu phù hợp cá chép và cá tra.','aquaculture_food','common',1,15,FALSE,NULL,NULL,NULL),
    ('a9000000-0000-4000-8000-000000000003','[MOCK] Cám giàu đạm','Khẩu phần mẫu tăng chất lượng, phù hợp cá tra và cá lóc.','aquaculture_food','common',1,40,FALSE,NULL,NULL,NULL)
ON CONFLICT(id) DO NOTHING;

DO $$
DECLARE sample RECORD; ids UUID[]; species UUID;
BEGIN
    FOR sample IN SELECT * FROM (VALUES
        ('Carp.png','Cá chép',5,21600,100,0.05,1.2,150),
        ('Pangasius.png','Cá tra',3,28800,80,0.06,1.8,90),
        ('Mottled Snakehead.png','Cá lóc',8,43200,200,0.08,2.5,140)
    ) AS x(image_name,species_name,capacity,grow_seconds,seed_cash,seed_weight,adult_weight,sale_price) LOOP
        SELECT array_agg(s.id) INTO ids FROM public.species s
        WHERE s.image LIKE '%/'||sample.image_name OR lower(s.name)=lower(sample.species_name);
        IF coalesce(cardinality(ids),0)<>1 THEN
            RAISE EXCEPTION 'Mock species %: expected exactly one species matching name/image; edit seed mapping to your actual species IDs',sample.species_name;
        END IF;
        species:=ids[1];
        INSERT INTO public.aquaculture_species_rules(species_id,enabled,capacity_per_fish,grow_seconds,seed_cash,seed_weight_kg,adult_weight_kg,sale_cash_per_kg)
        VALUES(species,TRUE,sample.capacity,sample.grow_seconds,sample.seed_cash,sample.seed_weight,sample.adult_weight,sample.sale_price)
        ON CONFLICT(species_id) DO NOTHING;
        INSERT INTO public.aquaculture_species_foods(species_id,item_id,enabled,capacity_units_per_item,quality_gain)
        VALUES(species,'a9000000-0000-4000-8000-000000000001',TRUE,20,0.08)
        ON CONFLICT DO NOTHING;
        IF sample.species_name IN ('Cá chép','Cá tra') THEN
            INSERT INTO public.aquaculture_species_foods VALUES(species,'a9000000-0000-4000-8000-000000000002',TRUE,25,0.06)
            ON CONFLICT DO NOTHING;
        END IF;
        IF sample.species_name IN ('Cá tra','Cá lóc') THEN
            INSERT INTO public.aquaculture_species_foods VALUES(species,'a9000000-0000-4000-8000-000000000003',TRUE,12,0.15)
            ON CONFLICT DO NOTHING;
        END IF;
    END LOOP;
END; $$;
COMMIT;
