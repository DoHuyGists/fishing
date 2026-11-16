-- Lifetime cash spending starts when this migration is applied.
-- No historical spending is inferred from current wallet balances.
BEGIN;

ALTER TABLE public.leaderboard
  ADD COLUMN IF NOT EXISTS spend BIGINT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS leaderboard_spend_ranking_idx
  ON public.leaderboard (spend DESC NULLS LAST, updated_at ASC, id ASC);

CREATE OR REPLACE FUNCTION public.track_leaderboard_cash_spend()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.leaderboard AS board
    (id, score, total_caught, spend, created_at, updated_at)
  VALUES
    (NEW.user_id, 0, 0, OLD.cash - NEW.cash, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET spend = coalesce(board.spend, 0) + EXCLUDED.spend,
        updated_at = EXCLUDED.updated_at;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.track_leaderboard_cash_spend() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS currency_track_leaderboard_cash_spend ON public.currency;
CREATE TRIGGER currency_track_leaderboard_cash_spend
  AFTER UPDATE OF cash ON public.currency
  FOR EACH ROW
  WHEN (NEW.cash < OLD.cash)
  EXECUTE FUNCTION public.track_leaderboard_cash_spend();

COMMIT;
