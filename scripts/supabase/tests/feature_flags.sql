-- Run after 20261112_feature_flags.sql in a development Supabase SQL Editor.
-- All flag changes are rolled back. This tests SQL enforcement without HTTP.
BEGIN;
SELECT set_config('request.jwt.claims', '{"role":"authenticated"}', true);
SELECT set_config('request.headers', '{"accept-language":"en"}', true);

DO $test$
DECLARE
  rule record;
  verb text;
  rejected boolean;
  expected boolean;
BEGIN
  IF public.feature_flags_is_admin() THEN RAISE EXCEPTION 'Test must impersonate a non-admin'; END IF;
  UPDATE public.feature_flags SET enabled = true;
  FOR rule IN SELECT * FROM feature_control.request_rules ORDER BY feature_key, path LOOP
    UPDATE public.feature_flags SET enabled = false, message_en = 'Maintenance test' WHERE feature_key = rule.feature_key;
    FOREACH verb IN ARRAY ARRAY['GET', 'HEAD', 'POST', 'PATCH', 'DELETE'] LOOP
      PERFORM set_config('request.path', '/' || rule.path, true);
      PERFORM set_config('request.method', verb, true);
      expected := NOT rule.writes_only OR verb NOT IN ('GET', 'HEAD');
      rejected := false;
      BEGIN
        PERFORM public.check_feature_request();
      EXCEPTION WHEN SQLSTATE 'PT403' THEN
        rejected := true;
        IF SQLERRM <> 'Maintenance test' THEN RAISE EXCEPTION 'Wrong maintenance message: %', SQLERRM; END IF;
      END;
      IF rejected <> expected THEN RAISE EXCEPTION 'Unexpected enforcement for % % (%)', verb, rule.path, rule.feature_key; END IF;
    END LOOP;
    UPDATE public.feature_flags SET enabled = true WHERE feature_key = rule.feature_key;
  END LOOP;

  -- Map/entry locks must not prevent an existing player from finishing/leaving.
  UPDATE public.feature_flags SET enabled = false;
  PERFORM set_config('request.method', 'POST', true);
  PERFORM set_config('request.path', '/rpc/user_leave_area', true);
  PERFORM public.check_feature_request();
  PERFORM set_config('request.path', '/rpc/user_complete_fishing', true);
  PERFORM public.check_feature_request();
  PERFORM set_config('request.path', '/feature_flags', true);
  PERFORM public.check_feature_request();
END;
$test$;

-- RLS permits reads but denies updates by a normal authenticated player.
SET LOCAL ROLE authenticated;
DO $rls$
DECLARE affected integer;
BEGIN
  IF (SELECT count(*) FROM public.feature_flags) <> 27 THEN RAISE EXCEPTION 'Missing seeded feature flags'; END IF;
  UPDATE public.feature_flags SET enabled = true WHERE feature_key = 'market';
  GET DIAGNOSTICS affected = ROW_COUNT;
  IF affected <> 0 THEN RAISE EXCEPTION 'A non-admin updated a feature flag'; END IF;
END;
$rls$;
RESET ROLE;
ROLLBACK;
