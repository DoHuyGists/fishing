-- Deploy in Supabase SQL Editor before the client that calls this RPC.
-- Uses the existing CANCELLED terminal status recognized by equipment RPCs.
CREATE OR REPLACE FUNCTION public.cancel_fishing_session(p_session_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
    v_session public.fishing_sessions%ROWTYPE;
BEGIN
    IF auth.uid() IS NULL THEN RAISE EXCEPTION 'User not authenticated'; END IF;

    -- Serialize cancellation with challenge activation and result submission.
    SELECT * INTO v_session FROM public.fishing_sessions
    WHERE id = p_session_id AND user_id = auth.uid() FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Session not found or unauthorized'; END IF;

    -- Retrying after a lost response must not change a completed result.
    IF v_session.status IN ('SUCCESS', 'FAILED', 'EXPIRED', 'CANCELLED') THEN
        RETURN;
    END IF;
    IF v_session.challenge_data ? 'activatedAt' THEN
        RAISE EXCEPTION 'Cannot retrieve bait after the fight has started';
    END IF;

    UPDATE public.fishing_sessions SET status = 'CANCELLED'
    WHERE id = p_session_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.cancel_fishing_session(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_fishing_session(UUID) TO authenticated;
