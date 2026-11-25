-- Run in Supabase SQL Editor before deploying the frontend.
-- Requires the existing user_profile.market_sell_slot column.
-- Keep the existing listing RPC, fees and fish transitions intact.
BEGIN;

CREATE INDEX IF NOT EXISTS species_market_active_seller_idx
  ON public.species_market (user_id) WHERE status = 'normal';

CREATE OR REPLACE FUNCTION public.enforce_market_sell_slots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_slots numeric;
  v_used bigint;
BEGIN
  IF NEW.status IS DISTINCT FROM 'normal' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'normal' AND OLD.user_id IS NOT DISTINCT FROM NEW.user_id THEN
      RETURN NEW;
    END IF;
  END IF;

  -- Serialize new listings for this seller across tabs and RPC calls.
  -- SECURITY DEFINER counts all active rows even if RLS hides some of them.
  SELECT greatest(0, floor(coalesce(market_sell_slot, 0))) INTO v_slots
    FROM public.user_profile WHERE id = NEW.user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'MARKET_SELL_SLOT_LIMIT';
  END IF;

  SELECT count(*) INTO v_used FROM public.species_market
    WHERE user_id = NEW.user_id AND status = 'normal' AND id IS DISTINCT FROM NEW.id;
  IF v_used >= v_slots THEN
    RAISE EXCEPTION 'MARKET_SELL_SLOT_LIMIT';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.enforce_market_sell_slots() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS enforce_market_sell_slots ON public.species_market;
CREATE TRIGGER enforce_market_sell_slots
  BEFORE INSERT OR UPDATE ON public.species_market
  FOR EACH ROW EXECUTE FUNCTION public.enforce_market_sell_slots();

-- Existing listings remain available if a seller's limit is reduced.
-- Further listings are blocked until their active count falls below the limit.
COMMIT;
