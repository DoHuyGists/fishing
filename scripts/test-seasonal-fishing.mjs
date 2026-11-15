import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');

test('ranked fishing integrates server catches, fatigue, seasons, ties and permanent history', async t => {
  const db = new PGlite();
  const uid = randomUUID(), other = randomUUID(), area = randomUUID(), areaB = randomUUID();
  const species = Array.from({ length: 7 }, randomUUID);
  const weather = randomUUID(), zone = randomUUID(), country = randomUUID();
  const query = async (sql, args) => (await db.query(sql, args)).rows;
  const scalar = async (sql, args) => Object.values((await query(sql, args))[0])[0];
  const rpc = (sql, args) => scalar('SELECT ' + sql, args);
  const check = async (name, run) => { await run(); t.diagnostic(name); };
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
      CREATE SCHEMA auth; CREATE SCHEMA feature_control;
      CREATE TABLE auth.users(id UUID PRIMARY KEY);
      CREATE FUNCTION auth.uid() RETURNS UUID LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('test.uid',true),'')::UUID $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE feature_control.request_rules(feature_key TEXT,path TEXT,writes_only BOOLEAN,PRIMARY KEY(feature_key,path));
      CREATE TABLE public.user_profile(id UUID PRIMARY KEY,display_name TEXT,level INTEGER DEFAULT 1,experience_point INTEGER DEFAULT 0);
      CREATE TABLE public.leaderboard(id UUID PRIMARY KEY REFERENCES public.user_profile(id),score NUMERIC NOT NULL,
        total_caught BIGINT, best_fish JSONB, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE public.countries(id UUID PRIMARY KEY,default_timezone TEXT);
      CREATE TABLE public.weathers(id UUID PRIMARY KEY);
      CREATE TABLE public.zones(id UUID PRIMARY KEY,weather_id UUID,weather_expires_at TIMESTAMPTZ);
      CREATE TABLE public.fishing_areas(id UUID PRIMARY KEY,country_id UUID,timezone TEXT,zone_id UUID,is_available BOOLEAN DEFAULT TRUE);
      CREATE TABLE public.modifiers(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),code TEXT UNIQUE,name TEXT,unit TEXT DEFAULT 'PERCENT');
      CREATE TABLE public.species(id UUID PRIMARY KEY,name TEXT,image TEXT,rarity TEXT,weight_min NUMERIC DEFAULT 1,weight_max NUMERIC DEFAULT 10,
        fish_type TEXT DEFAULT 'TEST',strength NUMERIC DEFAULT 40,alertness NUMERIC DEFAULT 0,burst_multiplier NUMERIC DEFAULT 1.5,
        base_catch_rate NUMERIC DEFAULT 1,active_time TEXT DEFAULT 'ALL',experience_point INTEGER DEFAULT 10);
      CREATE TABLE public.depth_scope(id UUID PRIMARY KEY,min_depth NUMERIC,max_depth NUMERIC,peak_depth NUMERIC,curve_power NUMERIC);
      CREATE TABLE public.species_in_area(species_id UUID,area_id UUID,weight_rate NUMERIC,depth_scope_id UUID);
      CREATE TABLE public.user_in_area(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID UNIQUE,area_id UUID,status TEXT,session_id UUID DEFAULT gen_random_uuid());
      CREATE TABLE public.user_inventory(id UUID PRIMARY KEY,user_id UUID,data JSONB);
      CREATE TABLE public.user_equipments(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,is_used BOOLEAN DEFAULT TRUE,
        rod JSONB,reel JSONB,line JSONB,bait JSONB,hook JSONB,created_at TIMESTAMPTZ DEFAULT now());
      CREATE TABLE public.fishing_sessions(id UUID PRIMARY KEY,user_id UUID,area_id UUID,species_id UUID,secret_weight NUMERIC,
        status TEXT DEFAULT 'WAITING',challenge_data JSONB,expires_at TIMESTAMPTZ,area_session_id UUID,is_shiny BOOLEAN,
        variant_type TEXT,star_rating INTEGER,cast_depth NUMERIC,bite_at TIMESTAMPTZ);
      CREATE TABLE public.caught(id UUID PRIMARY KEY DEFAULT gen_random_uuid(),user_id UUID,species_id UUID,area_id UUID,weight NUMERIC,
        area_session_id UUID,is_shiny BOOLEAN,variant_type TEXT,star_rating INTEGER,status TEXT);
    `);
    await db.exec(await read('./supabase/migrations/equipment_mechanics.sql'));
    await db.exec(await read('./supabase/migrations/20261115_ranked_fishing.sql'));
    await db.exec(`
      INSERT INTO fishing_seasons(starts_at,ends_at)
        SELECT starts_at, starts_at+interval '336 hours' FROM (SELECT clock_timestamp()-interval '15 days' AS starts_at) initial;
      INSERT INTO fishing_score_catches(id,session_id,season_id,user_id,species_id,caught_at,score,fish,factors)
        SELECT gen_random_uuid(),gen_random_uuid(),id,gen_random_uuid(),gen_random_uuid(),starts_at,42,'{"name":"Legacy fish","score":42}','{}' FROM fishing_seasons;
      INSERT INTO fishing_hall_of_fame(season_id,rank,catch_id,user_id,species_id,fish,caught_at)
        SELECT season_id,1,id,user_id,species_id,fish,caught_at FROM fishing_score_catches;
      INSERT INTO fishing_season_meta(season_id,species_id,name,season_weight)
        SELECT season_id,species_id,'Legacy fish',0.7 FROM fishing_score_catches;
    `);
    await db.exec(await read('./supabase/migrations/20261115_ranked_fishing_uuid.sql'));
    await check('UUID upgrade preserves existing scores, Hall of Fame and meta relationships and is repeatable', async () => {
      const migrated = (await query('SELECT * FROM fishing_seasons'))[0];
      assert.match(migrated.id, /^[0-9a-f-]{36}$/);
      assert.equal(Number(migrated.season_number), 1);
      for (const table of ['fishing_score_catches', 'fishing_hall_of_fame', 'fishing_season_meta']) {
        assert.equal(await scalar(`SELECT season_id FROM ${table}`), migrated.id);
      }
      assert.equal(Number(await scalar('SELECT score FROM fishing_score_catches')), 42);
      await db.exec(await read('./supabase/migrations/20261115_ranked_fishing_uuid.sql'));
      assert.equal(await scalar('SELECT id FROM fishing_seasons'), migrated.id);
      await db.exec("UPDATE fishing_seasons SET finalized_at=ends_at");
      await db.exec(await read('./supabase/migrations/20261115_leaderboard_season_best_fish.sql'));
      const archive = await rpc('get_fishing_season_board(1,$1)', [migrated.id]);
      assert.equal(archive.total, 1);
      assert.equal(archive.items[0].best_fish.score, 42);
      assert.equal(archive.items[0].best_fish.season_id, migrated.id);
      assert.equal(archive.hall_of_fame.length, 1);
      await db.exec('DELETE FROM fishing_season_results; DELETE FROM fishing_hall_of_fame; DELETE FROM fishing_season_meta; DELETE FROM fishing_score_catches; DELETE FROM fishing_seasons;');
    });
    await db.exec(await read('./supabase/rpc/fishing/cast_rod.sql'));
    await db.exec(await read('./supabase/rpc/fishing/submit_challenge.sql'));
    await db.exec(await read('./supabase/migrations/20261115_leaderboard_season_best_fish.sql'));
    await db.query('INSERT INTO auth.users VALUES($1),($2)', [uid, other]);
    await db.query("INSERT INTO user_profile(id,display_name) VALUES($1,'Người câu cá'),($2,'Other')", [uid, other]);
    await db.query("SELECT set_config('test.uid',$1,false)", [uid]);
    await db.query("INSERT INTO countries VALUES($1,'Asia/Ho_Chi_Minh')", [country]);
    await db.query('INSERT INTO weathers VALUES($1,2)', [weather]);
    await db.query("INSERT INTO zones VALUES($1,$2,clock_timestamp()+interval '1 hour')", [zone, weather]);
    await db.query('INSERT INTO fishing_areas(id,country_id,zone_id) VALUES($1,$3,$4),($2,$3,$4)', [area, areaB, country, zone]);
    for (const [i, id] of species.entries()) {
      await db.query("INSERT INTO species(id,name,rarity,rare_weight) VALUES($1,$2,'RARE',3)", [id, `Cá ${i}`]);
      await db.query('INSERT INTO species_in_area VALUES($1,$2,$3,NULL)', [id, area, i === 0 ? 1 : 0]);
    }
    await db.query("INSERT INTO user_in_area(user_id,area_id,status) VALUES($1,$2,'enter')", [uid, area]);
    const slots = {};
    for (const [tool, data] of Object.entries({ rod: { max_weight: 100 }, reel: { pull_strength: 100 },
      line: { durability: 100 }, bait: { fish_type: ['TEST'], quantity: 1000 }, hook: { catch_rate: 1 } })) {
      const id = randomUUID();
      await db.query('INSERT INTO user_inventory VALUES($1,$2,$3)', [id, uid, data]);
      slots[tool] = [{ inventory_id: id, is_used: true }];
    }
    await db.query('INSERT INTO user_equipments(user_id,rod,reel,line,bait,hook) VALUES($1,$2,$3,$4,$5,$6)',
      [uid, slots.rod, slots.reel, slots.line, slots.bait, slots.hook]);
    const cast = async () => {
      const response = await rpc('public.cast_rod($1,10)', [area]);
      return (await query('SELECT s.*,m.fish_snapshot FROM fishing_sessions s JOIN fishing_session_mechanics m ON m.session_id=s.id WHERE s.id=$1', [response.session_id]))[0];
    };
    const resolve = async session => {
      await db.query("UPDATE fishing_sessions SET status='BITE',bite_at=clock_timestamp()-interval '1 second',expires_at=clock_timestamp()+interval '90 seconds' WHERE id=$1", [session.id]);
      const before = Number(await scalar('SELECT COALESCE((SELECT total_caught FROM leaderboard WHERE id=$1),0)', [uid]));
      const scoreBefore = Number(await scalar('SELECT COALESCE((SELECT score FROM leaderboard WHERE id=$1),0)', [uid]));
      const result = await rpc('public.resolve_fishing_challenge($1,TRUE,1000)', [session.id]);
      assert.equal(Number(await scalar('SELECT COALESCE((SELECT total_caught FROM leaderboard WHERE id=$1),0)', [uid])), before + (result.success ? 1 : 0));
      const scoreAfter = Number(await scalar('SELECT COALESCE((SELECT score FROM leaderboard WHERE id=$1),0)', [uid]));
      assert.ok(Math.abs(scoreAfter - (scoreBefore + (result.success ? result.scoring?.score ?? 0 : 0))) < 1e-10);
      return result;
    };

    await check('repair handles invoker wrappers and legacy owners without exposing helpers to players', async () => {
      const repair = await read('./supabase/migrations/20261115_ranked_fishing_permissions.sql');
      await db.exec(`
        ALTER FUNCTION public.cast_rod(UUID,NUMERIC) SECURITY INVOKER;
        GRANT SELECT ON public.user_in_area TO authenticated;
        SET ROLE authenticated;
      `);
      await assert.rejects(rpc('cast_rod($1,10)', [area]), /permission denied for function fishing_fatigue_multiplier/);
      await db.exec('RESET ROLE');
      await db.exec(repair);
      await db.exec('SET ROLE authenticated');
      assert.ok((await rpc('cast_rod($1,10)', [area])).session_id);
      await assert.rejects(rpc("fishing_fatigue_multiplier('[]','score')"), /permission denied/);
      await db.exec(`
        RESET ROLE;
        CREATE ROLE legacy_fishing_owner;
        GRANT USAGE ON SCHEMA auth TO legacy_fishing_owner;
        GRANT SELECT ON public.user_in_area TO legacy_fishing_owner;
        GRANT EXECUTE ON FUNCTION public.touch_fishing_presence() TO legacy_fishing_owner;
        ALTER FUNCTION public.cast_rod(UUID,NUMERIC) OWNER TO legacy_fishing_owner;
        SET ROLE authenticated;
      `);
      await assert.rejects(rpc('cast_rod($1,10)', [area]), /permission denied for function fishing_fatigue_multiplier/);
      await db.exec('RESET ROLE');
      await db.exec(repair);
      await db.exec(repair); // Reapplying must preserve privileges and data.
      await db.exec('SET ROLE authenticated');
      assert.ok((await rpc('cast_rod($1,10)', [area])).session_id);
      await assert.rejects(rpc('resolve_fishing_challenge($1,TRUE,1000)', [randomUUID()]), /permission denied/);
      await db.exec('RESET ROLE; REVOKE SELECT ON public.user_in_area FROM authenticated');
    });

    await check('fatigue caps occupied time before recovery and preserves fractions', async () => {
      const value = (score, at, until, now) => rpc('public.fishing_fatigue_value($1,$2,$3,$4)', [score, at, until, now]).then(Number);
      assert.equal(await value(90, '2026-01-01T00:00Z', '2026-01-01T00:20Z', '2026-01-01T00:25Z'), 95);
      assert.equal(await value(10, '2026-01-01T00:00Z', null, '2026-01-01T00:30Z'), 0);
      assert.equal(await value(0, '2026-01-01T00:00Z', '2026-01-01T00:02Z', '2026-01-01T00:00:30Z'), 0.5);
      await db.query("UPDATE user_area_fatigue SET fatigue_score=20,calculated_at=clock_timestamp()-interval '30 seconds',active_until=clock_timestamp()+interval '1 minute' WHERE user_id=$1", [uid]);
      const heartbeat = await rpc('touch_fishing_presence()');
      assert.ok(heartbeat.fatigue_score >= 20.5 && heartbeat.fatigue_score < 20.6);
      await db.query('UPDATE user_in_area SET area_id=$1 WHERE user_id=$2', [areaB, uid]);
      await db.query("UPDATE user_area_fatigue SET calculated_at=clock_timestamp()-interval '5 minutes' WHERE user_id=$1 AND area_id=$2", [uid, area]);
      await db.query('UPDATE user_in_area SET area_id=$1 WHERE user_id=$2', [area, uid]);
      const returned = await rpc('touch_fishing_presence()');
      assert.ok(returned.fatigue_score >= 15.5 && returned.fatigue_score < 15.6);
      await db.query("UPDATE user_area_fatigue SET fatigue_score=30,calculated_at=clock_timestamp()-interval '10 minutes',active_until=clock_timestamp()-interval '8 minutes' WHERE user_id=$1 AND area_id=$2", [uid, area]);
      assert.ok(Math.abs((await rpc('touch_fishing_presence()')).fatigue_score - 24) < 0.1);
    });

    await check('lifetime catch count is awarded before seasons start and retries cannot increment it', async () => {
      const session = await cast();
      const result = await resolve(session);
      assert.equal(result.success, true);
      assert.equal(Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1', [uid])), 1);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_score_catches')), 0);
      await assert.rejects(rpc('resolve_fishing_challenge($1,TRUE,1000)', [session.id]), /already processed/);
      assert.equal(Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1', [uid])), 1);

      await db.query('UPDATE leaderboard SET total_caught=NULL,score=123,best_fish=$2 WHERE id=$1', [uid, { id: 'existing-record' }]);
      assert.equal((await resolve(await cast())).success, true);
      const row = (await query('SELECT * FROM leaderboard WHERE id=$1', [uid]))[0];
      assert.equal(Number(row.total_caught), 1);
      assert.equal(Number(row.score), 123);
      assert.deepEqual(row.best_fish, { id: 'existing-record' });
    });

    await check('actual cast and resolver freeze factors and compute the agreed score', async () => {
      assert.equal((await rpc('get_fishing_season_board()')).season, null);
      await rpc("start_fishing_seasons(clock_timestamp()-interval '1 day')");
      const session = await cast();
      assert.equal(session.fish_snapshot.scoring.rare_weight, 3);
      assert.equal(session.fish_snapshot.scoring.extreme_weight, 2);
      assert.equal(session.challenge_data.scoring, undefined);
      await db.query('UPDATE species SET rare_weight=9 WHERE id=$1', [species[0]]);
      await db.query('UPDATE weathers SET extreme_weight=5');
      const result = await resolve(session);
      const expected = session.fish_snapshot.weight_ratio ** 1.5 * 9 * 2;
      assert.ok(Math.abs(result.scoring.score - expected) < 1e-10);
      assert.equal(result.scoring.factors.rare_weight, 3);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_score_catches')), 0);
      assert.equal((await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid])).id, result.caught.id);
      assert.equal((await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid])).season_id, result.scoring.season_id);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_season_results')), 0);
      const scoreAfterCatch = Number(await scalar('SELECT score FROM leaderboard WHERE id=$1', [uid]));
      assert.ok(Math.abs(scoreAfterCatch - (123 + expected)) < 1e-10);
      await assert.rejects(rpc('resolve_fishing_challenge($1,TRUE,1000)', [session.id]), /already processed/);
      assert.equal(Number(await scalar('SELECT score FROM leaderboard WHERE id=$1', [uid])), scoreAfterCatch);
      const board = await rpc('get_fishing_season_board()');
      assert.equal(board.my_entry.rank, 1);
      assert.match(result.scoring.season_id, /^[0-9a-f-]{36}$/);
      assert.equal(result.scoring.season_number, 1);
      assert.equal(board.season.season_number, 1);
      assert.equal(board.items[0].best_fish.id, result.caught.id);
      await db.query('UPDATE species SET rare_weight=3 WHERE id=$1', [species[0]]);
      await db.query('UPDATE weathers SET extreme_weight=2');
    });

    await check('configured effects cap weight, compose score penalties and can suppress rare encounters', async () => {
      const mod = randomUUID();
      await db.query("INSERT INTO modifiers(id,code,name) VALUES($1,'FATIGUE_WEIGHT','Mệt mỏi')", [mod]);
      await db.query("INSERT INTO fatigue_effects(modifier_id,min_fatigue,target,value) VALUES($1,0,'weight_cap',-50),($1,1,'score',-10)", [mod]);
      const session = await cast();
      assert.ok(session.fish_snapshot.weight_ratio <= 0.5);
      assert.ok(session.secret_weight <= 5.5);
      assert.ok(Math.abs(session.fish_snapshot.scoring.fatigue_multiplier - 0.9) < 1e-10);
      const result = await resolve(session);
      assert.ok(Math.abs(result.scoring.score - session.fish_snapshot.weight_ratio ** 1.5 * 9 * 2 * 0.9) < 1e-10);
      await db.query("INSERT INTO fatigue_effects(modifier_id,min_fatigue,target,value) VALUES($1,2,'rare_spawn',-100)", [mod]);
      const failedCast = await cast();
      assert.equal(failedCast.species_id, null);
      const bestBeforeFailure = await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid]);
      assert.equal((await resolve(failedCast)).success, false);
      assert.deepEqual(await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid]), bestBeforeFailure);
      await db.exec('DELETE FROM fatigue_effects');
      await db.query("UPDATE zones SET weather_expires_at=clock_timestamp()-interval '1 minute'");
      assert.equal((await cast()).fish_snapshot.scoring.extreme_weight, 1);
      await db.query("UPDATE zones SET weather_expires_at=clock_timestamp()+interval '1 hour'");
    });

    await check('successful lower catches retain the best fish and equal scores favor the later catch', async () => {
      const saved = await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid]);
      await db.query("UPDATE leaderboard SET best_fish=jsonb_set(best_fish,'{score}','1000') WHERE id=$1", [uid]);
      const strong = await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid]);
      assert.equal((await resolve(await cast())).success, true);
      assert.deepEqual(await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid]), strong);
      await db.query('UPDATE leaderboard SET best_fish=$2 WHERE id=$1', [uid, saved]);
      const maxCatch = async () => {
        const session = await cast();
        await db.query("UPDATE fishing_session_mechanics SET fish_snapshot=jsonb_set(fish_snapshot,'{scoring,w_norm}','1') WHERE session_id=$1", [session.id]);
        return resolve(session);
      };
      const first = await maxCatch();
      const second = await maxCatch();
      assert.equal(first.scoring.score, second.scoring.score);
      assert.equal((await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid])).id, second.caught.id);
      assert.equal((await rpc('get_fishing_season_board()')).total, 1);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_score_catches')), 0);
    });

    await check('upgrade migrates existing best catches and reruns preserve newer live records', async () => {
      const season = (await rpc('get_fishing_season_board()')).season;
      const saved = await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid]);
      const ids = [randomUUID(), randomUUID()];
      for (let index = 0; index < 2; index++) {
        const at = new Date(Date.now() - 60000 + index).toISOString();
        const fish = { ...saved, id: ids[index], score: 500 + index, caught_at: at };
        await db.query('INSERT INTO fishing_score_catches VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',
          [ids[index], randomUUID(), season.id, uid, species[0], at, fish.score, fish, 'Legacy name', {}]);
      }
      const upgrade = await read('./supabase/migrations/20261115_leaderboard_season_best_fish.sql');
      await db.exec(upgrade);
      assert.equal((await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid])).id, ids[1]);
      await db.query("UPDATE leaderboard SET best_fish=jsonb_set(best_fish,'{score}','600') WHERE id=$1", [uid]);
      await db.exec(upgrade);
      assert.equal((await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid])).score, 600);
      assert.equal((await rpc('get_fishing_season_board()')).total, 1);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_score_catches')), 2);
      await db.query('UPDATE leaderboard SET best_fish=$2 WHERE id=$1', [uid, saved]);
    });

    // Seed personal bests; a lower catch never replaces an existing best.
    const season = (await rpc('get_fishing_season_board()')).season;
    const add = async (player, sp, score, at, id = randomUUID()) => {
      const fish = { id, species_id: sp, name: 'Cá kỷ lục', image: null, rarity: 'RARE', weight: 10, score, caught_at: at, season_id: season.id, display_name: 'Tên lưu trữ' };
      await db.query("INSERT INTO user_profile(id,display_name) VALUES($1,'Tên lưu trữ') ON CONFLICT DO NOTHING", [player]);
      await db.query(`INSERT INTO leaderboard AS board(id,score,total_caught,best_fish,created_at,updated_at)
        VALUES($1,0,0,$2,$3,$3) ON CONFLICT(id) DO UPDATE SET best_fish=EXCLUDED.best_fish
        WHERE (($2->>'score')::numeric,($2->>'caught_at')::timestamptz,($2->>'id')::uuid) >
          ((board.best_fish->>'score')::numeric,(board.best_fish->>'caught_at')::timestamptz,(board.best_fish->>'id')::uuid)`, [player, fish, at]);
      return id;
    };
    const speciesWinners = [other, randomUUID(), randomUUID()];
    await check('later equal catches win both species records and player ranks across pages', async () => {
      const old = new Date(Date.now() - 120000).toISOString(), recent = new Date(Date.now() - 60000).toISOString();
      await add(uid, species[0], 100, old);
      const winner = await add(other, species[0], 100, recent);
      await add(uid, species[1], 90, recent);
      await add(uid, species[2], 80, recent);
      await add(speciesWinners[1], species[1], 90, recent);
      await add(speciesWinners[2], species[2], 80, recent);
      for (let i = 0; i < 12; i++) await add(randomUUID(), species[3], 10, new Date(Date.now() - 10000 + i).toISOString());
      const board = await rpc('get_fishing_season_board()');
      assert.equal(board.items[0].id, other);
      assert.equal(board.items[0].best_fish.id, winner);
      assert.equal(board.my_entry.rank, 2);
      assert.equal(board.total, 16);
      assert.equal(board.items.filter(entry => entry.id === uid).length, 1);
      assert.equal(board.my_entry.best_fish.score, 100);
      assert.deepEqual((await rpc('get_fishing_season_board(2)')).items.map(e => e.rank), [11, 12, 13, 14, 15, 16]);
    });

    await check('exact boundary rotates once, snapshots top species and selects disjoint random boosts', async () => {
      await db.query('UPDATE species_in_area SET weight_rate=1');
      assert.equal(await rpc("fishing_ensure_season($1::timestamptz-interval '1 microsecond')", [season.ends_at]), season.id);
      const newSeason = await rpc('fishing_ensure_season($1)', [season.ends_at]);
      assert.notEqual(newSeason, season.id);
      assert.equal(await rpc('fishing_ensure_season($1)', [season.ends_at]), newSeason);
      assert.equal(Number(await scalar('SELECT season_number FROM fishing_seasons WHERE id=$1', [newSeason])), 2);
      const fame = await query('SELECT * FROM fishing_hall_of_fame ORDER BY rank');
      assert.deepEqual(fame.map(r => r.species_id), species.slice(0, 3));
      assert.deepEqual(fame.map(r => r.user_id), speciesWinners);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_season_results WHERE season_id=$1', [season.id])), 16);
      assert.equal(Number(await scalar('SELECT count(*) FROM leaderboard WHERE best_fish IS NOT NULL')), 0);
      const meta = await query('SELECT * FROM fishing_season_meta WHERE season_id=$1', [newSeason]);
      assert.equal(meta.length, 6);
      assert.equal(meta.filter(r => Number(r.season_weight) === 0.7).length, 3);
      assert.equal(meta.filter(r => Number(r.season_weight) === 1.3).length, 3);
      assert.ok(meta.filter(r => Number(r.season_weight) === 1.3).every(r => !species.slice(0, 3).includes(r.species_id)));
      await db.query("UPDATE species SET name='Đã đổi tên'");
      const totalBeforeRelease = Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1', [uid]));
      await db.exec('DELETE FROM caught');
      assert.equal(Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1', [uid])), totalBeforeRelease);
      assert.equal((await query('SELECT fish FROM fishing_hall_of_fame LIMIT 1'))[0].fish.name, 'Cá kỷ lục');
      await db.query('UPDATE species_in_area SET weight_rate=CASE WHEN species_id=$1 THEN 1 ELSE 0 END', [species[0]]);
      const spanningCast = await cast();
      // At a real boundary, a cast from the previous season is scored with the
      // NEW season and its 0.7 coefficient. Move schedule into the present.
      await db.query("UPDATE fishing_seasons SET starts_at=starts_at-interval '14 days',ends_at=ends_at-interval '14 days'");
      const result = await resolve(spanningCast);
      assert.equal(result.scoring.season_id, newSeason);
      assert.equal(result.scoring.factors.season_weight, 0.7);
      assert.equal((await rpc('get_fishing_season_board(1,$1)', [season.id])).hall_of_fame.length, 3);
      const archive = await rpc('get_fishing_season_board(2,$1)', [season.id]);
      assert.equal(archive.total, 16);
      assert.deepEqual(archive.items.map(entry => entry.rank), [11, 12, 13, 14, 15, 16]);
      assert.equal(archive.my_entry.best_fish.score, 100);
      assert.equal((await rpc('get_fishing_season_board()')).total, 1);
      assert.equal((await scalar('SELECT best_fish FROM leaderboard WHERE id=$1', [uid])).id, result.caught.id);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_score_catches')), 2);
    });

    await check('empty elapsed seasons preserve continuous dates and reset weights without compounding', async () => {
      const latest = (await rpc('get_fishing_season_board()')).season;
      const afterEmpty = await rpc("fishing_ensure_season($1::timestamptz+interval '14 days')", [latest.ends_at]);
      const schedules = await query('SELECT * FROM fishing_seasons ORDER BY starts_at');
      for (let i = 1; i < schedules.length; i++) assert.equal(+schedules[i].starts_at, +schedules[i-1].ends_at);
      const empty = schedules[schedules.length - 2];
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_hall_of_fame WHERE season_id=$1', [empty.id])), 0);
      const meta = await query('SELECT season_weight FROM fishing_season_meta WHERE season_id=$1', [afterEmpty]);
      assert.ok(meta.every(m => Number(m.season_weight) === 1.3));
      const weights = await query('SELECT season_weight FROM species');
      assert.ok(weights.every(s => [1, 1.3].includes(Number(s.season_weight))));
    });

    await check('clients cannot forge scores, mutate fatigue or rotate with a chosen clock', async () => {
      await db.exec('SET ROLE authenticated');
      await assert.rejects(db.query('INSERT INTO fishing_score_catches(id) VALUES($1)', [randomUUID()]), /permission denied/);
      await assert.rejects(db.exec("UPDATE leaderboard SET best_fish='{}'"), /permission denied/);
      await assert.rejects(db.exec('DELETE FROM fishing_season_results'), /permission denied/);
      await assert.rejects(db.exec('UPDATE user_area_fatigue SET fatigue_score=0'), /permission denied/);
      await assert.rejects(rpc('fishing_ensure_season(clock_timestamp())'), /permission denied/);
      await assert.rejects(rpc('record_fishing_score($1,$2)', [randomUUID(), randomUUID()]), /permission denied/);
      assert.ok((await rpc('touch_fishing_presence()')).area_id);
      // The test advanced the private clock into future empty seasons.
      // Public RPCs cannot accept this chosen clock or expose future schedules.
      assert.equal((await rpc('get_fishing_season_board()')).season, null);
      await db.exec('RESET ROLE; SET ROLE anon');
      await db.query("SELECT set_config('test.uid','',false)");
      assert.equal((await rpc('get_fishing_season_board()')).my_entry, null);
      await assert.rejects(rpc('touch_fishing_presence()'), /permission denied/);
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('test.uid',$1,false)", [uid]);
      await db.query("UPDATE user_in_area SET status=NULL WHERE user_id=$1", [uid]);
      await assert.rejects(rpc('touch_fishing_presence()'), /not in a fishing area/);
      await assert.rejects(cast(), /not in this fishing area/);
      await assert.rejects(db.exec("UPDATE species SET rare_weight='NaN'"), /check constraint/);
      await assert.rejects(db.exec('UPDATE weathers SET extreme_weight=0'), /check constraint/);
      assert.equal(Number(await scalar("SELECT count(*) FROM feature_control.request_rules WHERE feature_key='leaderboard' AND path='rpc/get_fishing_season_board'")), 1);
    });
  } finally { await db.close(); }
});
