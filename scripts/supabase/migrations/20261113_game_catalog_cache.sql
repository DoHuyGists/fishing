-- Apply AFTER feature flags and the existing game schemas/RPCs. No realtime.
-- Then deploy with VITE_GAME_CATALOG_VERSIONED=true. Legacy RPCs are retained
-- for rollout; old clients do not gain revision checks until upgraded.
BEGIN;
CREATE SCHEMA IF NOT EXISTS catalog_control;
REVOKE ALL ON SCHEMA catalog_control FROM PUBLIC, anon;
GRANT USAGE ON SCHEMA catalog_control TO authenticated;

CREATE TABLE IF NOT EXISTS public.game_catalog_versions (
  domain text PRIMARY KEY,
  revision bigint NOT NULL DEFAULT 1 CHECK (revision > 0)
);
ALTER TABLE public.game_catalog_versions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.game_catalog_versions FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.game_catalog_versions TO authenticated;
GRANT ALL ON public.game_catalog_versions TO service_role;
DROP POLICY IF EXISTS game_catalog_versions_read ON public.game_catalog_versions;
CREATE POLICY game_catalog_versions_read ON public.game_catalog_versions FOR SELECT TO authenticated USING (true);
INSERT INTO public.game_catalog_versions(domain) SELECT unnest(ARRAY[
  'countries','areas','species','guides','shop','items','blueprints','skills','aquaculture','rates'
]) ON CONFLICT DO NOTHING;

-- BEFORE STATEMENT locks revision rows before the catalog's data rows are
-- modified. Guarded actions hold shared revision locks through the transaction.
CREATE OR REPLACE FUNCTION catalog_control.bump_revision() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE d text;
BEGIN
  FOR d IN SELECT domain FROM public.game_catalog_versions WHERE domain=ANY(TG_ARGV) ORDER BY domain LOOP
    UPDATE public.game_catalog_versions SET revision=revision+1 WHERE domain=d;
  END LOOP;
  RETURN NULL;
END; $$;
REVOKE ALL ON FUNCTION catalog_control.bump_revision() FROM PUBLIC, anon, authenticated;
DO $$
DECLARE r record;
BEGIN
  IF to_regprocedure('public.feature_is_enabled(text)') IS NULL THEN
    RAISE EXCEPTION 'Apply 20261112_feature_flags.sql before the catalog cache migration';
  END IF;
  FOR r IN SELECT * FROM (VALUES
    ('countries', '''countries'''), ('fishing_areas', '''areas'''),
    ('species', '''species'',''aquaculture'''), ('guides', '''guides'''),
    ('items', '''items'',''shop'',''blueprints'',''aquaculture'''), ('blueprint', '''blueprints'''),
    ('skills', '''skills'''), ('aquaculture_species_rules', '''aquaculture'''),
    ('aquaculture_species_foods', '''aquaculture'''), ('currency_conversion_rates', '''rates''')
  ) AS bindings(table_name, domains) LOOP
    IF to_regclass('public.'||r.table_name) IS NULL THEN
      RAISE EXCEPTION 'Missing prerequisite catalog table public.%',r.table_name;
    END IF;
    EXECUTE format('DROP TRIGGER IF EXISTS game_catalog_revision ON public.%I',r.table_name);
    EXECUTE format('CREATE TRIGGER game_catalog_revision BEFORE INSERT OR UPDATE OR DELETE OR TRUNCATE ON public.%I FOR EACH STATEMENT EXECUTE FUNCTION catalog_control.bump_revision(%s)',r.table_name,r.domains);
  END LOOP;
END; $$;

CREATE OR REPLACE FUNCTION catalog_control.require_feature(k text) RETURNS void
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF k IS NOT NULL AND NOT public.feature_is_enabled(k) THEN
    RAISE EXCEPTION 'Feature disabled' USING ERRCODE='42501', DETAIL='FEATURE_DISABLED:'||k;
  END IF;
