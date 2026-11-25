import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { isTensionChallenge, createTensionFight, stepTensionFight } from '../src/data/tensionChallenge.ts';

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
      CREATE TABLE daily_mission_events(id BIGINT GENERATED ALWAYS AS IDENTITY,user_id UUID,event_type TEXT,value NUMERIC);
      CREATE FUNCTION public.update_daily_mission_progress(event_type TEXT,value NUMERIC DEFAULT 1) RETURNS VOID LANGUAGE sql AS $$
        INSERT INTO daily_mission_events(user_id,event_type,value) VALUES(auth.uid(),event_type,value);
      $$;
      GRANT USAGE ON SCHEMA auth TO authenticated;
      CREATE TABLE feature_control.request_rules(feature_key TEXT,path TEXT,writes_only BOOLEAN,PRIMARY KEY(feature_key,path));
      CREATE TABLE public.user_profile(id UUID PRIMARY KEY,display_name TEXT,level INTEGER DEFAULT 1,experience_point INTEGER DEFAULT 0);
      CREATE TABLE public.leaderboard(id UUID PRIMARY KEY REFERENCES public.user_profile(id),score NUMERIC NOT NULL,
        total_caught BIGINT, best_fish JSONB, created_at TIMESTAMPTZ NOT NULL, updated_at TIMESTAMPTZ NOT NULL);
      CREATE TABLE public.countries(id UUID PRIMARY KEY,default_timezone TEXT);
      CREATE TABLE public.weathers(id UUID PRIMARY KEY);
      CREATE TABLE public.zones(id UUID PRIMARY KEY,weather_id UUID,weather_expires_at TIMESTAMPTZ,weather_active_modifiers JSONB DEFAULT '[]');
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
    const depthToolMigration = await read('./supabase/migrations/20261118_fishing_area_depth_tool.sql');
    await db.exec(depthToolMigration);
    await db.exec(await read('./supabase/migrations/20261113_user_body_equipments.sql'));
    await db.exec(await read('./supabase/migrations/20261125_fishing_survival.sql'));
    await db.exec(await read('./supabase/rpc/fishing/cast_rod.sql'));
    await db.exec(await read('./supabase/rpc/fishing/submit_challenge.sql'));
    await db.exec(await read('./supabase/migrations/20261115_leaderboard_season_best_fish.sql'));
    await db.query('INSERT INTO auth.users VALUES($1),($2)', [uid, other]);
    await db.query("INSERT INTO user_profile(id,display_name) VALUES($1,'Người câu cá'),($2,'Other')", [uid, other]);
    await db.query("SELECT set_config('test.uid',$1,false)", [uid]);
    await db.query("INSERT INTO countries VALUES($1,'Asia/Ho_Chi_Minh')", [country]);
    await db.query('INSERT INTO weathers VALUES($1,2)', [weather]);
    await db.query("INSERT INTO zones(id,weather_id,weather_expires_at) VALUES($1,$2,clock_timestamp()+interval '1 hour')", [zone, weather]);
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
    const cast = async (depth = 10) => {
      const eventsBefore = Number(await scalar('SELECT count(*) FROM daily_mission_events'));
      const response = await rpc('public.cast_rod($1,$2)', [area, depth]);
      assert.equal(Number(await scalar('SELECT count(*) FROM daily_mission_events')), eventsBefore + 1);
      assert.deepEqual((await query('SELECT user_id,event_type,value FROM daily_mission_events ORDER BY id DESC LIMIT 1'))[0], { user_id: uid, event_type: 'CAST_ROD', value: '1' });
      return (await query('SELECT s.*,m.fish_snapshot,m.modifiers,m.equipment_snapshot,m.balance,m.failure_reason FROM fishing_sessions s JOIN fishing_session_mechanics m ON m.session_id=s.id WHERE s.id=$1', [response.session_id]))[0];
    };
    const resolve = async session => {
      await db.query("UPDATE fishing_sessions SET status='BITE',bite_at=clock_timestamp()-interval '1 second',expires_at=clock_timestamp()+interval '90 seconds' WHERE id=$1", [session.id]);
      const before = Number(await scalar('SELECT COALESCE((SELECT total_caught FROM leaderboard WHERE id=$1),0)', [uid]));
      const scoreBefore = Number(await scalar('SELECT COALESCE((SELECT score FROM leaderboard WHERE id=$1),0)', [uid]));
      const missionEventsBefore = Number(await scalar('SELECT count(*) FROM daily_mission_events'));
      const baitBefore = Number(await scalar("SELECT data->>'quantity' FROM user_inventory WHERE id=$1", [slots.bait[0].inventory_id]));
      const result = await rpc('public.resolve_fishing_challenge($1,TRUE,1000)', [session.id]);
      const baitAfter = Number(await scalar("SELECT data->>'quantity' FROM user_inventory WHERE id=$1", [slots.bait[0].inventory_id]));
      const expectedEvents = [];
      if (baitAfter === baitBefore - 1) expectedEvents.push({ user_id: uid, event_type: 'USE_BAIT', value: 1 });
      else assert.equal(baitAfter, baitBefore);
      if (result.success) {
        expectedEvents.push({ user_id: uid, event_type: 'CATCH_FISH', value: 1 }, { user_id: uid, event_type: 'CATCH_WEIGHT', value: Number(session.secret_weight) });
        if (result.caught.rarity.toUpperCase() === 'EPIC') expectedEvents.push({ user_id: uid, event_type: 'CATCH_EPIC', value: 1 });
      }
      const actualEvents = await query('SELECT user_id,event_type,value FROM daily_mission_events ORDER BY id OFFSET $1', [missionEventsBefore]);
      assert.deepEqual(actualEvents.map(event => ({ ...event, value: Number(event.value) })), expectedEvents);
      assert.equal(Number(await scalar('SELECT COALESCE((SELECT total_caught FROM leaderboard WHERE id=$1),0)', [uid])), before + (result.success ? 1 : 0));
      const scoreAfter = Number(await scalar('SELECT COALESCE((SELECT score FROM leaderboard WHERE id=$1),0)', [uid]));
      assert.ok(Math.abs(scoreAfter - (scoreBefore + (result.success ? result.scoring?.score ?? 0 : 0))) < 1e-10);
      return result;
    };

    const weatherEffect = (code, value, unit = 'PERCENT', extra = {}) => ({ code, value, unit, ...extra });
    const setWeather = effects => db.query('UPDATE zones SET weather_active_modifiers=$1 WHERE id=$2', [JSON.stringify(effects), zone]);
    const weatherTransaction = async run => {
      await db.exec('BEGIN');
      try { await run(); } finally { await db.exec('ROLLBACK'); }
    };

    await check('weather registry accepts all 42 catalog codes and safely rejects malformed data', () => weatherTransaction(async () => {
      const codes = [
        'MAX_WEIGHT','PULL_STRENGTH','DURABILITY','CATCH_RATE','LUCK_BONUS','FISH_STRENGTH','CATCH_PROBABILITY',
        'SPAWN_ADD','SPAWN_MULTIPLIER','RARE_SPAWN','MATCHED_ATTRACTION','UNMATCHED_ATTRACTION',
        'MATCHED_CATCH_FACTOR','UNMATCHED_CATCH_FACTOR','WEIGHT_CAP','FISH_WEIGHT_BIAS','FISH_WEIGHT','ALERTNESS',
        'WAIT_TIME','REEL_SPEED','FIGHT_SECONDS','START_DISTANCE','BURST_CHANCE','BURST_MULTIPLIER','STAMINA_DRAIN',
        'SAFE_MIN_RATIO','SAFE_MAX_RATIO','START_TENSION_RATIO','SLACK_ESCAPE_SECONDS','SLACK_DISTANCE_RATE',
        'SLACK_THRESHOLD_RATIO','FISH_PULL_MULTIPLIER','REEL_RATE','RELEASE_RATE','PULL_PERIOD_TICKS',
        'BURST_MIN_TICKS','BURST_MAX_TICKS','BASE_PULL','PULL_AMPLITUDE','MINIMUM_STRENGTH','EXTREME_WEIGHT','FATIGUE_SCORE',
      ];
      assert.equal(codes.length, 42);
      const effects = codes.map(code => weatherEffect(code, 10, ['SPAWN_ADD','LUCK_BONUS'].includes(code) ? 'POINT' : 'PERCENT'));
      const normalized = await rpc('fishing_weather_modifiers($1)', [effects]);
      assert.equal(normalized.applied.length, 42);
      assert.deepEqual(normalized.ignored, []);
      const mixed = await rpc('fishing_weather_modifiers($1)', [[weatherEffect('LUCK_BONUS', 2, 'POINT'),
        weatherEffect('LUCK_BONUS', 50), weatherEffect('LUCK_DOWN', -1, 'POINT')]]);
      assert.equal(Number(await rpc("fishing_effective_stat(0,$1,'luck_bonus')", [mixed.stats])), 1.5);
      assert.equal(Number(await rpc("fishing_weather_spawn_weight(10,NULL,'{}')")), 10);
      const invalid = [null, 123, {}, weatherEffect('UNKNOWN', 1), weatherEffect('MAX_WEIGHT', '10'),
        weatherEffect('MAX_WEIGHT', 1, 'KG'), weatherEffect('MAX_WEIGHT', 1, 'POINT'),
        weatherEffect('SPAWN_ADD', 1), weatherEffect('LUCK_BONUS', 1000001, 'POINT'),
        weatherEffect('SPAWN_MULTIPLIER', 10, 'PERCENT', { rarity: 'INVALID' })];
      const bad = await rpc('fishing_weather_modifiers($1)', [JSON.stringify(invalid)]);
      assert.deepEqual(bad.stats, {});
      assert.equal(bad.ignored.length, invalid.length);
      for (const value of [null, {}, 'invalid']) {
        await setWeather(value);
        assert.equal((await cast()).equipment_snapshot.effective.max_weight, 100);
      }
      await setWeather(invalid);
      assert.equal((await cast()).modifiers._weather.ignored.length, invalid.length);
    }));

    await check('weather uses the current area zone, relative percentages, luck points and immutable snapshots', () => weatherTransaction(async () => {
      await rpc("start_fishing_seasons(clock_timestamp()-interval '1 day')");
      const effects = [weatherEffect('MAX_WEIGHT', 20), weatherEffect('MAX_WEIGHT', -10),
        weatherEffect('PULL_STRENGTH', 50), weatherEffect('DURABILITY', 50),
        weatherEffect('LUCK_BONUS', 50, 'POINT'), weatherEffect('FISHING_SPEED_DOWN', 18.46),
        weatherEffect('EXTREME_WEIGHT', 50), weatherEffect('FATIGUE_SCORE', -20)];
      await setWeather(effects);
      const session = await cast();
      const effective = session.equipment_snapshot.effective;
      assert.equal(effective.max_weight, 108);
      assert.equal(effective.pull_strength, 150);
      assert.equal(effective.durability, 150);
      assert.equal(effective.luck_bonus, 50);
      assert.equal(session.is_shiny, true);
      assert.equal(session.fish_snapshot.scoring.extreme_weight, 3);
      assert.equal(session.fish_snapshot.scoring.fatigue_multiplier, 0.8);
      assert.equal(session.modifiers._weather.zone_id, zone);
      assert.deepEqual(session.modifiers._weather.effects, effects);
      const baseSpeed = 2 * (1 + 150 / session.fish_snapshot.effective_strength);
      assert.equal(session.challenge_data.config.reelSpeed, Math.round(baseSpeed * 0.8154 * 10000) / 10000);
      assert.equal(session.challenge_data._weather, undefined);

      await setWeather([]);
      const saved = await scalar('SELECT modifiers FROM fishing_session_mechanics WHERE session_id=$1', [session.id]);
      assert.deepEqual(saved, session.modifiers);
      const outcome = await resolve(session);
      assert.equal(outcome.scoring.factors.extreme_weight, 3);
      assert.equal(outcome.scoring.factors.fatigue_multiplier, 0.8);

      const otherZone = randomUUID();
      await db.query('INSERT INTO zones(id,weather_id,weather_expires_at,weather_active_modifiers) VALUES($1,$2,clock_timestamp()+interval \'1 hour\',$3)',
        [otherZone, weather, [weatherEffect('MAX_WEIGHT', -50)]]);
      await db.query('UPDATE fishing_areas SET zone_id=$1 WHERE id=$2', [otherZone, area]);
      assert.equal((await cast()).equipment_snapshot.effective.max_weight, 50);
      await db.query("UPDATE zones SET weather_expires_at=clock_timestamp()-interval '1 second' WHERE id=$1", [otherZone]);
      const expired = await cast();
      assert.equal(expired.equipment_snapshot.effective.max_weight, 100);
      assert.equal(expired.fish_snapshot.scoring.extreme_weight, 1);
      assert.deepEqual(expired.modifiers._weather.applied, []);
      await db.query('UPDATE fishing_areas SET zone_id=NULL WHERE id=$1', [area]);
      assert.equal((await cast()).equipment_snapshot.effective.max_weight, 100);
    }));

    await check('weather changes fish weight before strength, rod checks and hook rolls', () => weatherTransaction(async () => {
      const seededCast = async effects => {
        await setWeather(effects); await db.exec('SELECT setseed(0.42)'); return cast();
      };
      const neutral = await seededCast([]);
      const heavy = await seededCast([weatherEffect('FISH_WEIGHT_BIAS', 100)]);
      assert.ok(heavy.fish_snapshot.weight > neutral.fish_snapshot.weight);
      assert.ok(heavy.fish_snapshot.effective_strength > neutral.fish_snapshot.effective_strength);
      const capped = await seededCast([weatherEffect('WEIGHT_CAP', -50), weatherEffect('FISH_WEIGHT', 1000000)]);
      assert.ok(capped.fish_snapshot.weight <= 5.5);
      assert.ok(capped.fish_snapshot.weight_ratio <= 0.5);
      const light = await seededCast([weatherEffect('FISH_WEIGHT_DOWN', 100)]);
      assert.equal(light.fish_snapshot.weight, 1);
      const overweight = await seededCast([weatherEffect('MAX_WEIGHT', -100)]);
      assert.equal(overweight.failure_reason, 'ROD_OVERWEIGHT');
      assert.equal(overweight.species_id, null);
      const missed = await seededCast([weatherEffect('CATCH_PROBABILITY', -100)]);
      assert.equal(missed.failure_reason, 'HOOK_MISSED');
      await db.query('UPDATE species SET alertness=0.2,base_catch_rate=0.2 WHERE id=$1', [species[0]]);
      await db.query("UPDATE user_inventory SET data=jsonb_set(data,'{catch_rate}','0.2') WHERE id=$1", [slots.hook[0].inventory_id]);
      const hooked = await seededCast([weatherEffect('CATCH_RATE', 50), weatherEffect('ALERTNESS', 50),
        weatherEffect('MATCHED_CATCH_FACTOR', 20), weatherEffect('CATCH_PROBABILITY', 10)]);
      assert.ok(Math.abs(hooked.fish_snapshot.catch_probability - (0.2 + 0.3) * 0.7 * 1.2 * 1.1) < 1e-12);
    }));

    await check('weather rarity scopes affect actual encounters and preview weights, preserving zero-weight exclusions', () => weatherTransaction(async () => {
      const effects = [weatherEffect('EPIC_CATCH_RATE', 18.82), weatherEffect('SPAWN_ADD', 2, 'POINT', { rarity: 'EPIC' }),
        weatherEffect('RARE_SPAWN', -50)];
      const normalized = await rpc('fishing_weather_modifiers($1)', [effects]);
      assert.ok(Math.abs(Number(await rpc('fishing_weather_spawn_weight(10,\'EPIC\',$1)', [normalized.stats])) - 7.1292) < 1e-12);
      assert.equal(Number(await rpc('fishing_weather_spawn_weight(10,\'COMMON\',$1)', [normalized.stats])), 10);
      await db.query("UPDATE species SET rarity='EPIC' WHERE id=$1", [species[0]]);
      await setWeather([weatherEffect('SPAWN_MULTIPLIER', -100, 'PERCENT', { rarity: 'EPIC' })]);
      assert.equal((await cast()).failure_reason, 'NO_FISH');
      await setWeather([weatherEffect('SPAWN_ADD', 1000, 'POINT', { rarity: 'LEGENDARY' })]);
      // Weather cannot enable species with weight_rate=0.
      assert.equal((await cast()).fish_snapshot.species_id, species[0]);
      await db.exec('ALTER TABLE species ADD COLUMN information TEXT; CREATE TABLE caught_diary(user_id UUID,species_id UUID);');
      await db.exec(await read('./supabase/rpc/fishing/preview_fish_by_depth.sql'));
      await db.query("UPDATE species SET rarity='COMMON' WHERE id=$1", [species[0]]);
      await db.query("UPDATE species SET rarity='EPIC' WHERE id=$1", [species[1]]);
      await db.query('UPDATE species_in_area SET weight_rate=1 WHERE species_id=$1', [species[1]]);
      await setWeather([weatherEffect('EPIC_CATCH_RATE', 100)]);
      const preview = await rpc('preview_fish_by_depth(10)');
      const epic = preview.fishes.find(fish => fish.species_id === species[1]);
      assert.equal(epic.spawn_weight, 2);
      assert.equal(epic.spawn_chance, 66.67);
      await setWeather([weatherEffect('EPIC_CATCH_RATE', -100)]);
      assert.equal((await rpc('preview_fish_by_depth(10)')).total_species, 1);
    }));

    await check('extreme weather keeps challenges valid and JavaScript/SQL replay identical', () => weatherTransaction(async () => {
      const sql = await read('./supabase/rpc/fishing/submit_tension_challenge.sql');
      await db.exec(sql.match(/CREATE OR REPLACE FUNCTION public\.replay_tension_challenge[\s\S]*?\$function\$;/)[0]);
      const codes = ['MAX_WEIGHT','PULL_STRENGTH','DURABILITY','FISH_STRENGTH','REEL_SPEED','WAIT_TIME','FIGHT_SECONDS',
        'START_DISTANCE','BURST_CHANCE','BURST_MULTIPLIER','STAMINA_DRAIN','SAFE_MIN_RATIO','SAFE_MAX_RATIO',
        'START_TENSION_RATIO','SLACK_ESCAPE_SECONDS','SLACK_DISTANCE_RATE','SLACK_THRESHOLD_RATIO','FISH_PULL_MULTIPLIER',
        'REEL_RATE','RELEASE_RATE','PULL_PERIOD_TICKS','BURST_MIN_TICKS','BURST_MAX_TICKS','BASE_PULL','PULL_AMPLITUDE','MINIMUM_STRENGTH'];
      const inputs = [{ tick: 0, reeling: true }];
      for (const amount of [-1000, -100, 50, 1000000]) {
        await setWeather(codes.map(code => weatherEffect(code, amount)));
        const session = await cast(), challenge = session.challenge_data;
        assert.equal(isTensionChallenge(challenge), true, `Invalid challenge for ${amount}%: ${JSON.stringify(challenge)}`);
        const fight = createTensionFight(challenge);
        while (fight.result === 'fighting') stepTensionFight(challenge, fight, true);
        const replay = await rpc('replay_tension_challenge($1,$2,$3)', [challenge, inputs, fight.tick]);
        assert.equal(replay.result, fight.result);
        for (const key of ['tension','distance','stamina','rng']) assert.equal(replay[key], fight[key]);
      }
    }));

    await check('area depth tool gates depth scopes while disabled casts follow relative spawn weights', async () => {
      const scope = randomUUID();
      const failure = session => session.fish_snapshot.species_id ?? null;
      assert.equal(await scalar('SELECT allow_depth_tool FROM fishing_areas WHERE id=$1', [area]), false);
      await db.query('INSERT INTO depth_scope VALUES($1,0,20,10,2)', [scope]);
      await db.query('UPDATE species_in_area SET depth_scope_id=$1 WHERE area_id=$2', [scope, area]);

      // Disabled casts can encounter fish outside their scope, including at a boundary.
      for (const depth of [0, 10, 20, 1000]) assert.equal(failure(await cast(depth)), species[0]);
      assert.equal(Number((await cast(1000)).cast_depth), 1000);
      await db.query('UPDATE fishing_areas SET allow_depth_tool=NULL WHERE id=$1', [area]);
      assert.equal(failure(await cast(1000)), species[0]);

      await db.query('UPDATE fishing_areas SET allow_depth_tool=TRUE WHERE id=$1', [area]);
      await db.exec(depthToolMigration);
      await db.exec(depthToolMigration);
      assert.equal(await scalar('SELECT allow_depth_tool FROM fishing_areas WHERE id=$1', [area]), true);
      assert.equal(failure(await cast(10)), species[0]);
      for (const depth of [0, 20, 1000]) assert.equal(failure(await cast(depth)), null);
      await db.query('UPDATE depth_scope SET min_depth=5,max_depth=5,peak_depth=5 WHERE id=$1', [scope]);
      assert.equal(failure(await cast(5)), species[0]);
      assert.equal(failure(await cast(6)), null);
      await db.query('UPDATE depth_scope SET peak_depth=6 WHERE id=$1', [scope]);
      assert.equal(failure(await cast(5)), null);

      // Invalid scopes are also ignored when the tool is disabled.
      await db.query('UPDATE fishing_areas SET allow_depth_tool=FALSE WHERE id=$1', [area]);
      assert.equal(failure(await cast(1000)), species[0]);
      await db.query('UPDATE species_in_area SET weight_rate=9 WHERE species_id=$1', [species[1]]);
      const sample = async depth => {
        await db.exec('SELECT setseed(0.25)');
        const selected = [];
        for (let i = 0; i < 200; i++) selected.push(failure(await cast(depth)));
        return selected;
      };
      const shallow = await sample(0), deep = await sample(1000);
      assert.deepEqual(deep, shallow, 'Changing depth must not affect the seeded encounter sequence');
      const frequentShare = shallow.filter(id => id === species[1]).length / shallow.length;
      assert.ok(frequentShare > 0.82 && frequentShare < 0.98, `Expected weight ratio 9/(1+9), got ${frequentShare}`);

      // The opt-out does not bypass the existing time and positive-weight filters.
      await db.query('UPDATE species_in_area SET weight_rate=0 WHERE area_id=$1', [area]);
      assert.equal(failure(await cast()), null);
      await db.query('UPDATE species_in_area SET weight_rate=1 WHERE species_id=$1', [species[0]]);
      await db.query(`UPDATE species SET active_time=CASE
        WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN 6 AND 18 THEN 'NIGHT' ELSE 'DAY' END
        WHERE id=$1`, [species[0]]);
      assert.equal(failure(await cast()), null);
      await db.query("UPDATE species SET active_time='ALL' WHERE id=$1", [species[0]]);
      for (const depth of [null, -1, 'NaN', 'Infinity', '-Infinity']) {
        await assert.rejects(cast(depth), /Invalid cast depth/);
      }
      await db.query('UPDATE species_in_area SET depth_scope_id=NULL WHERE area_id=$1', [area]);
      await db.query('DELETE FROM depth_scope WHERE id=$1', [scope]);
    });

    await check('repair handles invoker wrappers and legacy owners without exposing helpers to players', async () => {
      const repair = await read('./supabase/migrations/20261115_ranked_fishing_permissions.sql');
      await db.exec(`
        ALTER FUNCTION public.cast_rod(UUID,NUMERIC) SECURITY INVOKER;
        GRANT SELECT ON public.user_in_area TO authenticated;
        SET ROLE authenticated;
      `);
      await assert.rejects(rpc('cast_rod($1,10)', [area]), /permission denied/);
      await db.exec('RESET ROLE');
      await db.exec(repair);
      await db.exec('SET ROLE authenticated');
      assert.ok((await rpc('cast_rod($1,10)', [area])).session_id);
      await assert.rejects(rpc("fishing_fatigue_multiplier('[]','score')"), /permission denied/);
      await assert.rejects(rpc("fishing_weather_modifiers('[]')"), /permission denied/);
      await assert.rejects(rpc("fishing_effective_stat(1,'{}','max_weight')"), /permission denied/);
      await assert.rejects(rpc("fishing_weather_spawn_weight(1,'RARE','{}')"), /permission denied/);
      await db.exec(`
        RESET ROLE;
        CREATE ROLE legacy_fishing_owner;
        GRANT USAGE ON SCHEMA auth TO legacy_fishing_owner;
        GRANT SELECT ON public.user_in_area TO legacy_fishing_owner;
        GRANT EXECUTE ON FUNCTION public.touch_fishing_presence() TO legacy_fishing_owner;
        ALTER FUNCTION public.cast_rod(UUID,NUMERIC) OWNER TO legacy_fishing_owner;
        SET ROLE authenticated;
      `);
      await assert.rejects(rpc('cast_rod($1,10)', [area]), /permission denied/);
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

    await check('fatigue previews recover per area without changing membership or presence', async () => {
      await db.exec(await read('./supabase/migrations/20261116_fishing_fatigue_preview.sql'));
      await db.query("UPDATE user_area_fatigue SET fatigue_score=40,calculated_at=clock_timestamp()-interval '5 minutes',active_until=NULL WHERE user_id=$1 AND area_id=$2", [uid, areaB]);
      const before = await query('SELECT * FROM user_area_fatigue ORDER BY user_id,area_id');
      const membership = await query('SELECT * FROM user_in_area ORDER BY user_id');
      await db.exec('SET ROLE authenticated');
      const preview = await rpc('get_fishing_fatigue($1)', [areaB]);
      assert.equal(preview.area_id, areaB);
      assert.ok(preview.fatigue_score > 34.9 && preview.fatigue_score <= 35);
      await assert.rejects(rpc('get_fishing_fatigue($1)', [randomUUID()]), /Fishing area not found/);
      await db.exec('RESET ROLE');
      assert.deepEqual(await query('SELECT * FROM user_area_fatigue ORDER BY user_id,area_id'), before);
      assert.deepEqual(await query('SELECT * FROM user_in_area ORDER BY user_id'), membership);
      await db.query("SELECT set_config('test.uid',$1,false)", [other]);
      await db.exec('SET ROLE authenticated');
      assert.deepEqual(await rpc('get_fishing_fatigue($1)', [areaB]), {area_id: areaB, fatigue_score: 0, effects: []});
      await db.query("SELECT set_config('test.uid','',false)");
      await assert.rejects(rpc('get_fishing_fatigue($1)', [areaB]), /User not authenticated/);
      await db.exec('RESET ROLE; SET ROLE anon');
      await assert.rejects(rpc('get_fishing_fatigue($1)', [areaB]), /permission denied/);
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('test.uid',$1,false)", [uid]);
    });

    await check('lifetime catch count is awarded before seasons start and retries cannot increment it', async () => {
      const session = await cast();
      const result = await resolve(session);
      assert.equal(result.success, true);
      assert.equal(Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1', [uid])), 1);
      assert.equal(Number(await scalar('SELECT count(*) FROM fishing_score_catches')), 0);
      await assert.rejects(rpc('resolve_fishing_challenge($1,TRUE,1000)', [session.id]), /already processed/);
      assert.equal(Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1', [uid])), 1);
      assert.equal(Number(await scalar("SELECT count(*) FROM daily_mission_events WHERE event_type='CATCH_FISH'")), 1);

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
      assert.deepEqual((await rpc('get_fishing_fatigue($1)', [area])).effects.map(effect => [effect.target, effect.value]), [['weight_cap', -50], ['score', -10]]);
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

    await check('daily missions track epic catches, exact weight and actual bait use without duplicate retry events', async () => {
      await db.exec('BEGIN');
      try {
        await db.query("UPDATE species SET rarity='EPIC' WHERE id=$1", [species[0]]);
        const session = await cast();
        const result = await resolve(session);
        assert.equal(result.success, true);
        assert.equal(result.caught.rarity, 'EPIC');
        const eventsBeforeRetry = Number(await scalar('SELECT count(*) FROM daily_mission_events'));
        await db.exec('SAVEPOINT retry_catch');
        await assert.rejects(rpc('resolve_fishing_challenge($1,TRUE,1000)', [session.id]), /already processed/);
        await db.exec('ROLLBACK TO SAVEPOINT retry_catch');
        assert.equal(Number(await scalar('SELECT count(*) FROM daily_mission_events')), eventsBeforeRetry);
        await db.exec('ROLLBACK');
        await db.exec('BEGIN');
        const noBaitSession = await cast();
        await db.query("UPDATE user_inventory SET data=jsonb_set(data,'{quantity}','0') WHERE id=$1", [slots.bait[0].inventory_id]);
        const eventsBeforeMissingBait = Number(await scalar('SELECT count(*) FROM daily_mission_events'));
        const noBaitResult = await resolve(noBaitSession);
        assert.equal(noBaitResult.result, 'BAIT_UNAVAILABLE');
        assert.equal(Number(await scalar('SELECT count(*) FROM daily_mission_events')), eventsBeforeMissingBait);
        await db.exec('SAVEPOINT failed_cast');
        await assert.rejects(cast(), /No usable bait remaining/);
        await db.exec('ROLLBACK TO SAVEPOINT failed_cast');
        assert.equal(Number(await scalar('SELECT count(*) FROM daily_mission_events')), eventsBeforeMissingBait);
      } finally {
        await db.exec('ROLLBACK');
      }
    });

    await check('survival consumes active equipment once, disables fatigue and loses only this trip fish at death', async () => {
      // The preview deployment exercised above replaces an older RPC definition.
      const migration = await read('./supabase/migrations/20261125_fishing_survival.sql');
      await db.exec(migration);
      await db.exec(migration);
      await db.exec(await read('./supabase/rpc/equipment/save_body_equipment_set.sql'));
      await db.exec(await read('./supabase/rpc/fishing/submit_tension_challenge.sql'));
      await db.exec('BEGIN');
      try {
        const trip = randomUUID(), previousTrip = randomUUID(), activeSet = randomUUID(), spareSet = randomUUID();
        const hat = randomUUID(), coat = randomUUID(), spare = randomUUID();
        const resources = ['vitality','hydration','nutrition','energy','morale'];
        for (const [id,category,bonuses] of [
          [hat,'head',{ vitality: 2,hydration: 3,nutrition: 0.3,energy: 3,morale: 3 }],
          [coat,'torso',{ vitality: 1,hydration: 0.2,nutrition: 0.2,energy: 0,morale: 0 }],
          [spare,'head',Object.fromEntries(resources.map(key => [key,100]))],
        ]) await db.query('INSERT INTO user_inventory VALUES($1,$2,$3)', [id,uid,{category,health_bonuses:bonuses,quantity:1}]);
        await db.query('INSERT INTO user_body_equipments(id,user_id,is_used,head,torso) VALUES($1,$2,TRUE,$3,$4)',
          [activeSet,uid,[{inventory_id:hat}],[{inventory_id:coat}]]);
        await db.query('INSERT INTO user_body_equipments(id,user_id,is_used,head) VALUES($1,$2,FALSE,$3)',
          [spareSet,uid,[{inventory_id:spare}]]);
        const item = id => scalar('SELECT data FROM user_inventory WHERE id=$1',[id]);

        // Ordinary areas do not consume body resources.
        assert.equal((await resolve(await cast())).success,true);
        assert.equal((await item(hat)).health_remaining,undefined);
        await db.query('UPDATE fishing_areas SET survival_mode=TRUE WHERE id=$1',[area]);
        await db.query("UPDATE user_in_area SET session_id=$1 WHERE user_id=$2",[trip,uid]);
        await db.query("UPDATE user_area_fatigue SET fatigue_score=100,calculated_at=clock_timestamp(),active_until=NULL WHERE user_id=$1 AND area_id=$2",[uid,area]);
        const preview = await rpc('get_fishing_fatigue($1)',[area]);
        assert.equal(preview.fatigue_score,0); assert.deepEqual(preview.effects,[]);
        assert.deepEqual((await rpc('touch_fishing_presence()')).effects,[]);
        assert.equal(await scalar('SELECT active_until FROM user_area_fatigue WHERE user_id=$1 AND area_id=$2',[uid,area]),null);
        await setWeather([{code:'FATIGUE_SCORE',unit:'PERCENT',value:-50}]);
        const initial = await rpc('get_fishing_survival()');
        assert.equal(initial.dead,false); assert.equal(initial.remaining.vitality,3);
        await db.query("INSERT INTO caught(user_id,area_session_id,status) VALUES($1,$2,'in-net'),($1,$3,'normal'),($4,$5,'in-net')",
          [uid,previousTrip,previousTrip,other,trip]);
        const oldFish = await scalar('SELECT count(*) FROM caught WHERE user_id=$1 AND area_session_id<>$2',[uid,trip]);

        // Failed catches and bait retrieval do not consume any resources.
        const failed = await cast();
        await db.query("UPDATE fishing_sessions SET status='BITE',bite_at=clock_timestamp()-interval '1 second' WHERE id=$1",[failed.id]);
        const failure = await rpc('resolve_fishing_challenge($1,FALSE,1000)',[failed.id]);
        assert.equal(failure.success,false);
        assert.equal((await item(hat)).health_remaining,undefined);

        const firstSession = await cast();
        assert.equal(firstSession.modifiers._survival,true);
        assert.equal(firstSession.fish_snapshot.scoring.fatigue_multiplier,1);
        const first = await resolve(firstSession);
        assert.equal(first.success,true); assert.equal(first.survival.dead,false);
        assert.deepEqual(first.survival.remaining,{vitality:2,hydration:2.2,nutrition:0,energy:2,morale:2});
        assert.equal((await item(spare)).health_remaining,undefined);
        assert.equal((await item(hat)).health_bonuses.vitality,2);
        assert.equal((await item(coat)).health_remaining.nutrition,0);

        // A retry through the real replay RPC consumes once, including fatal catches.
        const submitWin = async () => {
          const session = await cast();
          const now = Date.now()-2000;
          const challenge = {...session.challenge_data,startedAt:now,activatedAt:now,expiresAt:now+90000,
            config:{...session.challenge_data.config,tickRate:1,startDistance:1,reelSpeed:2,
              startTension:50,safeMin:10,safeMax:80,maxTension:100,reelRate:0,releaseRate:0,minimumStrength:1},
            fish:{...session.challenge_data.fish,baseStrength:1,basePull:0,pullAmplitude:0,burstChance:0}};
          await db.query("UPDATE fishing_sessions SET status='BITE',bite_at=clock_timestamp()-interval '2 seconds',expires_at=clock_timestamp()+interval '1 minute',challenge_data=$2 WHERE id=$1",[session.id,challenge]);
          const payload = {sessionId:session.id,totalTicks:1,inputs:[{tick:0,reeling:true}],claimedResult:'won'};
          const result = await rpc('submit_tension_challenge($1)',[payload]);
          const beforeRetry = await item(hat);
          assert.deepEqual(await rpc('submit_tension_challenge($1)',[payload]),result);
          assert.deepEqual((await rpc('start_tension_challenge($1)',[session.id])).resolution,result);
          assert.deepEqual(await item(hat),beforeRetry);
          return result;
        };
        const second = await submitWin();
        assert.equal(second.success,true); assert.equal(second.survival.remaining.vitality,1);

        // Switching away and back preserves each individual item's remaining stats.
        await rpc('switch_body_equipment($1)',[spareSet]);
        assert.equal((await rpc('get_fishing_survival()')).remaining.vitality,100);
        await rpc('switch_body_equipment($1)',[activeSet]);
        assert.equal((await rpc('get_fishing_survival()')).remaining.vitality,1);
        const xpBefore = Number(await scalar('SELECT experience_point FROM user_profile WHERE id=$1',[uid]));
        const countBefore = Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1',[uid]));
        const scoreBefore = Number(await scalar('SELECT score FROM leaderboard WHERE id=$1',[uid]));
        const death = await submitWin();
        assert.equal(death.success,true); assert.equal(death.survival.dead,true);
        assert.equal(death.survival.remaining.vitality,0); assert.equal(death.survival.lost_fish,3);
        assert.equal(Number(await scalar('SELECT count(*) FROM caught WHERE user_id=$1 AND area_session_id=$2',[uid,trip])),0);
        assert.equal(await scalar('SELECT count(*) FROM caught WHERE user_id=$1 AND area_session_id<>$2',[uid,trip]),oldFish);
        assert.equal(Number(await scalar('SELECT count(*) FROM caught WHERE user_id=$1 AND area_session_id=$2',[other,trip])),1);
        assert.equal(Number(await scalar('SELECT total_caught FROM leaderboard WHERE id=$1',[uid])),countBefore+1);
        assert.ok(Number(await scalar('SELECT score FROM leaderboard WHERE id=$1',[uid]))>=scoreBefore);
        assert.ok(Number(await scalar('SELECT experience_point FROM user_profile WHERE id=$1',[uid]))>=xpBefore);
        assert.equal((await rpc('get_fishing_survival()')).dead,true);
        assert.equal((await rpc('cast_rod($1,10)',[area])).survival.dead,true);
        await rpc('switch_body_equipment($1)',[spareSet]);
        assert.equal((await rpc('get_fishing_survival()')).dead,true);
        await db.query('UPDATE user_in_area SET session_id=$1 WHERE user_id=$2',[randomUUID(),uid]);
        assert.equal((await rpc('get_fishing_survival()')).dead,false);
        await db.exec('SET LOCAL ROLE authenticated');
        assert.equal((await rpc('get_fishing_survival()')).remaining.vitality,100);
        await assert.rejects(rpc('fishing_survival_settle($1,$2,TRUE)',[uid,trip]),/permission denied/);
        await db.exec('ROLLBACK');
      } finally {
        await db.exec('ROLLBACK');
      }
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
