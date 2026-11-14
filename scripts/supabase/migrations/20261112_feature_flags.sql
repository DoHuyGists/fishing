-- Run in Supabase SQL Editor before deploying the client.
-- Rules mirror src/data/featureCatalog.json; validate with scripts/validate-feature-flags.mjs.
BEGIN;

CREATE SCHEMA IF NOT EXISTS feature_control;
REVOKE ALL ON SCHEMA feature_control FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.feature_flags_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profile WHERE id = (SELECT auth.uid()) AND is_admin IS TRUE
  );
$$;
REVOKE ALL ON FUNCTION public.feature_flags_is_admin() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.feature_flags_is_admin() TO authenticated;

CREATE TABLE IF NOT EXISTS public.feature_flags (
  feature_key text PRIMARY KEY,
  enabled boolean NOT NULL DEFAULT true,
  message_vi text NOT NULL DEFAULT '' CHECK (length(message_vi) <= 1000),
  message_en text NOT NULL DEFAULT '' CHECK (length(message_en) <= 1000),
  updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.feature_flags FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.feature_flags TO authenticated;
GRANT UPDATE (enabled, message_vi, message_en) ON public.feature_flags TO authenticated;
GRANT ALL ON public.feature_flags TO service_role;
DROP POLICY IF EXISTS feature_flags_read ON public.feature_flags;
CREATE POLICY feature_flags_read ON public.feature_flags FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS feature_flags_admin_update ON public.feature_flags;
CREATE POLICY feature_flags_admin_update ON public.feature_flags FOR UPDATE TO authenticated
  USING ((SELECT public.feature_flags_is_admin()))
  WITH CHECK ((SELECT public.feature_flags_is_admin()));

CREATE OR REPLACE FUNCTION feature_control.stamp_flag() RETURNS trigger
LANGUAGE plpgsql SET search_path = '' AS $$
BEGIN
  NEW.updated_at := clock_timestamp();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION feature_control.stamp_flag() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS feature_flag_stamp ON public.feature_flags;
CREATE TRIGGER feature_flag_stamp BEFORE UPDATE OF enabled, message_vi, message_en ON public.feature_flags
  FOR EACH ROW EXECUTE FUNCTION feature_control.stamp_flag();

CREATE TABLE IF NOT EXISTS feature_control.request_rules (
  feature_key text NOT NULL REFERENCES public.feature_flags(feature_key),
  path text NOT NULL,
  writes_only boolean NOT NULL DEFAULT false,
  PRIMARY KEY (feature_key, path)
);
REVOKE ALL ON feature_control.request_rules FROM PUBLIC, anon, authenticated;
-- Preserve existing flags/messages on reruns.
DO $seed$
DECLARE
  catalog jsonb := $catalog$[{"key":"dispatch","labelKey":"Dispatch.title","rpcs":["get_dispatch_state","dispatch_action"],"tables":["dispatch_npcs","dispatch_jobs","dispatch_owned_npcs","dispatch_runs","dispatch_history","dispatch_actions"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"account","labelKey":"FeatureTable.tai_khoan","rpcs":["update_my_country","update_my_identity"],"tables":[],"writeTables":["user_setting","user_profile"],"functions":[],"storageBuckets":["player-profile-avatars"]},{"key":"guide","labelKey":"FeatureTable.huong_dan","rpcs":[],"tables":["guides"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"tutorial","labelKey":"NewPlayerFishing.thuc_hanh","rpcs":[],"tables":["tutorials"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"notifications","labelKey":"NotificationModal.thong_bao","rpcs":["mark_system_notification_read"],"tables":["personal_notifications","system_notifications","system_notification_reads"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"inventory","labelKey":"InventoryModal.tui_do","rpcs":["use_inventory_item","delete_inventory_items","buy_equipment_set","save_equipment_set","create_body_equipment_set","save_body_equipment_set","switch_body_equipment","switch_equipment","select_current_fishing_item"],"tables":[],"writeTables":["user_inventory","user_equipments","user_body_equipments"],"functions":[],"storageBuckets":[]},{"key":"caught","labelKey":"FeatureTable.kho_ca","rpcs":[],"tables":[],"writeTables":["caught"],"functions":[],"storageBuckets":[]},{"key":"shop","labelKey":"FeatureTable.cua_hang","rpcs":["purchase_item"],"tables":[],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"skill","labelKey":"SkillModal.ky_nang","rpcs":["upgrade_skill"],"tables":[],"writeTables":["user_skills"],"functions":[],"storageBuckets":[]},{"key":"post-production","labelKey":"PostProduction.luoi_ca","rpcs":["move_species","release_in_net_fishes"],"tables":[],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"work-bench","labelKey":"WorkBenchModal.che_tao","rpcs":["craft_blueprint"],"tables":["blueprint"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"mission","labelKey":"MissionList.nhiem_vu","rpcs":["get_daily_missions","get_current_hour_missions","complete_hour_mission"],"tables":["daily_missions","hour_missions","user_daily_missions"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"attendance","labelKey":"AttendanceModal.diem_danh","rpcs":["claim_daily_reward","purchase_fishing_pass","claim_fishing_pass_reward"],"tables":["daily_rewards","fishing_passes","fishing_pass_rewards","user_fishing_passes","user_fishing_pass_claims"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"event","labelKey":"EventModal.su_kien_2","rpcs":[],"tables":["event","event_schedule"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"market","labelKey":"MarketWindow.cho_ca","rpcs":["cancel_market_listing","buy_species_with_history","list_species_on_market"],"tables":["market_history","species_market"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"gacha","labelKey":"FeatureAvailability.gacha","rpcs":["spin_wheel","get_spin_wheel_rewards"],"tables":[],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"aquaculture","labelKey":"AquacultureModal.nong_trai_ca","rpcs":["get_aquaculture_farm","purchase_pond_slot","stock_aquaculture_batch","feed_aquaculture_batch","care_aquaculture_pond","sell_aquaculture_fish","transfer_aquaculture_fish","release_aquaculture_fish"],"tables":["aquaculture_species_rules","aquaculture_species_foods","aquaculture_records","aquaculture_ponds","aquaculture_batches","aquaculture_fish"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"friend","labelKey":"FeatureTable.ban_be","rpcs":["send_friend_request","respond_friend_request","cancel_friend_request","remove_friend"],"tables":["user_friends"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"team","labelKey":"FeatureTable.lap_doi","rpcs":["respond_team_invite","create_team","join_team","leave_team","kick_team_member","close_team","transfer_team_leadership"],"tables":[],"writeTables":["user_team_invite","user_teams","user_team_members"],"functions":[],"storageBuckets":[]},{"key":"faction","labelKey":"FactionSelectModal.phe_phai","rpcs":["join_faction","change_faction","get_my_faction_daily_activity"],"tables":[],"writeTables":["user_factions"],"functions":[],"storageBuckets":[]},{"key":"leaderboard","labelKey":"FeatureTable.xep_hang","rpcs":[],"tables":["leaderboard"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"badge","labelKey":"Achievement.huy_hieu","rpcs":["get_user_badges_status","claim_badge_reward"],"tables":[],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"diary","labelKey":"FeatureTable.nhat_ky","rpcs":[],"tables":["species"],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"redeem","labelKey":"CurrencyConvertTable.quy_doi","rpcs":["redeem_code","convert_currency","get_currency_conversion_rates"],"tables":[],"writeTables":[],"functions":[],"storageBuckets":[]},{"key":"feedback","labelKey":"Feedbackmodal.phan_hoi","rpcs":[],"tables":["feedback","error_feedback"],"writeTables":[],"functions":[],"storageBuckets":["error-feedback"]},{"key":"donation","labelKey":"FeatureTable.ung_ho","rpcs":[],"tables":[],"writeTables":[],"functions":["paypal-donation"],"storageBuckets":[]},{"key":"world-map","labelKey":"FishingAnchor.ban_do","rpcs":["user_enter_area","consume_turn"],"tables":["fishing_areas"],"writeTables":["user_in_area"],"functions":[],"storageBuckets":[]},{"key":"enter-area","labelKey":"InteractWorldMap.di_den_bai_cau","rpcs":["user_enter_area","consume_turn"],"tables":[],"writeTables":["user_in_area"],"functions":[],"storageBuckets":[]}]$catalog$::jsonb;
  feature jsonb;
  endpoint text;
BEGIN
  FOR feature IN SELECT value FROM jsonb_array_elements(catalog) LOOP
    INSERT INTO public.feature_flags(feature_key) VALUES (feature->>'key') ON CONFLICT DO NOTHING;
    DELETE FROM feature_control.request_rules WHERE feature_key = feature->>'key';
    FOR endpoint IN SELECT jsonb_array_elements_text(feature->'rpcs') LOOP
      INSERT INTO feature_control.request_rules VALUES (feature->>'key', 'rpc/' || endpoint, false);
    END LOOP;
    FOR endpoint IN SELECT jsonb_array_elements_text(feature->'tables') LOOP
      INSERT INTO feature_control.request_rules VALUES (feature->>'key', endpoint, false);
    END LOOP;
    FOR endpoint IN SELECT jsonb_array_elements_text(feature->'writeTables') LOOP
      INSERT INTO feature_control.request_rules VALUES (feature->>'key', endpoint, true);
    END LOOP;
  END LOOP;
END;
$seed$;

-- Storage policies also use this helper. Unknown flags are disabled.
CREATE OR REPLACE FUNCTION public.feature_is_enabled(p_feature text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT public.feature_flags_is_admin() OR EXISTS (
    SELECT 1 FROM public.feature_flags WHERE feature_key = p_feature AND enabled IS TRUE
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
  -- Existing RLS and grants still apply to administrators.
  IF public.feature_flags_is_admin() THEN RETURN; END IF;
  SELECT flags.* INTO v_flag
  FROM feature_control.request_rules rules
  JOIN public.feature_flags flags USING (feature_key)
  WHERE rules.path = v_path AND flags.enabled IS FALSE
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

-- PostgREST checks do not cover Storage. Restrictive write policies supplement
-- existing ownership policies; public avatar images remain readable.
DROP POLICY IF EXISTS feature_flag_storage_insert ON storage.objects;
CREATE POLICY feature_flag_storage_insert ON storage.objects AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (CASE bucket_id WHEN 'player-profile-avatars' THEN (SELECT public.feature_is_enabled('account'))
    WHEN 'error-feedback' THEN (SELECT public.feature_is_enabled('feedback')) ELSE true END);
DROP POLICY IF EXISTS feature_flag_storage_update ON storage.objects;
CREATE POLICY feature_flag_storage_update ON storage.objects AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (CASE bucket_id WHEN 'player-profile-avatars' THEN (SELECT public.feature_is_enabled('account'))
    WHEN 'error-feedback' THEN (SELECT public.feature_is_enabled('feedback')) ELSE true END)
  WITH CHECK (CASE bucket_id WHEN 'player-profile-avatars' THEN (SELECT public.feature_is_enabled('account'))
    WHEN 'error-feedback' THEN (SELECT public.feature_is_enabled('feedback')) ELSE true END);
DROP POLICY IF EXISTS feature_flag_storage_delete ON storage.objects;
CREATE POLICY feature_flag_storage_delete ON storage.objects AS RESTRICTIVE FOR DELETE TO authenticated
  USING (CASE bucket_id WHEN 'player-profile-avatars' THEN (SELECT public.feature_is_enabled('account'))
    WHEN 'error-feedback' THEN (SELECT public.feature_is_enabled('feedback')) ELSE true END);

DO $realtime$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public' AND tablename = 'feature_flags') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.feature_flags;
  END IF;
END;
$realtime$;

-- Never silently replace an existing security hook.
DO $hook$
DECLARE v_existing text;
BEGIN
  SELECT substring(setting FROM length('pgrst.db_pre_request=') + 1) INTO v_existing
    FROM pg_db_role_setting config, unnest(config.setconfig) setting
    WHERE config.setrole IN (0, (SELECT oid FROM pg_roles WHERE rolname = 'authenticator'))
      AND config.setdatabase IN (0, (SELECT oid FROM pg_database WHERE datname = current_database()))
      AND setting LIKE 'pgrst.db_pre_request=%'
    ORDER BY (config.setrole <> 0) DESC, (config.setdatabase <> 0) DESC LIMIT 1;
  IF coalesce(v_existing, '') NOT IN ('', 'public.check_feature_request') THEN
    RAISE EXCEPTION 'Existing db_pre_request hook: %. Chain public.check_feature_request() in that hook instead of replacing it.', v_existing;
  END IF;
  ALTER ROLE authenticator SET pgrst.db_pre_request = 'public.check_feature_request';
END;
$hook$;
NOTIFY pgrst, 'reload config';
NOTIFY pgrst, 'reload schema';
COMMIT;