END; $$;
REVOKE ALL ON FUNCTION catalog_control.require_feature(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION catalog_control.require_feature(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_game_catalog_versions() RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER SET search_path='' AS $$
  SELECT coalesce(jsonb_object_agg(domain,revision::text),'{}'::jsonb) FROM public.game_catalog_versions;
$$;
REVOKE ALL ON FUNCTION public.get_game_catalog_versions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_catalog_versions() TO authenticated;

-- Rates deliberately have no direct SELECT grant. This narrow read preserves
-- that boundary and uses the enclosing STABLE snapshot, unlike the old RPC.
CREATE OR REPLACE FUNCTION catalog_control.read_rates() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM catalog_control.require_feature('redeem');
  RETURN (SELECT coalesce(jsonb_agg(jsonb_build_object('source_currency',source_currency,'target_currency',target_currency,
    'source_amount',source_amount,'target_amount',target_amount) ORDER BY source_currency,target_currency),'[]'::jsonb)
    FROM public.currency_conversion_rates WHERE is_active);
END; $$;
REVOKE ALL ON FUNCTION catalog_control.read_rates() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION catalog_control.read_rates() TO authenticated;

-- SECURITY INVOKER preserves SELECT grants and RLS on every catalog projection.
-- STABLE gives payload and revision one statement snapshot. Only display data
-- is returned; no user inventory, challenge, secret fishing stats, or admin '*'.
CREATE OR REPLACE FUNCTION public.get_game_catalog_snapshot(p_domain text,p_ids uuid[] DEFAULT '{}') RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path='' AS $$
DECLARE payload jsonb; rev text; feature text;
BEGIN
  feature:=CASE p_domain WHEN 'areas' THEN 'world-map' WHEN 'species' THEN 'diary' WHEN 'guides' THEN 'guide'
    WHEN 'shop' THEN 'shop' WHEN 'items' THEN 'work-bench' WHEN 'blueprints' THEN 'work-bench' WHEN 'skills' THEN 'skill' WHEN 'aquaculture' THEN 'aquaculture' WHEN 'rates' THEN 'redeem' END;
  PERFORM catalog_control.require_feature(feature);
  SELECT revision::text INTO rev FROM public.game_catalog_versions WHERE domain=p_domain;
  IF rev IS NULL THEN RAISE EXCEPTION 'Unknown catalog domain' USING ERRCODE='22023'; END IF;
  IF cardinality(p_ids)>1000 THEN RAISE EXCEPTION 'Too many item IDs' USING ERRCODE='22023'; END IF;
  CASE p_domain
    WHEN 'countries' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,name,code,information,created_at,updated_at,location FROM public.countries ORDER BY name,id) t;
    WHEN 'areas' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,country_id AS "countryId",title,location,scene_path AS "scenePath" FROM public.fishing_areas WHERE is_available ORDER BY id) t;
    WHEN 'species' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,created_at,information,location,status,name,image FROM public.species ORDER BY location,name,id) t;
    WHEN 'guides' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,title,content,sort_order FROM public.guides WHERE is_published ORDER BY sort_order,id) t;
    WHEN 'shop' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,category,classification,name,information,image,icon,quantity,price,rpc FROM public.items WHERE "isDisabled"=false ORDER BY classification,name,id) t;
    WHEN 'items' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,category,name,information,image,icon,price FROM public.items WHERE id=ANY(p_ids) ORDER BY id) t;
    WHEN 'blueprints' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,result_item_id AS "resultItemId",result_quantity AS "resultQuantity",required_materials AS "requiredMaterials",gold_cost AS "goldCost"
        FROM public.blueprint ORDER BY created_at,id) t;
    WHEN 'skills' THEN SELECT coalesce(jsonb_agg(to_jsonb(t)),'[]') INTO payload FROM
      (SELECT id,code,name,description,icon,max_level,effect_per_level,sort_order,is_disabled FROM public.skills WHERE is_disabled=false ORDER BY sort_order,name,id) t;
    WHEN 'aquaculture' THEN
      SELECT jsonb_build_object('species',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM
        (SELECT s.id,s.name,s.image FROM public.aquaculture_species_rules r JOIN public.species s ON s.id=r.species_id ORDER BY s.id) t),'[]'::jsonb),
        'foods',coalesce((SELECT jsonb_agg(to_jsonb(t)) FROM
        (SELECT f.species_id,f.item_id,f.enabled,f.capacity_units_per_item,f.quality_gain,
          CASE WHEN i.id IS NULL THEN NULL ELSE jsonb_build_object('id',i.id,'name',i.name,'isDisabled',i."isDisabled") END AS item
          FROM public.aquaculture_species_foods f LEFT JOIN public.items i ON i.id=f.item_id ORDER BY f.species_id,f.item_id) t),'[]'::jsonb)) INTO payload;
    WHEN 'rates' THEN payload:=catalog_control.read_rates();
  END CASE;
  IF jsonb_typeof(payload)='array' AND jsonb_array_length(payload)>10000 THEN
    RAISE EXCEPTION 'Catalog requires paginated protocol' USING ERRCODE='54000';
  END IF;
  RETURN jsonb_build_object('data',payload,'revision',rev);
