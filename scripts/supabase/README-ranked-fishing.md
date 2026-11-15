# Ranked fishing

## Deployment

1. Apply `migrations/equipment_mechanics.sql` and the existing feature flags migration if not already installed.
2. Apply `migrations/20261115_ranked_fishing.sql` once. It adds scoring columns to the existing `species` and **`weathers`** tables, without replacing the existing lifetime `leaderboard`.
3. Apply `migrations/20261115_ranked_fishing_uuid.sql`. This upgrades the original numeric season IDs to UUIDs, preserving all score/history relationships. `season_number` is a separate positive sequential display number. This migration is required for new installations too; do not rerun the original schema migration on an existing installation.
4. Execute the complete `rpc/fishing/cast_rod.sql` definition in SQL Editor. It explicitly sets SECURITY DEFINER and the search path; do not paste it into a body-only function editor.
5. Deploy `rpc/fishing/submit_challenge.sql`, then `rpc/fishing/submit_tension_challenge.sql`. Update `preview_fish_by_depth(p_cast_depth numeric)` using the matching SQL body too.
6. Apply `migrations/20261115_ranked_fishing_permissions.sql`. It aligns existing RPC owners with the trusted ranked-fishing migration owner and repairs their execution context. Internal scoring/replay helpers remain inaccessible to client roles.
7. Configure `species.rare_weight` and `weathers.extreme_weight` in their existing admin forms. Both default to 1. Existing nulls are backfilled with 1; invalid non-null values fail migration validation.
8. Configure fatigue effects below and start the first season at the intended instant using SQL Editor or a trusted service-role backend:

```sql
-- Example only: replace this timestamp with the actual launch time.
SELECT public.start_fishing_seasons('2026-12-01 00:00:00+07'::timestamptz);
```

Initialization is deliberately explicit. Until the scheduled start, normal fishing rewards still work and no seasonal scores are recorded. Casts created before the updated cast RPC have no scoring snapshot and are not scored retroactively. Old catches cannot be reconstructed accurately without their original environment/fatigue factors.

For an existing installation, apply only the UUID upgrade and redeploy the matching frontend. Apply the permissions repair afterward if RPC ownership differs. The UUID upgrade can be rerun, preserves existing schedules, and does not start or reset seasons. If no season has ever been created and the launch should be immediate, run `SELECT public.start_fishing_seasons(clock_timestamp());` once in SQL Editor after upgrading. Future seasons follow automatically. Seasonal IDs and RPC arguments are UUID strings; only `season_number` is used for the visible season label.

Deploy the migration and RPC changes before the frontend. The repository has no connection for applying production SQL automatically.

If an already deployed cast returns `permission denied for function fishing_fatigue_multiplier`, run `migrations/20261115_ranked_fishing_permissions.sql` in SQL Editor under the trusted migration role. Do not grant client roles access to private scoring helpers: the repair runs the validated RPCs under the correct trusted owner instead. The repair is safe to rerun and does not require rerunning the schema migration or resetting seasons.

## Scoring and season boundaries

`w_norm = clamp((weight - weight_min) / (weight_max - weight_min), 0, 1)`, with the existing 0.5 fallback for fixed-weight species.

`score = w_norm^1.5 * rare_weight^2 * extreme_weight * season_weight * fatigue_score_multiplier`.

The server snapshots weight normalization, rarity weight, active weather and fatigue at cast time. Missing/expired weather is neutral (`E = 1`). It selects **season and season_weight at successful catch resolution**, after validation and other rewards, using `clock_timestamp()`. No client timestamp or score is accepted. Numeric scores are stored without display rounding; UI displays up to six decimals. Equal scores favor the later catch, then descending catch UUID for deterministic ordering at an identical timestamp.

Each season is exactly 336 hours, with `[starts_at, ends_at)` membership. At the first board read or successful scoring operation after an end, one transaction finalizes every elapsed season and creates its successor with the exact prior end as its start. A common transaction lock serializes scoring and rollover: a late transaction cannot insert into an already finalized season. This requires no cron job and introduces no gap or publication day. Even a cast spanning a boundary belongs to the season of its successful resolution. The board UI automatically refreshes at the current season boundary.

