-- Apply after 20261112_feature_flags.sql. Includes an immutable published sample.
BEGIN;

CREATE TABLE public.story_scripts (
  id UUID PRIMARY KEY,
  draft JSONB NOT NULL,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision > 0),
  published_version INTEGER,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);
CREATE TABLE public.story_releases (
  story_id UUID NOT NULL REFERENCES public.story_scripts(id) ON DELETE CASCADE,
  version INTEGER NOT NULL CHECK (version > 0),
  script JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(story_id,version)
);
CREATE TABLE public.story_progress (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  story_id UUID NOT NULL,
  version INTEGER NOT NULL,
  node_id TEXT NOT NULL,
  history JSONB NOT NULL DEFAULT '[]',
  completed BOOLEAN NOT NULL DEFAULT FALSE,
  skipped BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  PRIMARY KEY(user_id,story_id,version),
  FOREIGN KEY(story_id,version) REFERENCES public.story_releases(story_id,version) ON DELETE CASCADE
);
ALTER TABLE public.story_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_releases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.story_progress ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.story_scripts,public.story_releases,public.story_progress FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.story_scripts,public.story_releases,public.story_progress TO authenticated;
GRANT ALL ON public.story_scripts,public.story_releases,public.story_progress TO service_role;
CREATE POLICY story_draft_admin ON public.story_scripts FOR SELECT TO authenticated USING ((SELECT public.feature_flags_is_admin()));
CREATE POLICY story_release_admin ON public.story_releases FOR SELECT TO authenticated USING ((SELECT public.feature_flags_is_admin()));
CREATE POLICY story_progress_owner ON public.story_progress FOR SELECT TO authenticated USING (user_id=(SELECT auth.uid()) AND public.feature_is_enabled('story'));

