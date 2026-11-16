-- Preview renews presence through touch_fishing_presence(), which locks
-- membership FOR SHARE and writes fatigue state. STABLE RPCs run read-only
-- in PostgREST, including POST requests. Preserve the deployed body/permissions
-- and explicitly mark this RPC as a write-capable function.
BEGIN;
ALTER FUNCTION public.preview_fish_by_depth(NUMERIC) VOLATILE;
NOTIFY pgrst, 'reload schema';
COMMIT;
