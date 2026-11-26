-- Apply after 20261112_feature_flags.sql and before deploying the client.
BEGIN;

ALTER TABLE public.feature_flags
  ADD COLUMN IF NOT EXISTS is_visible boolean NOT NULL DEFAULT true;

GRANT UPDATE (is_visible) ON public.feature_flags TO authenticated;

DROP TRIGGER IF EXISTS feature_flag_stamp ON public.feature_flags;
CREATE TRIGGER feature_flag_stamp
  BEFORE UPDATE OF enabled, is_visible, message_vi, message_en ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION feature_control.stamp_flag();

CREATE OR REPLACE FUNCTION public.feature_is_enabled(p_feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.feature_flags_is_admin() OR EXISTS (
    SELECT 1 FROM public.feature_flags
    WHERE feature_key = p_feature AND enabled IS TRUE AND is_visible IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.feature_is_enabled(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feature_is_enabled(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_feature_request() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_path text := btrim(regexp_replace(coalesce(current_setting('request.path', true), ''), '^/?rest/v1/', ''), '/');
  v_method text := upper(coalesce(current_setting('request.method', true), 'GET'));
  v_headers jsonb := coalesce(nullif(current_setting('request.headers', true), ''), '{}')::jsonb;
  v_flag public.feature_flags%ROWTYPE;
BEGIN
  IF v_method = 'OPTIONS' OR auth.role() = 'service_role' THEN RETURN; END IF;
  IF public.feature_flags_is_admin() THEN RETURN; END IF;
  SELECT flags.* INTO v_flag
  FROM feature_control.request_rules rules
  JOIN public.feature_flags flags USING (feature_key)
  WHERE rules.path = v_path AND (flags.enabled IS FALSE OR flags.is_visible IS FALSE)
    AND (NOT rules.writes_only OR v_method NOT IN ('GET', 'HEAD'))
  ORDER BY flags.feature_key LIMIT 1;
  IF FOUND THEN
    RAISE SQLSTATE 'PT403'
      USING MESSAGE = CASE WHEN lower(coalesce(v_headers->>'accept-language', 'vi')) LIKE 'en%'
        THEN coalesce(nullif(btrim(v_flag.message_en), ''), 'This feature is under maintenance. Please try again later.')
        ELSE coalesce(nullif(btrim(v_flag.message_vi), ''), 'Tính năng đang được bảo trì. Vui lòng thử lại sau.') END,
      DETAIL = 'FEATURE_DISABLED:' || v_flag.feature_key;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.check_feature_request() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_feature_request() TO anon, authenticated, service_role;

NOTIFY pgrst, 'reload schema';
COMMIT;
