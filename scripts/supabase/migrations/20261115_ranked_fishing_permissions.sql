-- Repair existing RPC wrappers after deploying 20261115_ranked_fishing.sql.
-- Safe to rerun. No player data or gameplay configuration is changed.
BEGIN;
DO $repair$
DECLARE
  v_owner NAME;
  v_signature TEXT;
  v_function REGPROCEDURE;
BEGIN
  SELECT r.rolname INTO v_owner
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_roles r ON r.oid = p.proowner
  WHERE p.oid = to_regprocedure('public.fishing_fatigue_multiplier(jsonb,text)');
  IF v_owner IS NULL OR to_regprocedure('public.cast_rod(uuid,numeric)') IS NULL THEN
    RAISE EXCEPTION 'Deploy ranked fishing and cast_rod before repairing RPC permissions';
  END IF;
  IF v_owner IN ('anon', 'authenticated', 'authenticator') THEN
    RAISE EXCEPTION 'Ranked fishing helpers must be owned by a trusted migration role';
  END IF;

  -- CREATE OR REPLACE preserves the old owner and editing only the body also
  -- preserves SECURITY INVOKER. Normalize the complete trusted RPC call chain.
  FOREACH v_signature IN ARRAY ARRAY[
    'public.cast_rod(uuid,numeric)',
    'public.preview_fish_by_depth(numeric)',
    'public.resolve_fishing_challenge(uuid,boolean,integer)',
    'public.submit_challenge(uuid,boolean,integer)',
    'public.start_tension_challenge(uuid)',
    'public.submit_tension_challenge(jsonb)',
    'public.replay_tension_challenge(jsonb,jsonb,integer)',
    'public.fishing_weather_modifiers(jsonb)',
    'public.fishing_effective_stat(numeric,jsonb,text,numeric,numeric)',
    'public.fishing_weather_spawn_weight(numeric,text,jsonb)',
    'public.fishing_health_value(jsonb,text)',
    'public.fishing_survival_settle(uuid,uuid,boolean)',
    'public.get_fishing_survival()',
    'public.touch_fishing_presence()',
    'public.get_fishing_fatigue(uuid)',
    'public.fishing_set_presence(uuid,uuid,timestamp with time zone)'
  ] LOOP
    v_function := to_regprocedure(v_signature);
    IF v_function IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER FUNCTION %s OWNER TO %I', v_function, v_owner);
    EXECUTE format('ALTER FUNCTION %s SET search_path = public', v_function);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_function);
    IF v_signature = 'public.replay_tension_challenge(jsonb,jsonb,integer)'
       OR v_signature LIKE 'public.fishing_weather_%'
       OR v_signature LIKE 'public.fishing_effective_stat(%'
       OR v_signature LIKE 'public.fishing_health_value(%' THEN
      EXECUTE format('ALTER FUNCTION %s SECURITY INVOKER', v_function);
    ELSE
      EXECUTE format('ALTER FUNCTION %s SECURITY DEFINER', v_function);
      IF v_signature NOT IN ('public.resolve_fishing_challenge(uuid,boolean,integer)',
        'public.fishing_survival_settle(uuid,uuid,boolean)',
        'public.fishing_set_presence(uuid,uuid,timestamp with time zone)') THEN
        EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_function);
      END IF;
    END IF;
  END LOOP;
END;
$repair$;
NOTIFY pgrst, 'reload schema';
COMMIT;
