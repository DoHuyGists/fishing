-- Paid unlock, kept separate from unlock_country (used for free grants).
CREATE OR REPLACE FUNCTION public.purchase_country_unlock(p_country_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  v_player_id uuid := auth.uid();
  v_wallet public.currency%ROWTYPE;
  v_inserted uuid;
BEGIN
  IF v_player_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  -- Serialize purchases for this wallet, including concurrent countries.
  BEGIN
    SELECT * INTO STRICT v_wallet FROM public.currency
    WHERE user_id = v_player_id FOR UPDATE;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RAISE EXCEPTION 'Invalid wallet' USING ERRCODE = '22023';
  END;

  IF EXISTS (SELECT 1 FROM public.player_unlocked_countries
    WHERE player_id = v_player_id AND country_id = p_country_id) THEN
    RETURN jsonb_build_object('success', true, 'country_id', p_country_id);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.fishing_areas WHERE country_id = p_country_id) THEN
    RAISE EXCEPTION 'Country has no fishing areas' USING ERRCODE = '22023';
  END IF;
  IF v_wallet.shells IS NULL OR v_wallet.shells < 300 THEN
    RAISE EXCEPTION 'Insufficient shells' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.player_unlocked_countries(player_id, country_id)
  VALUES (v_player_id, p_country_id)
  ON CONFLICT (player_id, country_id) DO NOTHING
  RETURNING id INTO v_inserted;

  IF v_inserted IS NOT NULL THEN
    UPDATE public.currency SET shells = shells - 300 WHERE id = v_wallet.id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Wallet update failed';
    END IF;
  END IF;

  RETURN jsonb_build_object('success', true, 'country_id', p_country_id);
END;
$$;

REVOKE ALL ON FUNCTION public.purchase_country_unlock(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purchase_country_unlock(uuid) TO authenticated;
