-- Run in Supabase SQL Editor before deploying the matching frontend.
-- Keeps existing reward/country triggers and buy_species_from_market business rules.
BEGIN;

ALTER TABLE public.user_profile
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS onboarding_completed boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.player_features_is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_profile WHERE id = auth.uid() AND is_admin IS TRUE);
$$;
REVOKE ALL ON FUNCTION public.player_features_is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.player_features_is_admin() TO authenticated;

CREATE OR REPLACE FUNCTION public.update_my_country(p_country_id uuid) RETURNS public.user_profile
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.user_profile;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập.'; END IF;
  SELECT * INTO p FROM public.user_profile WHERE id = auth.uid() FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ.'; END IF;
  IF p.country_id = p_country_id THEN RAISE EXCEPTION 'Bạn đang chọn quốc gia này.'; END IF;
  IF p.country_id IS NOT NULL AND p.update_country_cooldown > now() THEN
    RAISE EXCEPTION 'Chưa hết thời gian chờ đổi quốc gia.';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.countries WHERE id = p_country_id) THEN
    RAISE EXCEPTION 'Quốc gia không hợp lệ.';
  END IF;
  UPDATE public.user_profile SET country_id = p_country_id, update_country_cooldown = now() + interval '365 days'
    WHERE id = auth.uid() RETURNING * INTO p;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_my_identity(p_display_name text, p_avatar_url text, p_avatar_path text) RETURNS public.user_profile
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE p public.user_profile;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập.'; END IF;
  p_display_name := btrim(p_display_name);
  p_avatar_url := nullif(btrim(p_avatar_url), '');
  IF p_display_name IS NULL OR char_length(p_display_name) NOT BETWEEN 2 AND 40 THEN
    RAISE EXCEPTION 'Tên hiển thị cần từ 2 đến 40 ký tự.';
  END IF;
  IF p_avatar_url IS NOT NULL AND (p_avatar_url !~* '^https://' OR char_length(p_avatar_url) > 2048) THEN
    RAISE EXCEPTION 'Ảnh đại diện phải là đường dẫn HTTPS hợp lệ.';
  END IF;
  IF p_avatar_path IS NOT NULL AND (split_part(p_avatar_path, '/', 1) <> auth.uid()::text OR p_avatar_path LIKE '%..%') THEN
    RAISE EXCEPTION 'Ảnh đại diện không thuộc tài khoản của bạn.';
  END IF;
  UPDATE public.user_profile SET display_name = p_display_name, avatar_url = p_avatar_url, avatar_path = p_avatar_path
    WHERE id = auth.uid() RETURNING * INTO p;
  IF NOT FOUND THEN RAISE EXCEPTION 'Không tìm thấy hồ sơ.'; END IF;
  RETURN p;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_my_onboarding() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập.'; END IF;
  UPDATE public.user_profile SET onboarding_completed = true WHERE id = auth.uid();
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_country(uuid), public.update_my_identity(text,text,text), public.complete_my_onboarding() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_my_country(uuid), public.update_my_identity(text,text,text), public.complete_my_onboarding() TO authenticated;

