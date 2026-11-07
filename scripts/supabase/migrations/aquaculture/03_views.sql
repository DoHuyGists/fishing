-- No separate trophy collection. Historical records are views over actual farm fish.
BEGIN;
CREATE VIEW public.aquaculture_pond_occupancy WITH (security_invoker=TRUE) AS
SELECT p.id AS pond_id,p.user_id,p.slot_number,p.capacity,
    coalesce(sum(f.capacity) FILTER (WHERE f.status IN ('growing','ready')),0) AS used_capacity,
    p.capacity-1-coalesce(sum(f.capacity) FILTER (WHERE f.status IN ('growing','ready')),0) AS available_capacity
FROM public.aquaculture_ponds p LEFT JOIN public.aquaculture_fish f ON f.pond_id=p.id AND f.user_id=p.user_id
GROUP BY p.id;

CREATE VIEW public.aquaculture_records WITH (security_invoker=TRUE) AS
SELECT user_id,species_id,count(*) AS matured_fish,max(weight_kg) AS best_weight_kg,
    max(star_rating) AS best_star_rating,count(*) FILTER (WHERE is_super_special) AS super_special_fish
FROM public.aquaculture_fish WHERE matured_at IS NOT NULL GROUP BY user_id,species_id;
REVOKE ALL ON public.aquaculture_pond_occupancy,public.aquaculture_records FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.aquaculture_pond_occupancy,public.aquaculture_records TO authenticated,service_role;
COMMIT;
