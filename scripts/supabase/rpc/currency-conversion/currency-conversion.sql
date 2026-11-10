BEGIN;

-- No implicit exchange rates: configure the three supported pairs before use.
CREATE TABLE IF NOT EXISTS public.currency_conversion_rates (
  source_currency text NOT NULL,
  target_currency text NOT NULL,
  source_amount bigint NOT NULL CHECK (source_amount BETWEEN 1 AND 9007199254740991),
  target_amount bigint NOT NULL CHECK (target_amount BETWEEN 1 AND 9007199254740991),
  is_active boolean NOT NULL DEFAULT true,
  PRIMARY KEY (source_currency, target_currency),
  CHECK ((source_currency, target_currency) IN (
    ('cash', 'shells'), ('cash', 'tickets'), ('shells', 'tickets')
  ))
);

ALTER TABLE public.currency_conversion_rates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.currency_conversion_rates FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.currency_conversion_rates TO service_role;

CREATE OR REPLACE FUNCTION public.get_currency_conversion_rates()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập.' USING ERRCODE = '42501';
  END IF;
  RETURN (
    SELECT coalesce(jsonb_agg(jsonb_build_object(
      'source_currency', source_currency, 'target_currency', target_currency,
      'source_amount', source_amount, 'target_amount', target_amount
    ) ORDER BY source_currency, target_currency), '[]'::jsonb)
    FROM public.currency_conversion_rates WHERE is_active
  );
END;
$$;

-- p_batches counts whole packs, not source currency units.
-- Expected amounts ensure a rate change never silently charges a different price.
CREATE OR REPLACE FUNCTION public.convert_currency(
  p_source_currency text,
  p_target_currency text,
  p_batches bigint,
  p_source_amount bigint,
  p_target_amount bigint
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_rate public.currency_conversion_rates%ROWTYPE;
  v_wallet public.currency%ROWTYPE;
  v_cost numeric;
  v_received numeric;
  v_source_balance numeric;
  v_target_balance numeric;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Vui lòng đăng nhập.' USING ERRCODE = '42501';
  END IF;
  IF p_batches IS NULL OR p_batches < 1 OR p_batches > 9007199254740991 THEN
    RAISE EXCEPTION 'Số gói quy đổi không hợp lệ.' USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_rate FROM public.currency_conversion_rates
  WHERE source_currency = p_source_currency AND target_currency = p_target_currency
    AND is_active FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Chiều quy đổi chưa được kích hoạt.' USING ERRCODE = '22023';
  END IF;
  IF p_source_amount IS DISTINCT FROM v_rate.source_amount
    OR p_target_amount IS DISTINCT FROM v_rate.target_amount THEN
    RAISE EXCEPTION 'Tỷ giá đã thay đổi. Vui lòng kiểm tra lại và quy đổi lần nữa.' USING ERRCODE = '22023';
  END IF;

  v_cost := v_rate.source_amount::numeric * p_batches;
  v_received := v_rate.target_amount::numeric * p_batches;
  IF v_cost > 9007199254740991 OR v_received > 9007199254740991 THEN
    RAISE EXCEPTION 'Số lượng quy đổi quá lớn.' USING ERRCODE = '22023';
  END IF;

  BEGIN
    SELECT * INTO STRICT v_wallet FROM public.currency WHERE user_id = v_user_id FOR UPDATE;
  EXCEPTION WHEN no_data_found OR too_many_rows THEN
    RAISE EXCEPTION 'Không tìm thấy ví tiền tệ hợp lệ.';
  END;

  v_source_balance := (to_jsonb(v_wallet) ->> p_source_currency)::numeric;
  v_target_balance := (to_jsonb(v_wallet) ->> p_target_currency)::numeric;
  IF v_source_balance IS NULL OR v_target_balance IS NULL
    OR v_source_balance::text IN ('NaN', 'Infinity', '-Infinity')
    OR v_target_balance::text IN ('NaN', 'Infinity', '-Infinity')
    OR v_source_balance < 0 OR v_target_balance < 0
    OR trunc(v_source_balance) <> v_source_balance OR trunc(v_target_balance) <> v_target_balance THEN
    RAISE EXCEPTION 'Số dư tiền tệ không hợp lệ.';
  END IF;
  IF v_source_balance < v_cost THEN
    RAISE EXCEPTION 'Không đủ số dư để quy đổi.' USING ERRCODE = '22023';
  END IF;
  IF v_target_balance + v_received > 9007199254740991 THEN
    RAISE EXCEPTION 'Số dư sau quy đổi quá lớn.' USING ERRCODE = '22023';
  END IF;

  UPDATE public.currency SET
    cash = cash - CASE WHEN p_source_currency = 'cash' THEN v_cost ELSE 0 END,
    shells = shells - CASE WHEN p_source_currency = 'shells' THEN v_cost ELSE 0 END
      + CASE WHEN p_target_currency = 'shells' THEN v_received ELSE 0 END,
    tickets = tickets + CASE WHEN p_target_currency = 'tickets' THEN v_received ELSE 0 END
  WHERE id = v_wallet.id RETURNING * INTO v_wallet;

  RETURN jsonb_build_object('cash', v_wallet.cash, 'shells', v_wallet.shells, 'tickets', v_wallet.tickets);
END;
$$;

REVOKE ALL ON FUNCTION public.get_currency_conversion_rates() FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.convert_currency(text, text, bigint, bigint, bigint) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_currency_conversion_rates() TO authenticated;
GRANT EXECUTE ON FUNCTION public.convert_currency(text, text, bigint, bigint, bigint) TO authenticated;

COMMIT;