END; $$;
REVOKE ALL ON FUNCTION public.get_game_catalog_snapshot(text,uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_game_catalog_snapshot(text,uuid[]) TO authenticated;

-- Narrow helper: authenticate/serialize the farm owner, then look up an existing
-- receipt before any revision check. Existing private helpers stay private.
CREATE OR REPLACE FUNCTION catalog_control.previous_farm_action(k text,a jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u uuid; kind text; payload jsonb;
BEGIN
  IF k NOT IN ('stock_aquaculture_batch','feed_aquaculture_batch') THEN RETURN NULL; END IF;
  PERFORM catalog_control.require_feature('aquaculture');
  u:=public.aquaculture_lock_user();
  IF k='stock_aquaculture_batch' THEN
    kind:='stock'; payload:=jsonb_build_object('pond_id',(a->>'p_pond_id')::uuid,'species_id',(a->>'p_species_id')::uuid,'quantity',(a->>'p_quantity')::integer,'mode',a->>'p_mode');
  ELSE
    kind:='feed'; payload:=jsonb_build_object('batch_id',(a->>'p_batch_id')::uuid,'inventory_id',(a->>'p_inventory_id')::uuid);
  END IF;
  RETURN public.aquaculture_previous_action(u,(a->>'p_request_id')::uuid,kind,payload);
END; $$;
REVOKE ALL ON FUNCTION catalog_control.previous_farm_action(text,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION catalog_control.previous_farm_action(text,jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION catalog_control.assert_revisions(domains text[],expected jsonb) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE r record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required' USING ERRCODE='42501'; END IF;
  IF (SELECT count(*) FROM public.game_catalog_versions WHERE domain=ANY(domains))<>cardinality(domains) THEN
    RAISE EXCEPTION 'Catalog revision configuration is incomplete' USING ERRCODE='55000';
  END IF;
  FOR r IN SELECT domain,revision::text AS revision FROM public.game_catalog_versions WHERE domain=ANY(domains) ORDER BY domain FOR SHARE LOOP
    IF expected->>r.domain IS DISTINCT FROM r.revision THEN
      RAISE EXCEPTION 'Catalog data changed' USING ERRCODE='P0001', DETAIL=jsonb_build_object('code','CATALOG_VERSION_MISMATCH','domains',domains,'revision',r.revision)::text;
    END IF;
  END LOOP;
END; $$;
REVOKE ALL ON FUNCTION catalog_control.assert_revisions(text[],jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION catalog_control.assert_revisions(text[],jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.execute_game_catalog_action(p_action text,p_args jsonb,p_expected jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE domains text[]; names text[]; feature text; old jsonb; result jsonb; fn oid; matches integer; expressions text; args jsonb;
BEGIN
  CASE p_action
    WHEN 'purchase_item' THEN domains:=ARRAY['shop']; names:=ARRAY['p_item_id','p_quantity']; feature:='shop';
    WHEN 'craft_blueprint' THEN domains:=ARRAY['blueprints']; names:=ARRAY['p_blueprint_id','p_quantity']; feature:='work-bench';
    WHEN 'upgrade_skill' THEN domains:=ARRAY['skills']; names:=ARRAY['p_skill_id']; feature:='skill';
    WHEN 'convert_currency' THEN domains:=ARRAY['rates']; names:=ARRAY['p_source_currency','p_target_currency','p_batches','p_source_amount','p_target_amount']; feature:='redeem';
    WHEN 'stock_aquaculture_batch' THEN domains:=ARRAY['aquaculture']; names:=ARRAY['p_pond_id','p_species_id','p_quantity','p_mode','p_request_id']; feature:='aquaculture';
    WHEN 'feed_aquaculture_batch' THEN domains:=ARRAY['aquaculture']; names:=ARRAY['p_batch_id','p_inventory_id','p_request_id']; feature:='aquaculture';
    ELSE RAISE EXCEPTION 'Unsupported catalog action' USING ERRCODE='22023';
  END CASE;
  PERFORM catalog_control.require_feature(feature);
  IF jsonb_typeof(p_args) IS DISTINCT FROM 'object' OR jsonb_typeof(p_expected) IS DISTINCT FROM 'object' THEN
    RAISE EXCEPTION 'Invalid catalog action parameters' USING ERRCODE='22023';
  END IF;
  args:=p_args-'_rules_snapshot';
  IF NOT (args ?& names) OR EXISTS(SELECT 1 FROM jsonb_object_keys(args) k WHERE NOT k=ANY(names)) THEN
    RAISE EXCEPTION 'Invalid catalog action arguments' USING ERRCODE='22023';
  END IF;
  old:=catalog_control.previous_farm_action(p_action,args);
  IF old IS NOT NULL THEN RETURN old; END IF;
  PERFORM catalog_control.assert_revisions(domains,p_expected);
  IF p_action='stock_aquaculture_batch' THEN
    -- The farm's price/capacity/rules projection is dynamic and never cached.
    -- Compare that exact quote too, not merely the display-catalog revision.
    IF p_args->'_rules_snapshot' IS DISTINCT FROM (SELECT to_jsonb(s) FROM public.aquaculture_species_rules s WHERE species_id=(args->>'p_species_id')::uuid) THEN
      RAISE EXCEPTION 'Farm rules changed' USING ERRCODE='P0001', DETAIL=jsonb_build_object('code','CATALOG_VERSION_MISMATCH','domains',domains)::text;
    END IF;
  END IF;
  -- Resolve the installed legacy signature by named parameters. Some original
  -- RPC definitions are managed outside this repo. No user-provided SQL/type or
  -- unrestricted function name can enter this statement.
  SELECT count(*),min(p.oid::bigint)::oid INTO matches,fn FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname='public' AND p.proname=p_action AND p.pronargs=cardinality(names)
      AND p.proargnames[1:p.pronargs] @> names AND NOT p.proretset;
  IF matches<>1 THEN RAISE EXCEPTION 'Install one unambiguous legacy RPC for % first',p_action USING ERRCODE='42883'; END IF;
  SELECT string_agg(format('%I := ($1 ->> %L)::%s',a.name,a.name,pg_catalog.format_type(a.typ,NULL)),',' ORDER BY a.ord)
    INTO expressions FROM pg_catalog.pg_proc p,
      unnest(p.proargnames,p.proargtypes::oid[]) WITH ORDINALITY AS a(name,typ,ord)
    WHERE p.oid=fn AND a.ord<=p.pronargs;
  EXECUTE format('SELECT to_jsonb(public.%I(%s))',p_action,expressions) INTO result USING args;
  RETURN result;
END; $$;
REVOKE ALL ON FUNCTION public.execute_game_catalog_action(text,jsonb,jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.execute_game_catalog_action(text,jsonb,jsonb) TO authenticated;
NOTIFY pgrst,'reload schema';
COMMIT;
