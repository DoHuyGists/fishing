-- Run after 20261112_feature_flags.sql. No cron/Realtime is needed.
BEGIN;

CREATE FUNCTION public.dispatch_valid_stats(v JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT jsonb_typeof(v)='object' AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(CASE WHEN jsonb_typeof(v)='object' THEN v ELSE '{}' END)
    WHERE jsonb_typeof(value)<>'number' OR NOT (value::TEXT ~ '^\d+(\.\d+)?$')
      OR CASE WHEN jsonb_typeof(value)='number' THEN value::TEXT::NUMERIC > 1000000 ELSE FALSE END
  );
$$;
CREATE FUNCTION public.dispatch_valid_rewards(v JSONB) RETURNS BOOLEAN
LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT public.dispatch_valid_stats(v) AND NOT EXISTS (
    SELECT 1 FROM jsonb_each(v) WHERE key NOT IN ('cash','shells','tickets')
      OR value::TEXT !~ '^\d+$'
  );
$$;

CREATE TABLE public.dispatch_npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]+$'),
  name JSONB NOT NULL CHECK (jsonb_typeof(name->'vi')='string' AND jsonb_typeof(name->'en')='string' AND coalesce(length(btrim(name->>'vi')),0)>0 AND coalesce(length(btrim(name->>'en')),0)>0),
  description JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(description)='object' AND (NOT description ? 'vi' OR jsonb_typeof(description->'vi')='string') AND (NOT description ? 'en' OR jsonb_typeof(description->'en')='string')),
  image_path TEXT NOT NULL DEFAULT '',
  purchase_shells BIGINT NOT NULL CHECK (purchase_shells BETWEEN 0 AND 1000000000),
  operating_cash BIGINT NOT NULL CHECK (operating_cash BETWEEN 0 AND 1000000000),
  data JSONB NOT NULL DEFAULT '{"stats":{}}' CHECK (jsonb_typeof(data)='object' AND public.dispatch_valid_stats(coalesce(data->'stats','{}'))),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.dispatch_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE CHECK (code ~ '^[a-z0-9_-]+$'),
  name JSONB NOT NULL CHECK (jsonb_typeof(name->'vi')='string' AND jsonb_typeof(name->'en')='string' AND coalesce(length(btrim(name->>'vi')),0)>0 AND coalesce(length(btrim(name->>'en')),0)>0),
  description JSONB NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(description)='object' AND (NOT description ? 'vi' OR jsonb_typeof(description->'vi')='string') AND (NOT description ? 'en' OR jsonb_typeof(description->'en')='string')),
  image_path TEXT NOT NULL DEFAULT '',
  duration_seconds INTEGER NOT NULL CHECK (duration_seconds BETWEEN 60 AND 2592000),
  data JSONB NOT NULL DEFAULT '{"requirements":{}}' CHECK (jsonb_typeof(data)='object' AND public.dispatch_valid_stats(coalesce(data->'requirements','{}'))),
  rewards JSONB NOT NULL CHECK (public.dispatch_valid_rewards(rewards)),
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE public.dispatch_owned_npcs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  npc_id UUID NOT NULL REFERENCES public.dispatch_npcs(id) ON DELETE RESTRICT,
  purchased_shells BIGINT NOT NULL CHECK (purchased_shells>=0),
  acquired_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id,npc_id), UNIQUE(id,user_id)
);
CREATE TABLE public.dispatch_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owned_npc_id UUID NOT NULL,
  job_id UUID NOT NULL REFERENCES public.dispatch_jobs(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running','claimed','cancelled')),
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ,
  operating_cash BIGINT NOT NULL CHECK (operating_cash>=0),
  npc_snapshot JSONB NOT NULL,
  job_snapshot JSONB NOT NULL,
  rewards JSONB NOT NULL CHECK (public.dispatch_valid_rewards(rewards)),
  FOREIGN KEY (owned_npc_id,user_id) REFERENCES public.dispatch_owned_npcs(id,user_id) ON DELETE CASCADE,
  CHECK (ends_at>started_at),
  CHECK ((status='running')=(resolved_at IS NULL)),
  CHECK (resolved_at IS NULL OR resolved_at>=started_at)
);
CREATE UNIQUE INDEX dispatch_one_run_per_npc ON public.dispatch_runs(owned_npc_id) WHERE status='running';
CREATE INDEX dispatch_runs_owner ON public.dispatch_runs(user_id,started_at DESC);
CREATE TABLE public.dispatch_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL UNIQUE REFERENCES public.dispatch_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  outcome TEXT NOT NULL CHECK (outcome IN ('claimed','cancelled')),
  rewards JSONB NOT NULL,
  operating_cash BIGINT NOT NULL,
  npc_snapshot JSONB NOT NULL,
  job_snapshot JSONB NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  resolved_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX dispatch_history_owner ON public.dispatch_history(user_id,resolved_at DESC,id DESC);