-- This is a new dedicated private bucket. Existing buckets are not modified.
INSERT INTO storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
VALUES ('player-profile-avatars','player-profile-avatars',false,2097152,ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO NOTHING;
DROP POLICY IF EXISTS player_avatar_insert ON storage.objects;
CREATE POLICY player_avatar_insert ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'player-profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS player_avatar_delete ON storage.objects;
CREATE POLICY player_avatar_delete ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'player-profile-avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
DROP POLICY IF EXISTS player_avatar_read ON storage.objects;
CREATE POLICY player_avatar_read ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-profile-avatars');

CREATE TABLE IF NOT EXISTS public.market_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  seller_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item jsonb NOT NULL,
  price bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS market_history_buyer_date ON public.market_history(buyer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS market_history_seller_date ON public.market_history(seller_id, created_at DESC);
ALTER TABLE public.market_history ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.market_history TO authenticated;
DROP POLICY IF EXISTS market_history_participants ON public.market_history;
CREATE POLICY market_history_participants ON public.market_history FOR SELECT TO authenticated
  USING (auth.uid() IN (buyer_id, seller_id) OR public.player_features_is_admin());
DROP POLICY IF EXISTS market_history_read_scope ON public.market_history;
CREATE POLICY market_history_read_scope ON public.market_history AS RESTRICTIVE FOR SELECT TO authenticated
  USING (auth.uid() IN (buyer_id, seller_id) OR public.player_features_is_admin());

-- Wrap the existing purchase RPC; history commits or rolls back with the purchase.
-- If that RPC already writes history in this transaction, do not write it twice.
CREATE OR REPLACE FUNCTION public.buy_species_with_history(p_market_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE listing public.species_market; snapshot jsonb; result jsonb; before_count bigint; after_count bigint;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Bạn cần đăng nhập.'; END IF;
  SELECT * INTO listing FROM public.species_market WHERE id = p_market_id FOR UPDATE;
  IF NOT FOUND OR listing.status <> 'normal' THEN RAISE EXCEPTION 'Tin bán không còn khả dụng.'; END IF;
  IF listing.user_id = auth.uid() THEN RAISE EXCEPTION 'Bạn không thể mua cá của chính mình.'; END IF;
  SELECT to_jsonb(c) || jsonb_build_object('market_id', listing.id, 'name', s.name, 'image', s.image)
    INTO snapshot FROM public.caught c LEFT JOIN public.species s ON s.id = c.species_id WHERE c.id = listing.caught_id;
  IF snapshot IS NULL THEN RAISE EXCEPTION 'Không tìm thấy cá.'; END IF;
  SELECT count(*) INTO before_count FROM public.market_history
    WHERE buyer_id = auth.uid() AND seller_id = listing.user_id AND xmin = (pg_current_xact_id()::text)::xid;
  result := to_jsonb(public.buy_species_from_market(p_market_id));
  IF result->>'success' = 'false' THEN RAISE EXCEPTION '%', coalesce(result->>'message','Không thể mua cá.'); END IF;
  IF NOT EXISTS (SELECT 1 FROM public.caught WHERE id = listing.caught_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Giao dịch chưa chuyển quyền sở hữu cá.';
  END IF;
  SELECT count(*) INTO after_count FROM public.market_history
    WHERE buyer_id = auth.uid() AND seller_id = listing.user_id AND xmin = (pg_current_xact_id()::text)::xid;
  IF after_count = before_count THEN
    INSERT INTO public.market_history(seller_id,buyer_id,item,price) VALUES(listing.user_id,auth.uid(),snapshot,listing.price);
  END IF;
  RETURN result;
END;
$$;
REVOKE ALL ON FUNCTION public.buy_species_with_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.buy_species_with_history(uuid) TO authenticated;

ALTER TABLE public.blueprint ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blueprint TO authenticated;
DROP POLICY IF EXISTS blueprint_player_read ON public.blueprint;
CREATE POLICY blueprint_player_read ON public.blueprint FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS blueprint_admin_write ON public.blueprint;
CREATE POLICY blueprint_admin_write ON public.blueprint FOR ALL TO authenticated
  USING (public.player_features_is_admin()) WITH CHECK (public.player_features_is_admin());
DROP POLICY IF EXISTS blueprint_insert_scope ON public.blueprint;
CREATE POLICY blueprint_insert_scope ON public.blueprint AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.player_features_is_admin());
DROP POLICY IF EXISTS blueprint_update_scope ON public.blueprint;
CREATE POLICY blueprint_update_scope ON public.blueprint AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (public.player_features_is_admin()) WITH CHECK (public.player_features_is_admin());
DROP POLICY IF EXISTS blueprint_delete_scope ON public.blueprint;
CREATE POLICY blueprint_delete_scope ON public.blueprint AS RESTRICTIVE FOR DELETE TO authenticated USING (public.player_features_is_admin());

ALTER TABLE public.error_feedback ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.error_feedback TO authenticated;
DROP POLICY IF EXISTS error_feedback_owner_read ON public.error_feedback;
CREATE POLICY error_feedback_owner_read ON public.error_feedback FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.player_features_is_admin());
DROP POLICY IF EXISTS error_feedback_read_scope ON public.error_feedback;
CREATE POLICY error_feedback_read_scope ON public.error_feedback AS RESTRICTIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.player_features_is_admin());

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['species_market','market_history','error_feedback','personal_notifications','system_notifications','system_notification_reads'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = table_name) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', table_name);
    END IF;
  END LOOP;
END;
$$;
COMMIT;
