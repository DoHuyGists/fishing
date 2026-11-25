# Ranked fishing

## Deployment

For fatigue previews in the map popup and preparation modal, also apply `migrations/20261116_fishing_fatigue_preview.sql` after the ranked-fishing migrations. Its authenticated RPC reads only the caller's fatigue for the selected area, including recovery and configured effects, without entering the area or renewing presence.

1. Apply `migrations/equipment_mechanics.sql` and the existing feature flags migration if not already installed.
2. Apply `migrations/20261115_ranked_fishing.sql` once. It adds scoring columns to the existing `species` and **`weathers`** tables, without replacing the existing lifetime `leaderboard`.
3. Apply `migrations/20261115_ranked_fishing_uuid.sql`. This upgrades the original numeric season IDs to UUIDs, preserving all score/history relationships. `season_number` is a separate positive sequential display number. This migration is required for new installations too; do not rerun the original schema migration on an existing installation.
4. Execute the complete `rpc/fishing/cast_rod.sql` definition in SQL Editor. It explicitly sets SECURITY DEFINER and the search path; do not paste it into a body-only function editor.
5. Deploy `rpc/fishing/submit_challenge.sql`, then `rpc/fishing/submit_tension_challenge.sql`. Update `preview_fish_by_depth(p_cast_depth numeric)` using the matching SQL body too.
6. Apply `migrations/20261115_ranked_fishing_permissions.sql`. It aligns existing RPC owners with the trusted ranked-fishing migration owner and repairs their execution context. Internal scoring/replay helpers remain inaccessible to client roles.
   Then apply `migrations/20261115_leaderboard_season_best_fish.sql` to store current personal bests in `leaderboard.best_fish` and archive one result per player at season end. Deploy the updated `submit_challenge.sql` first; its lock order prevents scoring/rollover deadlocks.
7. Configure `species.rare_weight` and `weathers.extreme_weight` in their existing admin forms. Both default to 1. Existing nulls are backfilled with 1; invalid non-null values fail migration validation.
8. Configure fatigue effects below and start the first season at the intended instant using SQL Editor or a trusted service-role backend:

```sql
-- Example only: replace this timestamp with the actual launch time.
SELECT public.start_fishing_seasons('2026-12-01 00:00:00+07'::timestamptz);
```

Initialization is deliberately explicit. Until the scheduled start, normal fishing rewards still work and no seasonal scores are recorded. Casts created before the updated cast RPC have no scoring snapshot and are not scored retroactively. Old catches cannot be reconstructed accurately without their original environment/fatigue factors.

For an existing UUID installation, redeploy `rpc/fishing/submit_challenge.sql`, then apply `migrations/20261115_leaderboard_season_best_fish.sql`. Run the UUID upgrade first only if not already installed, and the permissions repair if RPC ownership differs. Do not rerun old schema/UUID migrations after the personal-best upgrade: they restore the old per-catch functions. The personal-best migration can be rerun safely. It preserves schedules, existing Hall of Fame snapshots, archived boards and each player's best catch in the unfinished season; it never resets lifetime score or catch totals. Legacy `fishing_score_catches` rows remain for preservation but no new catches are written there. If no season has ever been created and the launch should be immediate, run `SELECT public.start_fishing_seasons(clock_timestamp());` once in SQL Editor after upgrading. Seasonal IDs and RPC arguments are UUID strings; only `season_number` is used for the visible season label.

Deploy the migration and RPC changes before the frontend. The repository has no connection for applying production SQL automatically.

If the depth preview reports `cannot execute SELECT FOR SHARE in a read-only transaction`, run `migrations/20261116_fishing_depth_preview_transaction.sql` in SQL Editor. It marks `preview_fish_by_depth(numeric)` as `VOLATILE`, because the preview calls `touch_fishing_presence()` to lock membership and renew presence. PostgREST runs `STABLE` RPCs in read-only transactions even for POST requests. This repair preserves the deployed function body, owner, permissions and player data, and reloads the API schema cache. It is safe to rerun. The complete `rpc/fishing/preview_fish_by_depth.sql` definition also declares `VOLATILE` for future deployments.

Run `node --test scripts/test-depth-preview.mjs` to reproduce the read-only failure and verify the repair, authenticated access, preview results and presence renewal in an isolated database.

If an already deployed cast returns `permission denied for function fishing_fatigue_multiplier`, run `migrations/20261115_ranked_fishing_permissions.sql` in SQL Editor under the trusted migration role. Do not grant client roles access to private scoring helpers: the repair runs the validated RPCs under the correct trusted owner instead. The repair is safe to rerun and does not require rerunning the schema migration or resetting seasons.

## Scoring and season boundaries

`w_norm = clamp((weight - weight_min) / (weight_max - weight_min), 0, 1)`, with the existing 0.5 fallback for fixed-weight species.

`score = w_norm^1.5 * rare_weight^2 * extreme_weight * season_weight * fatigue_score_multiplier`.

The server snapshots weight normalization, rarity weight, active weather and fatigue at cast time. Missing/expired weather is neutral (`E = 1`). It selects **season and season_weight at successful catch resolution**, after validation and other rewards, using `clock_timestamp()`. No client timestamp or score is accepted. Numeric scores are stored without display rounding; UI displays up to six decimals. Equal scores favor the later catch, then descending catch UUID for deterministic ordering at an identical timestamp.

Each season is exactly 336 hours, with `[starts_at, ends_at)` membership. At the first board read or successful scoring operation after an end, one transaction finalizes every elapsed season and creates its successor with the exact prior end as its start. A common transaction lock serializes scoring and rollover: a late transaction cannot insert into an already finalized season. This requires no cron job and introduces no gap or publication day. Even a cast spanning a boundary belongs to the season of its successful resolution. The board UI automatically refreshes at the current season boundary.

