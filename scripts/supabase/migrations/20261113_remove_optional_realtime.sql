-- Deploy the snapshot-refresh client before running this migration. Existing
-- clients and integrations that still subscribe to these tables must be retired.
-- Run after older migrations that ADD these tables to supabase_realtime.
-- Keeps active_sessions, fishing_sessions and all tables outside this scope.
BEGIN;
DO $$
DECLARE
  target_table text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    RETURN;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime' AND puballtables) THEN
    RAISE EXCEPTION 'supabase_realtime publishes all tables; configure an explicit table publication before removing individual tables';
  END IF;
  FOREACH target_table IN ARRAY ARRAY[
    'currency', 'error_feedback', 'feature_flags', 'market_history',
    'personal_notifications', 'player_unlocked_countries', 'species_market',
    'system_notification_reads', 'system_notifications', 'user_in_area',
    'user_profile', 'user_team_invite', 'user_team_members', 'user_teams'
  ] LOOP
    IF EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = target_table
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE public.%I', target_table);
    END IF;
  END LOOP;
END;
$$;
COMMIT;

-- Rollback before deploying an older client: re-add only tables that were
-- published in your pre-deployment snapshot, for example:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.currency;
