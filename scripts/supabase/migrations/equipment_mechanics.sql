-- Run before the updated submit RPCs and cast_rod body.
-- Fill the new species columns and inventory JSON before enabling cast_rod.
-- Nullable new columns preserve existing rows; cast_rod validates the selected fish.
ALTER TABLE public.species
    ADD COLUMN IF NOT EXISTS fish_type TEXT,
    ADD COLUMN IF NOT EXISTS strength NUMERIC,
    ADD COLUMN IF NOT EXISTS alertness NUMERIC,
    ADD COLUMN IF NOT EXISTS burst_multiplier NUMERIC;

-- Server-only session state: never expose this table through Realtime.
CREATE TABLE IF NOT EXISTS public.fishing_session_mechanics (
    session_id UUID PRIMARY KEY REFERENCES public.fishing_sessions(id) ON DELETE CASCADE,
    rules_version INTEGER NOT NULL DEFAULT 2 CHECK (rules_version = 2),
    equipment_snapshot JSONB NOT NULL,
    fish_snapshot JSONB NOT NULL,
    modifiers JSONB NOT NULL,
    balance JSONB NOT NULL,
    failure_reason TEXT CHECK (failure_reason IN ('NO_FISH', 'HOOK_MISSED', 'ROD_OVERWEIGHT')),
    bait_consumed BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE public.fishing_session_mechanics ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.fishing_session_mechanics FROM PUBLIC, anon, authenticated;
