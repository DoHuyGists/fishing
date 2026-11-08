-- Run once in the Supabase SQL Editor to notify the map of new unlocks.
-- The table must also be readable by its player through existing SELECT grants/RLS policies.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_unlocked_countries'
  ) then
    alter publication supabase_realtime add table public.player_unlocked_countries;
  end if;
end;
$$;
