-- Additive migration for databases that already ran 01 -> 05.
-- Source configuration only: player ponds, batches, fish and receipts stay RPC-only.
BEGIN;
CREATE OR REPLACE FUNCTION public.aquaculture_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.user_profile p WHERE p.id=(SELECT auth.uid()) AND p.is_admin IS TRUE
    );
$$;
REVOKE ALL ON FUNCTION public.aquaculture_is_admin() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.aquaculture_is_admin() TO authenticated;

GRANT INSERT,UPDATE,DELETE ON public.aquaculture_species_rules,public.aquaculture_species_foods TO authenticated;
DROP POLICY IF EXISTS aquaculture_rules_admin_insert ON public.aquaculture_species_rules;
DROP POLICY IF EXISTS aquaculture_rules_admin_update ON public.aquaculture_species_rules;
DROP POLICY IF EXISTS aquaculture_rules_admin_delete ON public.aquaculture_species_rules;
CREATE POLICY aquaculture_rules_admin_insert ON public.aquaculture_species_rules FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.aquaculture_is_admin()));
CREATE POLICY aquaculture_rules_admin_update ON public.aquaculture_species_rules FOR UPDATE TO authenticated
    USING ((SELECT public.aquaculture_is_admin())) WITH CHECK ((SELECT public.aquaculture_is_admin()));
CREATE POLICY aquaculture_rules_admin_delete ON public.aquaculture_species_rules FOR DELETE TO authenticated
    USING ((SELECT public.aquaculture_is_admin()));

DROP POLICY IF EXISTS aquaculture_foods_admin_insert ON public.aquaculture_species_foods;
DROP POLICY IF EXISTS aquaculture_foods_admin_update ON public.aquaculture_species_foods;
DROP POLICY IF EXISTS aquaculture_foods_admin_delete ON public.aquaculture_species_foods;
CREATE POLICY aquaculture_foods_admin_insert ON public.aquaculture_species_foods FOR INSERT TO authenticated
    WITH CHECK ((SELECT public.aquaculture_is_admin()));
CREATE POLICY aquaculture_foods_admin_update ON public.aquaculture_species_foods FOR UPDATE TO authenticated
    USING ((SELECT public.aquaculture_is_admin())) WITH CHECK ((SELECT public.aquaculture_is_admin()));
CREATE POLICY aquaculture_foods_admin_delete ON public.aquaculture_species_foods FOR DELETE TO authenticated
    USING ((SELECT public.aquaculture_is_admin()));
COMMIT;
