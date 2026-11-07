BEGIN;
GRANT SELECT ON public.aquaculture_species_rules,public.aquaculture_species_foods,
    public.aquaculture_ponds,public.aquaculture_batches,public.aquaculture_fish,public.aquaculture_actions TO authenticated;
GRANT ALL ON public.aquaculture_species_rules,public.aquaculture_species_foods,
    public.aquaculture_ponds,public.aquaculture_batches,public.aquaculture_fish,public.aquaculture_actions TO service_role;
CREATE POLICY aquaculture_rules_read ON public.aquaculture_species_rules FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY aquaculture_foods_read ON public.aquaculture_species_foods FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY aquaculture_ponds_read ON public.aquaculture_ponds FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY aquaculture_batches_read ON public.aquaculture_batches FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY aquaculture_fish_read ON public.aquaculture_fish FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
CREATE POLICY aquaculture_actions_read ON public.aquaculture_actions FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()));
-- No direct player writes. All mutation RPCs validate auth.uid() and serialize on the profile.
COMMIT;
