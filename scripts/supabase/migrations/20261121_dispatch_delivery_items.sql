-- Run after 20261114_dispatch.sql. Requires items and user_inventory.
BEGIN;

CREATE FUNCTION public.dispatch_valid_delivery_items(v JSONB) RETURNS BOOLEAN
LANGUAGE plpgsql IMMUTABLE SET search_path='' AS $$
DECLARE entry JSONB;
BEGIN
  IF jsonb_typeof(v) IS DISTINCT FROM 'array' THEN RETURN FALSE; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(v) LOOP
    IF jsonb_typeof(entry) IS DISTINCT FROM 'object'
      OR jsonb_typeof(entry->'item_id') IS DISTINCT FROM 'string'
      OR coalesce(entry->>'item_id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      OR jsonb_typeof(entry->'quantity') IS DISTINCT FROM 'number'
      OR coalesce(entry->>'quantity','') !~ '^[0-9]+$' THEN RETURN FALSE;
    END IF;
    IF (entry->>'quantity')::NUMERIC NOT BETWEEN 1 AND 1000000 THEN RETURN FALSE; END IF;
  END LOOP;
  RETURN TRUE;
END; $$;

ALTER TABLE public.dispatch_jobs ADD CONSTRAINT dispatch_jobs_delivery_items_valid
  CHECK (public.dispatch_valid_delivery_items(coalesce(data->'delivery_items','[]'::JSONB)));

-- Runs inside dispatch_action's transaction, under its profile/wallet locks.
-- Using the run snapshot preserves the promised quantities across catalog edits.
CREATE FUNCTION public.dispatch_deliver_items() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE entry JSONB; item public.items%ROWTYPE; inventory_id public.user_inventory.id%TYPE;
  quantity BIGINT; payload JSONB; deliveries JSONB;
BEGIN
  deliveries:=coalesce(OLD.job_snapshot->'data'->'delivery_items','[]'::JSONB);
  IF NOT public.dispatch_valid_delivery_items(deliveries) THEN RAISE EXCEPTION 'DISPATCH_INVALID'; END IF;
  FOR entry IN SELECT value FROM jsonb_array_elements(deliveries) LOOP
    SELECT * INTO item FROM public.items WHERE id=(entry->>'item_id')::UUID FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DISPATCH_INVALID'; END IF;
    -- quantity is the exact item count, independent of the shop bundle size.
    quantity:=(entry->>'quantity')::BIGINT;
    payload:=coalesce(item.data,'{}'::JSONB) || jsonb_build_object(
      'id',item.id,'name',item.name,'image',item.image,'icon',item.icon,
      'category',item.category,'quantity',quantity,'information',item.information,
      'classification',item.classification);
    inventory_id:=NULL;
    IF item.storage_type='stack' THEN
      SELECT id INTO inventory_id FROM public.user_inventory
        WHERE user_id=OLD.user_id AND data->>'id'=item.id::TEXT ORDER BY id LIMIT 1 FOR UPDATE;
    END IF;
    IF inventory_id IS NULL THEN
      INSERT INTO public.user_inventory(user_id,rpc,data) VALUES(OLD.user_id,item.rpc,payload);
    ELSE
      UPDATE public.user_inventory SET data=jsonb_set(data,'{quantity}',
        to_jsonb(coalesce((data->>'quantity')::BIGINT,0)+quantity)) WHERE id=inventory_id;
    END IF;
  END LOOP;
  RETURN NEW;
END; $$;

CREATE TRIGGER dispatch_deliver_items_on_claim BEFORE UPDATE OF status ON public.dispatch_runs
  FOR EACH ROW WHEN (OLD.status='running' AND NEW.status='claimed')
  EXECUTE FUNCTION public.dispatch_deliver_items();

REVOKE ALL ON FUNCTION public.dispatch_deliver_items() FROM PUBLIC,anon,authenticated;
COMMIT;