CREATE FUNCTION public.story_text_valid(v JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce(jsonb_typeof(v)='object' AND jsonb_typeof(v->'vi')='string' AND jsonb_typeof(v->'en')='string'
    AND length(v->>'vi')<=20000 AND length(v->>'en')<=20000,FALSE);
$$;
CREATE FUNCTION public.story_url_valid(v JSONB) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE SET search_path='' AS $$
  SELECT coalesce(jsonb_typeof(v)='string' AND ((v#>>'{}')='' OR (v#>>'{}') ~ '^/[^/[:space:]\\][^[:space:]\\]*$'
    OR (v#>>'{}') ~* '^https://[^[:space:]\\]+$' OR (v#>>'{}') ~ '^builtin:(dawn|night|storm|signal|impact)$'),FALSE);
$$;
CREATE FUNCTION public.story_validate(p JSONB) RETURNS VOID LANGUAGE plpgsql SET search_path='' AS $$
DECLARE n JSONB; c JSONB; a JSONB; edge TEXT; ids TEXT[]; actors TEXT[]; seen TEXT[]; slots TEXT[]; choices TEXT[];
  uuid_pattern TEXT := '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
BEGIN
  IF jsonb_typeof(p) IS DISTINCT FROM 'object' OR octet_length(p::TEXT)>2000000
    OR p->'schemaVersion' IS DISTINCT FROM '1'::JSONB OR NOT coalesce(p->>'id' ~ uuid_pattern,FALSE)
    OR NOT public.story_text_valid(p->'title') OR NOT public.story_text_valid(p->'summary')
    OR btrim(p->'title'->>'vi')='' OR btrim(p->'title'->>'en')='' THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: header'; END IF;
  IF jsonb_typeof(p->'nodes') IS DISTINCT FROM 'array' OR jsonb_typeof(p->'characters') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: arrays'; END IF;
  IF jsonb_array_length(p->'nodes') NOT BETWEEN 1 AND 1000 OR jsonb_array_length(p->'characters')>100 THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: size'; END IF;
  actors:='{}'; ids:='{}';
  FOR c IN SELECT value FROM jsonb_array_elements(p->'characters') LOOP
    IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR jsonb_typeof(c->'id') IS DISTINCT FROM 'string'
      OR coalesce(c->>'id','')='' OR (c->>'id')=ANY(actors) OR NOT public.story_text_valid(c->'name')
      OR jsonb_typeof(c->'expressions') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: character'; END IF;
    IF NOT public.story_url_valid(c->'expressions'->'normal') THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: normal image'; END IF;
    FOR edge,a IN SELECT key,value FROM jsonb_each(c->'expressions') LOOP
      IF edge NOT IN ('normal','happy','angry','shocked','sad') OR NOT public.story_url_valid(a) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: expression'; END IF;
    END LOOP;
    actors:=array_append(actors,c->>'id');
  END LOOP;
  FOR n IN SELECT value FROM jsonb_array_elements(p->'nodes') LOOP
    IF jsonb_typeof(n) IS DISTINCT FROM 'object' OR NOT coalesce(n->>'id' ~ uuid_pattern,FALSE) OR (n->>'id')=ANY(ids)
      OR NOT public.story_text_valid(n->'dialogue') THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: node'; END IF;
    ids:=array_append(ids,n->>'id');
    IF n->'speaker' IS DISTINCT FROM 'null'::JSONB THEN
      IF jsonb_typeof(n->'speaker') IS DISTINCT FROM 'object' OR NOT coalesce((n->'speaker'->>'id')=ANY(actors),FALSE)
        OR NOT public.story_text_valid(n->'speaker'->'name') OR (n->'speaker' ? 'title' AND NOT public.story_text_valid(n->'speaker'->'title')) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: speaker'; END IF;
    END IF;
    IF jsonb_typeof(n->'background') IS DISTINCT FROM 'object' OR NOT public.story_url_valid(n->'background'->'url')
      OR NOT coalesce(n->'background'->>'transition' IN ('none','fade','flash'),FALSE)
      OR NOT coalesce(n->>'vfx' IN ('none','screen-shake','flash-white','flash-red','vignette-pulse'),FALSE)
      OR jsonb_typeof(n->'audio') IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: background/audio/vfx'; END IF;
    FOR edge,a IN SELECT key,value FROM jsonb_each(n->'audio') LOOP
      IF edge NOT IN ('bgm','sfx','voice') OR NOT public.story_url_valid(a) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: audio'; END IF;
    END LOOP;
    IF jsonb_typeof(n->'characters') IS DISTINCT FROM 'array' OR jsonb_typeof(n->'choices') IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: node arrays'; END IF;
    IF jsonb_array_length(n->'characters')>3 OR jsonb_array_length(n->'choices')>8 THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: node size'; END IF;
    slots:='{}'; seen:='{}'; choices:='{}';
    FOR c IN SELECT value FROM jsonb_array_elements(n->'characters') LOOP
      IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT coalesce((c->>'characterId')=ANY(actors),FALSE)
        OR (c->>'characterId')=ANY(seen) OR NOT coalesce(c->>'position' IN ('left','center','right'),FALSE) OR (c->>'position')=ANY(slots)
        OR NOT coalesce(c->>'expression' IN ('normal','happy','angry','shocked','sad'),FALSE)
        OR NOT coalesce(c->>'animation' IN ('none','bounce','shake','slide-in','fade-out'),FALSE)
        OR jsonb_typeof(c->'isSpeaking') IS DISTINCT FROM 'boolean' THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: slot'; END IF;
      seen:=array_append(seen,c->>'characterId'); slots:=array_append(slots,c->>'position');
    END LOOP;
    IF n->'nextNodeId' IS DISTINCT FROM 'null'::JSONB AND NOT coalesce(n->>'nextNodeId' ~ uuid_pattern,FALSE) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: next'; END IF;
    FOR c IN SELECT value FROM jsonb_array_elements(n->'choices') LOOP
      IF jsonb_typeof(c) IS DISTINCT FROM 'object' OR NOT coalesce(c->>'id' ~ uuid_pattern,FALSE) OR (c->>'id')=ANY(choices)
        OR NOT public.story_text_valid(c->'text') OR coalesce(btrim(c->'text'->>'vi'),'')='' OR coalesce(btrim(c->'text'->>'en'),'')=''
        OR NOT coalesce(c->>'nextNodeId' ~ uuid_pattern,FALSE) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: choice'; END IF;
      choices:=array_append(choices,c->>'id');
    END LOOP;
  END LOOP;
  IF NOT coalesce((p->>'startNodeId')=ANY(ids),FALSE) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: start'; END IF;
  FOR n IN SELECT value FROM jsonb_array_elements(p->'nodes') LOOP
    FOR edge IN SELECT n->>'nextNodeId' UNION ALL SELECT value->>'nextNodeId' FROM jsonb_array_elements(n->'choices') LOOP
      IF edge IS NOT NULL AND NOT edge=ANY(ids) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: dangling edge'; END IF;
    END LOOP;
  END LOOP;
  IF EXISTS (
    WITH RECURSIVE nodes AS (SELECT value AS payload FROM jsonb_array_elements(p->'nodes')),
    edges AS (SELECT payload->>'id' AS source,payload->>'nextNodeId' AS target FROM nodes WHERE jsonb_array_length(payload->'choices')=0 AND payload->>'nextNodeId' IS NOT NULL
      UNION SELECT payload->>'id',choice->>'nextNodeId' FROM nodes CROSS JOIN LATERAL jsonb_array_elements(payload->'choices') choice),
    reachable(id) AS (SELECT p->>'startNodeId' UNION SELECT e.target FROM reachable r JOIN edges e ON e.source=r.id),
    terminates(id) AS (SELECT payload->>'id' FROM nodes WHERE jsonb_array_length(payload->'choices')=0 AND payload->'nextNodeId'='null'::JSONB
      UNION SELECT e.source FROM terminates t JOIN edges e ON e.target=t.id)
    SELECT 1 FROM reachable WHERE id NOT IN (SELECT id FROM terminates)
  ) THEN RAISE EXCEPTION 'STORY_INVALID_SCHEMA: branch without ending'; END IF;
END; $$;

CREATE FUNCTION public.story_require_admin() RETURNS VOID LANGUAGE plpgsql SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT coalesce(public.feature_flags_is_admin(),FALSE) THEN RAISE EXCEPTION 'STORY_ADMIN_REQUIRED' USING ERRCODE='42501'; END IF;
END; $$;

CREATE FUNCTION public.story_save_draft(p_script JSONB,p_revision INTEGER,p_sort_order INTEGER DEFAULT 0) RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.story_scripts%ROWTYPE; sid UUID;
BEGIN
  PERFORM public.story_require_admin(); PERFORM public.story_validate(p_script);
  IF p_revision IS NULL OR p_revision<0 OR p_sort_order IS NULL THEN RAISE EXCEPTION 'STORY_INVALID_REVISION'; END IF;
  sid:=(p_script->>'id')::UUID;
  IF p_revision=0 THEN
    INSERT INTO public.story_scripts(id,draft,sort_order,updated_by) VALUES(sid,p_script,p_sort_order,auth.uid()) RETURNING * INTO s;
  ELSE
    UPDATE public.story_scripts SET draft=p_script,revision=revision+1,sort_order=p_sort_order,updated_at=clock_timestamp(),updated_by=auth.uid()
      WHERE id=sid AND revision=p_revision RETURNING * INTO s;
    IF NOT FOUND THEN RAISE EXCEPTION 'STORY_REVISION_CONFLICT: reload the server draft before saving'; END IF;
  END IF;
  RETURN jsonb_build_object('id',s.id,'revision',s.revision,'published_version',s.published_version);
END; $$;
CREATE FUNCTION public.story_publish(p_id UUID,p_revision INTEGER) RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE s public.story_scripts%ROWTYPE; v INTEGER;
BEGIN
  PERFORM public.story_require_admin();
  SELECT * INTO s FROM public.story_scripts WHERE id=p_id FOR UPDATE;
  IF NOT FOUND OR s.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'STORY_REVISION_CONFLICT'; END IF;
  PERFORM public.story_validate(s.draft);
  v:=coalesce(s.published_version,0)+1;
  INSERT INTO public.story_releases(story_id,version,script) VALUES(s.id,v,s.draft);
  UPDATE public.story_scripts SET published_version=v,enabled=TRUE,updated_at=clock_timestamp(),updated_by=auth.uid() WHERE id=s.id;
  RETURN v;
END; $$;
CREATE FUNCTION public.story_unpublish(p_id UUID) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  PERFORM public.story_require_admin();
  UPDATE public.story_scripts SET enabled=FALSE,updated_at=clock_timestamp(),updated_by=auth.uid() WHERE id=p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'STORY_NOT_FOUND'; END IF;
END; $$;
CREATE FUNCTION public.story_catalog() RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'STORY_AUTH' USING ERRCODE='42501'; END IF;
  IF NOT coalesce(public.feature_is_enabled('story'),FALSE) THEN RAISE EXCEPTION 'STORY_DISABLED'; END IF;
  RETURN coalesce((SELECT jsonb_agg(jsonb_build_object('id',s.id,'title',r.script->'title','summary',r.script->'summary','version',r.version,'sort_order',s.sort_order) ORDER BY s.sort_order,s.id)
    FROM public.story_scripts s JOIN public.story_releases r ON r.story_id=s.id AND r.version=s.published_version WHERE s.enabled),'[]'::JSONB);
END; $$;
CREATE FUNCTION public.story_get(p_id UUID) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE result JSONB;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'STORY_AUTH' USING ERRCODE='42501'; END IF;
  IF NOT coalesce(public.feature_is_enabled('story'),FALSE) THEN RAISE EXCEPTION 'STORY_DISABLED'; END IF;
  SELECT to_jsonb(r) INTO result FROM public.story_releases r JOIN public.story_scripts s ON s.id=r.story_id AND s.published_version=r.version WHERE s.id=p_id AND s.enabled;
  IF result IS NULL THEN RAISE EXCEPTION 'STORY_NOT_FOUND'; END IF;
  RETURN result;
END; $$;
CREATE FUNCTION public.story_save_progress(p_story UUID,p_version INTEGER,p_node TEXT,p_history JSONB,p_completed BOOLEAN,p_skipped BOOLEAN) RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE script JSONB; n JSONB; previous_node JSONB; item JSONB; previous_id TEXT; current_id TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'STORY_AUTH' USING ERRCODE='42501'; END IF;
  IF NOT coalesce(public.feature_is_enabled('story'),FALSE) THEN RAISE EXCEPTION 'STORY_DISABLED'; END IF;
  SELECT r.script INTO script FROM public.story_releases r JOIN public.story_scripts s ON s.id=r.story_id WHERE r.story_id=p_story AND r.version=p_version AND s.enabled;
  IF script IS NULL THEN RAISE EXCEPTION 'STORY_NOT_FOUND'; END IF;
  IF jsonb_typeof(p_history) IS DISTINCT FROM 'array' OR p_completed IS NULL OR p_skipped IS NULL THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS'; END IF;
  IF jsonb_array_length(p_history) NOT BETWEEN 1 AND 1000 OR p_history->>-1 IS DISTINCT FROM p_node OR (p_skipped AND NOT p_completed) THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS'; END IF;
  IF jsonb_array_length(p_history)<1000 AND p_history->>0 IS DISTINCT FROM script->>'startNodeId' THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS: start'; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(p_history) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'string' THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS'; END IF;
    current_id:=item#>>'{}';
    SELECT value INTO n FROM jsonb_array_elements(script->'nodes') WHERE value->>'id'=current_id;
    IF n IS NULL THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS'; END IF;
    IF previous_id IS NOT NULL THEN
      IF jsonb_array_length(previous_node->'choices')>0 THEN
        IF NOT EXISTS (SELECT 1 FROM jsonb_array_elements(previous_node->'choices') WHERE value->>'nextNodeId'=current_id) THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS: choice'; END IF;
      ELSIF previous_node->>'nextNodeId' IS DISTINCT FROM current_id THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS: edge'; END IF;
    END IF;
    previous_id:=current_id; previous_node:=n;
  END LOOP;
  IF p_completed AND NOT p_skipped AND (jsonb_array_length(n->'choices')>0 OR n->>'nextNodeId' IS NOT NULL) THEN RAISE EXCEPTION 'STORY_INVALID_PROGRESS: ending'; END IF;
  INSERT INTO public.story_progress(user_id,story_id,version,node_id,history,completed,skipped)
    VALUES(auth.uid(),p_story,p_version,p_node,p_history,p_completed,p_skipped)
    ON CONFLICT(user_id,story_id,version) DO UPDATE SET node_id=excluded.node_id,history=excluded.history,completed=excluded.completed,skipped=excluded.skipped,updated_at=clock_timestamp();
END; $$;

REVOKE ALL ON FUNCTION public.story_text_valid(JSONB),public.story_url_valid(JSONB),public.story_validate(JSONB),public.story_require_admin() FROM PUBLIC,anon,authenticated;
REVOKE ALL ON FUNCTION public.story_save_draft(JSONB,INTEGER,INTEGER),public.story_publish(UUID,INTEGER),public.story_unpublish(UUID),public.story_catalog(),public.story_get(UUID),public.story_save_progress(UUID,INTEGER,TEXT,JSONB,BOOLEAN,BOOLEAN) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.story_save_draft(JSONB,INTEGER,INTEGER),public.story_publish(UUID,INTEGER),public.story_unpublish(UUID),public.story_catalog(),public.story_get(UUID),public.story_save_progress(UUID,INTEGER,TEXT,JSONB,BOOLEAN,BOOLEAN) TO authenticated;
INSERT INTO public.feature_flags(feature_key) VALUES('story') ON CONFLICT DO NOTHING;
INSERT INTO feature_control.request_rules(feature_key,path,writes_only) VALUES
  ('story','rpc/story_catalog',FALSE),('story','rpc/story_get',FALSE),('story','rpc/story_save_progress',FALSE),
  ('story','rpc/story_save_draft',FALSE),('story','rpc/story_publish',FALSE),('story','rpc/story_unpublish',FALSE),
  ('story','story_scripts',FALSE),('story','story_releases',FALSE),('story','story_progress',FALSE)
ON CONFLICT DO NOTHING;

-- The sample is generated from simple JSON values; no external media is required.
DO $$
DECLARE script JSONB; nodes JSONB:='[]'; node JSONB; idx INTEGER; nid TEXT; nextid TEXT;
  sid UUID:='51000000-0000-4000-8000-000000000001';
  vi TEXT[]:=ARRAY['Bình minh yên tĩnh quá… Nhưng tín hiệu vẫn còn dưới mặt hồ.','Khoan đã! Máy dò vừa tìm thấy một nguồn năng lượng rất mạnh!','Mặt đất đang rung! Bám chắc vào, Libra!','Có ánh sáng phía dưới. Chúng ta nên làm gì?','Một hải đăng cổ! Ánh sáng của nó đang chỉ đường cho chúng ta.','Từ đây vẫn thấy được… Đó là một hải đăng nằm dưới nước!','Ngày mai, chúng ta sẽ quay lại. Hành trình chỉ vừa bắt đầu.'];
  en TEXT[]:=ARRAY['Such a quiet dawn… But the signal is still beneath the lake.','Wait! The scanner found a powerful energy source!','The ground is shaking! Hold on, Libra!','There is a light below. What should we do?','An ancient beacon! Its light is showing us the way.','We can still see it from here… It is an underwater beacon!','Tomorrow, we will return. The journey has only just begun.'];
BEGIN
  FOR idx IN 1..7 LOOP
    nid:='51000000-0000-4000-8001-'||lpad(idx::TEXT,12,'0');
    nextid:=CASE WHEN idx IN (4,7) THEN NULL WHEN idx=5 THEN '51000000-0000-4000-8001-000000000007' ELSE '51000000-0000-4000-8001-'||lpad((idx+1)::TEXT,12,'0') END;
    node:=jsonb_build_object('id',nid,'speaker',jsonb_build_object('id',CASE WHEN idx IN (2,4,6) THEN 'libra' ELSE 'aries' END,'name',jsonb_build_object('vi',CASE WHEN idx IN (2,4,6) THEN 'Libra' ELSE 'Aries' END,'en',CASE WHEN idx IN (2,4,6) THEN 'Libra' ELSE 'Aries' END)),
      'dialogue',jsonb_build_object('vi',vi[idx],'en',en[idx]),'background',jsonb_build_object('url',CASE WHEN idx IN (3,4) THEN 'builtin:storm' WHEN idx IN (5,6) THEN 'builtin:night' ELSE 'builtin:dawn' END,'transition',CASE WHEN idx=3 THEN 'flash' ELSE 'fade' END),
      'characters',jsonb_build_array(jsonb_build_object('characterId','aries','position','left','expression',CASE WHEN idx=3 THEN 'shocked' WHEN idx>=5 THEN 'happy' ELSE 'normal' END,'isSpeaking',idx NOT IN (2,4,6),'animation',CASE WHEN idx=1 THEN 'slide-in' WHEN idx=3 THEN 'shake' ELSE 'none' END),jsonb_build_object('characterId','libra','position','right','expression',CASE WHEN idx=3 THEN 'shocked' WHEN idx>=5 THEN 'happy' ELSE 'normal' END,'isSpeaking',idx IN (2,4,6),'animation',CASE WHEN idx=1 THEN 'slide-in' WHEN idx=2 THEN 'bounce' WHEN idx=7 THEN 'fade-out' ELSE 'none' END)),
      'vfx',CASE idx WHEN 2 THEN 'vignette-pulse' WHEN 3 THEN 'screen-shake' WHEN 4 THEN 'flash-red' WHEN 5 THEN 'flash-white' WHEN 6 THEN 'flash-white' ELSE 'none' END,
      'audio',jsonb_build_object('bgm',CASE WHEN idx IN (3,4) THEN 'builtin:storm' ELSE 'builtin:dawn' END,'sfx',CASE WHEN idx=3 THEN 'builtin:impact' WHEN idx IN (2,5,6) THEN 'builtin:signal' ELSE '' END),
      'choices',CASE WHEN idx=4 THEN jsonb_build_array(jsonb_build_object('id','51000000-0000-4000-8001-000000000101','text',jsonb_build_object('vi','Tiến lại gần ánh sáng','en','Approach the light'),'nextNodeId','51000000-0000-4000-8001-000000000005'),jsonb_build_object('id','51000000-0000-4000-8001-000000000102','text',jsonb_build_object('vi','Quan sát từ vị trí an toàn','en','Observe from a safe distance'),'nextNodeId','51000000-0000-4000-8001-000000000006')) ELSE '[]'::JSONB END,'nextNodeId',nextid);
    nodes:=nodes||jsonb_build_array(node);
  END LOOP;
  script:=jsonb_build_object('schemaVersion',1,'id',sid,'title',jsonb_build_object('vi','Tín hiệu dưới mặt hồ','en','A signal beneath the lake'),
    'summary',jsonb_build_object('vi','Aries và Libra tìm được một hải đăng chìm giữa cơn bão và hẹn trở lại khi bình minh lên.','en','Aries and Libra discover a submerged beacon in a storm and promise to return at dawn.'),
    'startNodeId','51000000-0000-4000-8001-000000000001','characters',jsonb_build_array(jsonb_build_object('id','aries','name',jsonb_build_object('vi','Aries','en','Aries'),'expressions',jsonb_build_object('normal','/faction/character/aries.png')),jsonb_build_object('id','libra','name',jsonb_build_object('vi','Libra','en','Libra'),'expressions',jsonb_build_object('normal','/faction/character/libra.png'))),'nodes',nodes);
  PERFORM public.story_validate(script);
  INSERT INTO public.story_scripts(id,draft,published_version,enabled) VALUES(sid,script,1,TRUE);
  INSERT INTO public.story_releases(story_id,version,script) VALUES(sid,1,script);
END; $$;
COMMIT;
