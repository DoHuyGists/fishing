-- Apply after 20261113_game_catalog_cache.sql. Test data needs no backfill.
BEGIN;

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
      (SELECT id,created_at,information,location,rarity,name,image FROM public.species ORDER BY location,name,id) t;
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

ALTER TABLE public.species DROP COLUMN IF EXISTS status;
UPDATE public.game_catalog_versions SET revision = revision + 1 WHERE domain = 'species';

NOTIFY pgrst, 'reload schema';
COMMIT;