`leaderboard.best_fish` holds exactly one personal best for the current season, including its `season_id`, `session_id`, fish details, score and catch time. A successful catch replaces it only for a new season or a better score; equal scores favor the later catch, then descending catch UUID. Lower-scoring catches still grant normal rewards and increment the lifetime catch count, without creating scoring log rows.

At rollover, each player's final personal best is copied once into `fishing_season_results` with primary key `(season_id, user_id)`, then the current best fish is cleared. Archived boards read these immutable results; the current board reads `leaderboard.best_fish`. Both show each player once and use the same ranking order and pagination.

The top fish per species among these personal bests determines the three winning species. Their fish, player name, time and score are snapshotted into `fishing_hall_of_fame`. With one personal best per player, each player can represent only one winning species in new seasons. A season with fewer than three qualifying species honors only those available. Archived results and Hall of Fame snapshots have no cascading references to users, species or caught inventory, so selling/releasing fish and catalog/account changes cannot erase achievements. Existing Hall of Fame snapshots remain unchanged.

For the next season, winning species receive 0.7. Up to three distinct random species outside that group receive 1.3; eligible species must have positive spawn weight in an available fishing area. Other species reset to 1. These weights never compound. `fishing_season_meta` preserves each season's affected species and weights. After long inactivity, empty elapsed seasons still rotate with their normal dates and have no Hall of Fame winners.

Seasonal player ranks use each player's best fish. The existing lifetime score and total-caught boards retain their original repository queries and tie behavior. The shared `resolve_fishing_challenge` function in `rpc/fishing/submit_challenge.sql` increments `leaderboard.total_caught` atomically for each successful catch, including before seasons start. It creates a leaderboard row on the first catch and preserves existing lifetime scores. Failed catches and repeated submissions do not increment the count; selling or releasing fish does not decrease it.

Redeploy the complete `rpc/fishing/submit_challenge.sql` file to enable lifetime score accumulation and catch counting for both challenge types. On each successful catch, the resolver adds the server-calculated `scoring.score` to `leaderboard.score` and increments `total_caught`. Every scored catch contributes, including fish below the personal best. Missing scoring data contributes zero points. Existing totals survive season rollover, selling and releasing fish; failed catches and repeated submissions add no points. This resolver owns both increments: do not also increment them in a separate trigger. This change applies to new successful catches only; it does not reconstruct historical scores or catches.

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

## Survival fishing

Deploy `migrations/20261125_fishing_survival.sql` after ranked fishing, the fatigue preview migration, and `migrations/20261113_user_body_equipments.sql`. Then deploy the complete `rpc/fishing/cast_rod.sql`, `rpc/fishing/submit_challenge.sql`, and `rpc/fishing/submit_tension_challenge.sql` definitions, followed by the updated `migrations/20261115_ranked_fishing_permissions.sql`. Deploy the frontend last. The repository does not apply SQL to production automatically.

The fishing-area admin form controls `fishing_areas.survival_mode` (default false). Survival areas disable fatigue accumulation and all fatigue penalties, including previews and score multipliers. Existing ordinary areas retain their behavior. A cast records whether survival applies in its private mechanics snapshot.

Each successful survival catch consumes **one point in total per resource**, across the currently active saved body equipment set. The resources are `vitality`, `hydration`, `nutrition`, `energy`, and `morale`. Costs are distributed proportionally to each item's remaining contribution, with deterministic rounding, and clamp at zero. Failed, cancelled, and expired catches consume no health resources. Equipment can still be changed normally, including between casting and settlement; the active set at settlement pays the cost. This first version adds no further low-stat gameplay modifiers or recovery mechanics.

`user_inventory.data.health_bonuses` remains the original capacity. `health_remaining` stores the remaining amount by resource on the individual inventory item. Missing remaining keys use the original capacity, so existing items need no backfill. Explicit zero values remain zero. Referencing an item in multiple sets or re-equipping it cannot restore its resources.

Trips use the existing `user_in_area.session_id` / `caught.area_session_id`. When total active vitality reaches zero, the server marks that trip dead, deletes only that owner's fish with the same trip ID (including the fatal catch), and cancels unfinished casts from the trip. Fish from earlier trips and other players are preserved. Earned XP, scores, catch counts, missions, and other rewards remain permanent. No protection or recovery feature is added. A player without positive vitality also dies when their survival state is checked; changing to a fresh set cannot revive an already dead trip. A new trip has its own state.

`get_fishing_survival()` returns the caller's current trip and equipment state and settles zero-vitality deaths. It must remain uncached: it can delete trip fish. Private settlement helpers and `fishing_survival_trips` are inaccessible to player roles. Result receipts make successful submissions, resource costs, and death loss safe to retry.

The integration checks in `scripts/test-seasonal-fishing.mjs` cover ordinary-area compatibility, fatigue bypass, fractional equipment costs, active/inactive sets, equipment switches, clamping, permanent rewards, fatal catches, trip ownership, retries, and new-trip recovery. `scripts/test-health-equipment.mjs` and `scripts/test-fishing-result-recovery.mjs` cover remaining-stat presentation and client recovery after a lost fatal response.

## Verification

Run `npm run test:leaderboard`, `npm run check:i18n`, and `npm run build`. The SQL integration test runs the actual migration, cast and resolver in an isolated PGlite database; it exercises scoring snapshots, cross-boundary attribution, later-catch ties, fatigue recovery/caps/effects, archive retention, randomized disjoint meta groups and client privileges. It does not connect to production Supabase.