The top fish of each species determines the three winning species. Their fish, player name, time and score are snapshotted into `fishing_hall_of_fame`. One player can represent multiple winning species. A season with fewer than three qualifying species honors only those available. Historical rows deliberately have no cascading references to users, species or caught inventory, so selling/releasing fish and catalog/account changes cannot erase achievements.

For the next season, winning species receive 0.7. Up to three distinct random species outside that group receive 1.3; eligible species must have positive spawn weight in an available fishing area. Other species reset to 1. These weights never compound. `fishing_season_meta` preserves each season's affected species and weights. After long inactivity, empty elapsed seasons still rotate with their normal dates and have no Hall of Fame winners.

Seasonal player ranks use each player's best fish. The existing lifetime score and total-caught boards retain their original repository queries and tie behavior. Their data is not reset or rewritten by this feature.

## Fatigue configuration

`user_area_fatigue` stores `(user_id, area_id, fatigue_score, calculated_at, active_until)`. Fractions of minutes are preserved. While present, fatigue increases by 1 per minute up to 100; while away, it decreases by 1 per minute down to 0. Returning to an area retains its remaining fatigue. A trigger on existing `user_in_area` membership changes settles the previous area immediately; it does not replace or alter the existing enter/leave RPC behavior.

The fishing view sends a heartbeat every 30 seconds, including background tabs. Server casts/previews also renew presence. A lease expires 90 seconds after the last heartbeat, so a closed/disconnected client cannot accumulate fatigue forever from a stale membership row. Recovery begins at lease expiry; abrupt disconnect detection therefore has at most a 90-second grace. An explicit leave starts recovery immediately. No per-minute DB job is required. Browser timer suspension is treated like a disconnect after lease expiry.

`fatigue_effects` references existing `modifiers` records with `unit = 'PERCENT'` and defines:

| Column | Meaning |
| --- | --- |
| `min_fatigue`, `max_fatigue` | Inclusive lower / exclusive upper threshold; use 101 to include 100 |
| `target` | `weight_cap`, `rare_spawn`, or `score` |
| `value` | Percentage change from -100 to 0 |
| `enabled` | Activate/deactivate without code changes |

All matching effects compose multiplicatively. For progressive replacement tiers, use non-overlapping ranges per modifier. For cascading penalties, let ranges overlap intentionally. Example **configuration only**, not automatically enabled by the migration:

```sql
INSERT INTO public.modifiers(code, name, unit)
VALUES ('FATIGUE_SCORE', 'Mệt mỏi: hiệu suất điểm', 'PERCENT')
ON CONFLICT (code) DO NOTHING;

INSERT INTO public.fatigue_effects(modifier_id, min_fatigue, max_fatigue, target, value)
SELECT id, 50, 101, 'score', -10
FROM public.modifiers WHERE code = 'FATIGUE_SCORE';
```

`weight_cap` compresses the generated within-species weight range before strength/stars/scoring are computed. A species with identical min/max weight retains its fixed weight and existing normalization fallback. `rare_spawn` changes relative encounter weights only for RARE, EPIC and LEGENDARY fish; it does not falsify a caught fish's rarity or its `rare_weight`. `score` multiplies the final score. No automatic fatigue penalties are seeded because their balance values have not been specified.

Only trusted SQL/service-role code can change fatigue rules/state, season schedules or score history. Players can heartbeat only their own current membership; they cannot provide area IDs, time, score, season coefficients or accumulated fatigue. New public RPCs expose the board/archive and the player's own fatigue summary. Exact fish factors remain private during the challenge.

## Verification

Run `npm run test:leaderboard`, `npm run test:leaderboard:browser`, `npm run check:i18n`, and `npm run build`. The SQL integration test runs the actual migration, cast and resolver in an isolated PGlite database; it exercises scoring snapshots, cross-boundary attribution, later-catch ties, fatigue recovery/caps/effects, archive retention, randomized disjoint meta groups and client privileges. The browser fixture checks current/archive navigation, Hall of Fame, fatigue, both languages and mobile width. Neither connects to production Supabase.