CREATE TABLE public.dispatch_actions (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID NOT NULL,
  input JSONB NOT NULL,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY(user_id,request_id)
);

CREATE FUNCTION public.dispatch_touch_catalog() RETURNS TRIGGER
LANGUAGE plpgsql SET search_path='' AS $$
BEGIN NEW.updated_at:=clock_timestamp(); RETURN NEW; END; $$;
CREATE TRIGGER dispatch_npc_updated BEFORE UPDATE ON public.dispatch_npcs FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_catalog();
CREATE TRIGGER dispatch_job_updated BEFORE UPDATE ON public.dispatch_jobs FOR EACH ROW EXECUTE FUNCTION public.dispatch_touch_catalog();

DO $$ DECLARE tab TEXT; BEGIN
  FOREACH tab IN ARRAY ARRAY['dispatch_npcs','dispatch_jobs','dispatch_owned_npcs','dispatch_runs','dispatch_history','dispatch_actions'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY',tab);
    EXECUTE format('REVOKE ALL ON public.%I FROM PUBLIC,anon,authenticated',tab);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated',tab);
    IF tab IN ('dispatch_npcs','dispatch_jobs') THEN
      EXECUTE format('CREATE POLICY dispatch_catalog_read ON public.%I FOR SELECT TO authenticated USING (enabled OR public.feature_flags_is_admin())',tab);
      EXECUTE format('GRANT INSERT,UPDATE,DELETE ON public.%I TO authenticated',tab);
      EXECUTE format('CREATE POLICY dispatch_catalog_admin ON public.%I FOR ALL TO authenticated USING (public.feature_flags_is_admin()) WITH CHECK (public.feature_flags_is_admin())',tab);
    ELSE
      EXECUTE format('CREATE POLICY dispatch_owner_read ON public.%I FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()))',tab);
    END IF;
  END LOOP;
END; $$;

-- Internal helper. Caller already holds the wallet/user lock; server copies all rules.
CREATE FUNCTION public.dispatch_start(u UUID,o UUID,j UUID,nv TIMESTAMPTZ,jv TIMESTAMPTZ) RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE n public.dispatch_npcs%ROWTYPE; job public.dispatch_jobs%ROWTYPE;
  run UUID; t TIMESTAMPTZ; k TEXT; required JSONB;
BEGIN
  SELECT n0.* INTO n FROM public.dispatch_owned_npcs owned JOIN public.dispatch_npcs n0 ON n0.id=owned.npc_id
    WHERE owned.id=o AND owned.user_id=u FOR SHARE OF n0;
  IF NOT FOUND OR NOT n.enabled THEN RAISE EXCEPTION 'DISPATCH_NPC_UNAVAILABLE'; END IF;
  IF EXISTS (SELECT 1 FROM public.dispatch_runs WHERE owned_npc_id=o AND status='running') THEN
    RAISE EXCEPTION 'DISPATCH_NPC_BUSY';
  END IF;
  SELECT * INTO job FROM public.dispatch_jobs WHERE id=j AND enabled FOR SHARE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPATCH_JOB_UNAVAILABLE'; END IF;
  IF n.updated_at IS DISTINCT FROM nv OR job.updated_at IS DISTINCT FROM jv THEN
    RAISE EXCEPTION 'DISPATCH_CATALOG_CHANGED';
  END IF;
  FOR k,required IN SELECT key,value FROM jsonb_each(coalesce(job.data->'requirements','{}')) LOOP
    IF coalesce((n.data->'stats'->>k)::NUMERIC,0)<required::TEXT::NUMERIC THEN
      RAISE EXCEPTION 'DISPATCH_REQUIREMENTS';
    END IF;
  END LOOP;
  UPDATE public.currency SET cash=cash-n.operating_cash WHERE user_id=u AND cash>=n.operating_cash;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPATCH_CASH'; END IF;
  t:=clock_timestamp();
  INSERT INTO public.dispatch_runs(user_id,owned_npc_id,job_id,started_at,ends_at,operating_cash,npc_snapshot,job_snapshot,rewards)
    VALUES(u,o,j,t,t+make_interval(secs=>job.duration_seconds),n.operating_cash,to_jsonb(n),to_jsonb(job),job.rewards)
    RETURNING id INTO run;
  RETURN run;
END; $$;

-- One idempotent transaction for purchases, starts, claims/repeats and cancellations.
-- No client timestamps, prices, stats or rewards are accepted.
CREATE FUNCTION public.dispatch_action(p_request_id UUID,p_kind TEXT,p_target_id UUID,p_job_id UUID DEFAULT NULL,
  p_npc_version TIMESTAMPTZ DEFAULT NULL,p_job_version TIMESTAMPTZ DEFAULT NULL) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=auth.uid(); w public.currency%ROWTYPE; n public.dispatch_npcs%ROWTYPE;
  r public.dispatch_runs%ROWTYPE; receipt public.dispatch_actions%ROWTYPE;
  args JSONB:=jsonb_build_object('kind',p_kind,'target',p_target_id,'job',p_job_id,'npc_version',p_npc_version,'job_version',p_job_version);
  result JSONB; new_id UUID; t TIMESTAMPTZ;
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'DISPATCH_AUTH' USING ERRCODE='42501'; END IF;
  IF NOT public.feature_is_enabled('dispatch') THEN RAISE EXCEPTION 'DISPATCH_DISABLED'; END IF;
  IF p_request_id IS NULL OR p_target_id IS NULL OR p_kind IS NULL OR p_kind NOT IN ('buy','start','claim','repeat','cancel') THEN
    RAISE EXCEPTION 'DISPATCH_INVALID';
  END IF;
  -- Same locking order as other gameplay systems: profile, then wallet, then feature rows.
  PERFORM 1 FROM public.user_profile WHERE id=u FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'DISPATCH_AUTH'; END IF;
  BEGIN
    SELECT * INTO STRICT w FROM public.currency WHERE user_id=u FOR UPDATE;
  EXCEPTION WHEN NO_DATA_FOUND OR TOO_MANY_ROWS THEN RAISE EXCEPTION 'DISPATCH_WALLET'; END;
  SELECT * INTO receipt FROM public.dispatch_actions WHERE user_id=u AND request_id=p_request_id;
  IF FOUND THEN
    IF receipt.input<>args THEN RAISE EXCEPTION 'DISPATCH_INVALID'; END IF;
    RETURN receipt.result;
  END IF;
  IF w.cash IS NULL OR w.shells IS NULL OR w.tickets IS NULL OR w.cash<0 OR w.shells<0 OR w.tickets<0
    OR w.cash::TEXT IN ('NaN','Infinity','-Infinity') OR w.shells::TEXT IN ('NaN','Infinity','-Infinity')
    OR w.tickets::TEXT IN ('NaN','Infinity','-Infinity') THEN RAISE EXCEPTION 'DISPATCH_WALLET'; END IF;
  IF p_kind='buy' THEN
    SELECT * INTO n FROM public.dispatch_npcs WHERE id=p_target_id AND enabled FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'DISPATCH_NPC_UNAVAILABLE'; END IF;
    IF n.updated_at IS DISTINCT FROM p_npc_version THEN RAISE EXCEPTION 'DISPATCH_CATALOG_CHANGED'; END IF;
    IF EXISTS (SELECT 1 FROM public.dispatch_owned_npcs WHERE user_id=u AND npc_id=n.id) THEN RAISE EXCEPTION 'DISPATCH_OWNED'; END IF;
    IF w.shells<n.purchase_shells THEN RAISE EXCEPTION 'DISPATCH_SHELLS'; END IF;
    UPDATE public.currency SET shells=shells-n.purchase_shells WHERE user_id=u;
    INSERT INTO public.dispatch_owned_npcs(user_id,npc_id,purchased_shells) VALUES(u,n.id,n.purchase_shells) RETURNING id INTO new_id;
  ELSIF p_kind='start' THEN
    new_id:=public.dispatch_start(u,p_target_id,p_job_id,p_npc_version,p_job_version);
  ELSE
    SELECT * INTO r FROM public.dispatch_runs WHERE id=p_target_id AND user_id=u FOR UPDATE;
    IF NOT FOUND OR r.status<>'running' THEN RAISE EXCEPTION 'DISPATCH_RUN_UNAVAILABLE'; END IF;
    t:=clock_timestamp();
    IF p_kind<>'cancel' AND t<r.ends_at THEN RAISE EXCEPTION 'DISPATCH_NOT_READY'; END IF;
    IF p_kind<>'cancel' THEN
      UPDATE public.currency SET cash=cash+coalesce((r.rewards->>'cash')::BIGINT,0),
        shells=shells+coalesce((r.rewards->>'shells')::BIGINT,0),tickets=tickets+coalesce((r.rewards->>'tickets')::BIGINT,0)
        WHERE user_id=u;
    END IF;
    UPDATE public.dispatch_runs SET status=CASE WHEN p_kind='cancel' THEN 'cancelled' ELSE 'claimed' END,resolved_at=t WHERE id=r.id;
    INSERT INTO public.dispatch_history(run_id,user_id,outcome,rewards,operating_cash,npc_snapshot,job_snapshot,started_at,ends_at,resolved_at)
      VALUES(r.id,u,CASE WHEN p_kind='cancel' THEN 'cancelled' ELSE 'claimed' END,
        CASE WHEN p_kind='cancel' THEN '{}'::JSONB ELSE r.rewards END,r.operating_cash,r.npc_snapshot,r.job_snapshot,r.started_at,r.ends_at,t);
    IF p_kind='repeat' THEN new_id:=public.dispatch_start(u,r.owned_npc_id,r.job_id,p_npc_version,p_job_version); END IF;
  END IF;
  result:=jsonb_build_object('id',new_id,'server_time',clock_timestamp());
  INSERT INTO public.dispatch_actions(user_id,request_id,input,result) VALUES(u,p_request_id,args,result);
  RETURN result;
END; $$;

CREATE FUNCTION public.get_dispatch_state() RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE u UUID:=auth.uid();
BEGIN
  IF u IS NULL THEN RAISE EXCEPTION 'DISPATCH_AUTH' USING ERRCODE='42501'; END IF;
  IF NOT public.feature_is_enabled('dispatch') THEN RAISE EXCEPTION 'DISPATCH_DISABLED'; END IF;
  RETURN jsonb_build_object('server_time',clock_timestamp(),
    'npcs',coalesce((SELECT jsonb_agg(to_jsonb(n) ORDER BY sort_order,code) FROM public.dispatch_npcs n
      WHERE enabled OR EXISTS(SELECT 1 FROM public.dispatch_owned_npcs o WHERE o.npc_id=n.id AND o.user_id=u)),'[]'::JSONB),
    'jobs',coalesce((SELECT jsonb_agg(to_jsonb(j) ORDER BY sort_order,code) FROM public.dispatch_jobs j WHERE enabled),'[]'::JSONB),
    'owned',coalesce((SELECT jsonb_agg(to_jsonb(o) ORDER BY acquired_at,id) FROM public.dispatch_owned_npcs o WHERE user_id=u),'[]'::JSONB),
    'runs',coalesce((SELECT jsonb_agg(to_jsonb(r) ORDER BY started_at,id) FROM public.dispatch_runs r WHERE user_id=u AND status='running'),'[]'::JSONB));
END; $$;

REVOKE ALL ON FUNCTION public.dispatch_start(UUID,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ),public.dispatch_touch_catalog() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.dispatch_action(UUID,TEXT,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ),public.get_dispatch_state() FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.dispatch_action(UUID,TEXT,UUID,UUID,TIMESTAMPTZ,TIMESTAMPTZ),public.get_dispatch_state() TO authenticated;

INSERT INTO public.feature_flags(feature_key) VALUES('dispatch') ON CONFLICT DO NOTHING;
INSERT INTO feature_control.request_rules(feature_key,path,writes_only) VALUES
  ('dispatch','rpc/get_dispatch_state',FALSE),('dispatch','rpc/dispatch_action',FALSE),
  ('dispatch','dispatch_npcs',FALSE),('dispatch','dispatch_jobs',FALSE),('dispatch','dispatch_owned_npcs',FALSE),
  ('dispatch','dispatch_runs',FALSE),('dispatch','dispatch_history',FALSE),('dispatch','dispatch_actions',FALSE)
ON CONFLICT DO NOTHING;
COMMIT;
