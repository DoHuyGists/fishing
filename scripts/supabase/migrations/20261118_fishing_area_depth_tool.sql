-- Apply before rpc/fishing/cast_rod.sql. Existing explicit settings are preserved.
ALTER TABLE public.fishing_areas
    ADD COLUMN IF NOT EXISTS allow_depth_tool BOOLEAN DEFAULT FALSE;

COMMENT ON COLUMN public.fishing_areas.allow_depth_tool IS
    'Only TRUE enables cast-depth weighting; FALSE or NULL uses relative spawn weights without depth restrictions.';
