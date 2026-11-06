// Run with Node 24+ after: npm install --no-save --package-lock=false @electric-sql/pglite
const { PGlite } = await import(process.env.PGLITE_MODULE ?? '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import ts from 'typescript';
import { createPinia, defineStore, setActivePinia } from 'pinia';
import { createTensionFight, stepTensionFight, isTensionChallenge } from '../src/data/tensionChallenge.ts';
import { validateEquipmentMechanics } from './validate-equipment-mechanics.mjs';
process.on('uncaughtException', async (e) => {
 console.error({message:e.message,code:e.code,position:e.position,where:e.where,detail:e.detail,stack:e.stack});
 await db.close();
 process.exitCode=1;
});

const db = new PGlite();
const uid = '11111111-1111-4111-8111-111111111111';
const speciesId = '22222222-2222-4222-8222-222222222222';
const areaId = '33333333-3333-4333-8333-333333333333';
await db.exec(`
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
CREATE TABLE public.fishing_sessions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, area_id uuid, species_id uuid, secret_weight numeric,
 challenge_data jsonb, expires_at timestamptz, area_session_id uuid, is_shiny boolean, variant_type text,
 star_rating integer, cast_depth numeric, bite_at timestamptz, status text DEFAULT 'WAITING'
);
CREATE TABLE public.species (id uuid PRIMARY KEY, name text, rarity text, weight_min numeric, weight_max numeric,
 active_time text, bait_match_number bigint, experience_point integer, image text, base_catch_rate numeric DEFAULT 1);
CREATE TABLE public.user_profile (id uuid PRIMARY KEY, level integer, experience_point integer);
CREATE TABLE public.user_inventory (id uuid PRIMARY KEY, user_id uuid, data jsonb);
CREATE TABLE public.user_equipments (id uuid PRIMARY KEY, user_id uuid, is_used boolean, created_at timestamptz DEFAULT now(),
 rod jsonb, reel jsonb, line jsonb, bait jsonb, hook jsonb);
CREATE TABLE public.caught (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, species_id uuid,
 area_id uuid, weight numeric, area_session_id uuid, is_shiny boolean, variant_type text, star_rating integer, status text);
CREATE TABLE public.user_in_area (user_id uuid, session_id uuid);
CREATE TABLE public.species_in_area (species_id uuid, area_id uuid, weight_rate numeric, depth_scope_id uuid);
CREATE TABLE public.depth_scope (id uuid PRIMARY KEY, min_depth numeric, max_depth numeric, peak_depth numeric, curve_power numeric);
CREATE TABLE public.countries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), code text UNIQUE, default_timezone text);
CREATE TABLE public.fishing_areas (id uuid PRIMARY KEY, country_id text, timezone text);
INSERT INTO countries (code,default_timezone) VALUES ('VN','Asia/Ho_Chi_Minh');
INSERT INTO fishing_areas VALUES ('${areaId}','VN',NULL);
INSERT INTO user_profile VALUES ('${uid}',1,0);
INSERT INTO species (id,name,rarity,weight_min,weight_max,active_time,bait_match_number,experience_point,image) VALUES ('${speciesId}', 'Test fish', 'RARE', 1, 2, 'ALL', 1, 100, null);
INSERT INTO species_in_area VALUES ('${speciesId}', '${areaId}', 1, null);
INSERT INTO user_inventory VALUES ('44444444-4444-4444-8444-444444444444', '${uid}', '{"quantity":1000,"fish_type":["TEST"]}');
INSERT INTO user_inventory VALUES ('55555555-5555-4555-8555-555555555555', '${uid}', '{"catch_rate":1}');
INSERT INTO user_inventory VALUES
 ('77777777-7777-4777-8777-777777777777', '${uid}', '{"max_weight":100}'),
 ('88888888-8888-4888-8888-888888888888', '${uid}', '{"pull_strength":80}'),
 ('99999999-9999-4999-8999-999999999999', '${uid}', '{"durability":100}');
INSERT INTO user_equipments (id,user_id,is_used,bait,hook) VALUES (gen_random_uuid(),'${uid}',true,
 '[{"inventory_id":"44444444-4444-4444-8444-444444444444","is_used":true}]',
 '[{"inventory_id":"55555555-5555-4555-8555-555555555555","is_used":true}]');
SELECT set_config('app.user_id','${uid}',false);
`);
await db.exec(await readFile(new URL('./supabase/migrations/equipment_mechanics.sql', import.meta.url), 'utf8'));
await db.exec(`
UPDATE species SET fish_type='TEST',strength=40,alertness=0,burst_multiplier=1.5;
UPDATE user_equipments SET
 rod='[{"inventory_id":"77777777-7777-4777-8777-777777777777","is_used":true}]',
 reel='[{"inventory_id":"88888888-8888-4888-8888-888888888888","is_used":true}]',
 line='[{"inventory_id":"99999999-9999-4999-8999-999999999999","is_used":true}]';
`);
await db.exec(await readFile(new URL('./supabase/rpc/submit_challenge.sql', import.meta.url), 'utf8'));
await db.exec(await readFile(new URL('./supabase/rpc/submit_tension_challenge.sql', import.meta.url), 'utf8'));
await db.exec('CREATE FUNCTION public.cast_rod(p_area_id UUID,p_cast_depth NUMERIC) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $cast$' + await readFile(new URL('./supabase/rpc/cast_rod.sql', import.meta.url),'utf8') + '$cast$;');
const query = async (sql, args=[]) => (await db.query(sql,args)).rows;
const rejects = async (sql,args=[]) => assert.rejects(query(sql,args));
const cast = (await query('SELECT cast_rod($1,0) AS result',[areaId]))[0].result;
assert.equal(cast.challenge,undefined);
const c = (await query('SELECT challenge_data AS c FROM fishing_sessions WHERE id=$1',[cast.session_id]))[0].c;
assert(isTensionChallenge(c));
assert.equal(c.sessionId,cast.session_id);
assert.equal(c.expiresAt-c.startedAt,90000);
await rejects('SELECT start_tension_challenge($1)',[cast.session_id]);

// A late BITE must not consume any of the playable fight. Activation is owned
// by the server, bounded by session expiry, and idempotent under retries.
const late=structuredClone(c);
late.startedAt=Date.now()-30000;late.expiresAt=late.startedAt+90000;
await query("UPDATE fishing_sessions SET status='BITE',bite_at=to_timestamp($2/1000.0),challenge_data=$3,expires_at=to_timestamp($4/1000.0) WHERE id=$1",
 [cast.session_id,late.startedAt,late,late.expiresAt]);
await rejects('SELECT submit_tension_challenge($1)',[{sessionId:cast.session_id,inputs:[],totalTicks:182,claimedResult:'escaped'}]);
await db.exec("SELECT set_config('app.user_id','66666666-6666-4666-8666-666666666666',false)");
await rejects('SELECT start_tension_challenge($1)',[cast.session_id]);
await db.exec(`SELECT set_config('app.user_id','${uid}',false); SET ROLE authenticated`);
const activated=(await query('SELECT start_tension_challenge($1) AS r',[cast.session_id]))[0].r;
assert(activated.challenge_data.startedAt>=late.startedAt+29000);
assert.equal(activated.challenge_data.activatedAt,activated.challenge_data.startedAt);
assert.equal(activated.challenge_data.expiresAt-activated.challenge_data.startedAt,90000);
for(const key of ['seed','config','fish']) assert.deepEqual(activated.challenge_data[key],late[key]);
const repeated=(await query('SELECT start_tension_challenge($1) AS r',[cast.session_id]))[0].r;
assert.deepEqual(repeated.challenge_data,activated.challenge_data);
await db.exec('RESET ROLE');
await query("UPDATE fishing_sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[cast.session_id]);
await rejects('SELECT start_tension_challenge($1)',[cast.session_id]);

// Regression using the reported seed: replaying just three seconds of network
// or scheduler delay with released input used to finish the fight immediately.
const reported={...c,seed:49897141,config:{...c.config,startTension:30,releaseRate:-28,fishPullMultiplier:0.7},
 fish:{...c.fish,baseStrength:1,basePull:10,pullAmplitude:8,burstChance:0.55,burstMin:25,burstMax:60}};
const reportedFight=createTensionFight(reported);
while(reportedFight.result==='fighting') stepTensionFight(reported,reportedFight,false);
assert.equal(reportedFight.result,'escaped');assert.equal(reportedFight.tick,182);

function play(challenge, policy) {
 const s=createTensionFight(challenge), inputs=[];
 let reeling=false;
 while(s.result==='fighting') {
  const next=policy(s,reeling);
  if(next!==reeling) {inputs.push({tick:s.tick,reeling:next});reeling=next;}
  stepTensionFight(challenge,s,reeling);
 }
 return {s,inputs};
}
const policies=[()=>false,()=>true,(s,r)=>s.tension<450000?true:s.tension>600000?false:r];
const outcomes=new Set(); let comparisons=0; let winner;
for(const seed of [1,2,77,918273645,2147483646,...Array.from({length:25},(_,i)=>i*8011+9)]) {
 for(const policy of policies) {
  const challenge={...c,seed}; const played=play(challenge,policy);
  const actual=(await query('SELECT replay_tension_challenge($1,$2,$3) AS result',[challenge,played.inputs,played.s.tick]))[0].result;
  for(const key of ['tension','distance','stamina','rng']) assert.equal(actual[key],played.s[key],key);
  assert.equal(actual.result,played.s.result); outcomes.add(actual.result); comparisons++;
  if(played.s.result==='won') winner={challenge,...played};
 }
}
assert(winner,'Official configuration must be winnable');
for (const rate of [30,120]) {
 const changed=structuredClone(c);
 changed.config.tickRate=rate;
 changed.config.releaseRate=-28.12345;
 changed.config.reelSpeed=8.25;
 changed.fish.baseStrength=1.2;
 const played=play(changed,policies[2]);
 const replay=(await query('SELECT replay_tension_challenge($1,$2,$3) AS r',[changed,played.inputs,played.s.tick]))[0].r;
 assert.equal(replay.result,played.s.result);
 for(const key of ['tension','distance','stamina','rng']) assert.equal(replay[key],played.s[key],key);
 comparisons++;
}
const timeoutChallenge=structuredClone(c);
timeoutChallenge.expiresAt=timeoutChallenge.startedAt+1000;
timeoutChallenge.config.slackEscapeSeconds=180;
const timed=play(timeoutChallenge,()=>false);
assert.equal(timed.s.result,'timeout');
assert.equal((await query('SELECT replay_tension_challenge($1,$2,$3) AS result',[timeoutChallenge,timed.inputs,timed.s.tick]))[0].result.result,'timeout');
await rejects('SELECT replay_tension_challenge($1,$2,100)',[c,[{tick:2,reeling:true},{tick:1,reeling:false}]]);
await rejects('SELECT replay_tension_challenge($1,$2,100)',[c,[{tick:0,reeling:false}]]);
await rejects('SELECT replay_tension_challenge($1,$2,100)',[c,[{tick:100,reeling:true}]]);
await rejects('SELECT replay_tension_challenge($1,$2,99999)',[c,[]]);
await rejects('SELECT replay_tension_challenge($1,$2,1)',[c,[]]);
await rejects('SELECT replay_tension_challenge($1,$2,2)',[c,[{tick:0,reeling:'true'}]]);

async function installSession(challenge, played, options={}) {
 const id=crypto.randomUUID(); const copy=structuredClone(challenge); copy.sessionId=id;
 const duration=copy.expiresAt-copy.startedAt;
 copy.startedAt=Date.now()-Math.ceil(played.s.tick/copy.config.tickRate*1000)-1000;
 copy.activatedAt=copy.startedAt;
 copy.expiresAt=copy.startedAt+duration;
 await query(`INSERT INTO fishing_sessions (id,user_id,area_id,species_id,secret_weight,challenge_data,
 expires_at,bite_at,status,star_rating,variant_type) VALUES ($1,$2,$3,$4,1.5,$5,to_timestamp($6/1000.0),to_timestamp($7/1000.0),'BITE',3,'NORMAL')`,
 [id,uid,areaId,options.empty?null:speciesId,copy,copy.expiresAt,copy.startedAt]);
 return {id,payload:{sessionId:id,inputs:played.inputs,totalTicks:played.s.tick,claimedResult:played.s.result}};
}
const win=await installSession(winner.challenge,winner);
await rejects('SELECT submit_challenge($1,true,1000)',[win.id]);
const before=Number((await query("SELECT data->>'quantity' AS q FROM user_inventory WHERE id='44444444-4444-4444-8444-444444444444'"))[0].q);
await db.exec('SET ROLE authenticated');
await rejects('SELECT resolve_fishing_challenge($1,true,1000)',[win.id]);
await rejects('SELECT replay_tension_challenge($1,$2,$3)',[winner.challenge,winner.inputs,winner.s.tick]);
const response=(await query('SELECT submit_tension_challenge($1) AS r',[win.payload]))[0].r;
assert.equal(response.success,true); assert.equal(response.verifiedResult,'won');
assert.equal(response.claimedResultMatched,true);
assert.equal(response.progression.earned_xp,100);
await rejects('SELECT submit_tension_challenge($1)',[win.payload]);
await db.exec('RESET ROLE');
assert.equal((await query('SELECT id FROM caught'))[0].id,response.caught.id);
assert.equal((await query('SELECT experience_point FROM user_profile WHERE id=$1',[uid]))[0].experience_point,100);
assert.equal(Number((await query("SELECT data->>'quantity' AS q FROM user_inventory WHERE id='44444444-4444-4444-8444-444444444444'"))[0].q),before-1);

const loser=play(c,()=>false);const loss=await installSession(c,loser);
loss.payload.claimedResult='won';
const failed=(await query('SELECT submit_tension_challenge($1) AS r',[loss.payload]))[0].r;
assert.equal(failed.success,false); assert.equal(failed.claimedResultMatched,false);
await rejects('SELECT submit_tension_challenge($1)',[loss.payload]);
assert.equal((await query('SELECT count(*)::int AS n FROM caught'))[0].n,1);
assert.equal((await query('SELECT experience_point FROM user_profile WHERE id=$1',[uid]))[0].experience_point,100);
const verification=(await query('SELECT challenge_data->\'verification\' AS v FROM fishing_sessions WHERE id=$1',[loss.id]))[0].v;
assert.equal(verification.claimedResult,'won');assert.equal(verification.verifiedResult,loser.s.result);
const fast=await installSession(winner.challenge,winner);
await query("UPDATE fishing_sessions SET bite_at=clock_timestamp(),challenge_data=challenge_data || jsonb_build_object('startedAt',floor(extract(epoch FROM clock_timestamp())*1000)::bigint,'activatedAt',floor(extract(epoch FROM clock_timestamp())*1000)::bigint) WHERE id=$1",[fast.id]);
await rejects('SELECT submit_tension_challenge($1)',[fast.payload]);
await db.exec("SELECT set_config('app.user_id','66666666-6666-4666-8666-666666666666',false)");
await rejects('SELECT submit_tension_challenge($1)',[fast.payload]);
await db.exec(`SELECT set_config('app.user_id','${uid}',false)`);

const empty=await installSession(winner.challenge,winner,{empty:true});
assert.equal((await query('SELECT submit_tension_challenge($1) AS r',[empty.payload]))[0].r.success,false);
const expired=await installSession(winner.challenge,winner);
await query("UPDATE fishing_sessions SET expires_at=clock_timestamp()-interval '6 seconds' WHERE id=$1",[expired.id]);
assert.equal((await query('SELECT submit_tension_challenge($1) AS r',[expired.payload]))[0].r.result,'EXPIRED');
await rejects('SELECT submit_tension_challenge($1)',[expired.payload]);
assert.equal((await query('SELECT count(*)::int AS n FROM caught'))[0].n,1);

for (const rarity of ['EPIC','LEGENDARY']) {
 await query('UPDATE species SET rarity=$1',[rarity]);
 const cast=(await query('SELECT cast_rod($1,0) AS r',[areaId]))[0].r;
 const challenge=(await query('SELECT challenge_data AS c FROM fishing_sessions WHERE id=$1',[cast.session_id]))[0].c;
 assert.equal(challenge.type,'tension-challenge');
 assert(challenge.fish.baseStrength >= 0.75 && challenge.fish.baseStrength <= 1.25);
}

// Every rarity now uses tension. Keep the old RPC for already-created sessions and other features.
await db.exec("UPDATE species SET rarity='COMMON'");
for(let i=0;i<15;i++) {
 const cast=(await query('SELECT cast_rod($1,0) AS r',[areaId]))[0].r;
 const s=(await query('SELECT * FROM fishing_sessions WHERE id=$1',[cast.session_id]))[0];
 assert(isTensionChallenge(s.challenge_data)); assert.equal(s.challenge_data.max_duration_ms,undefined);
}
const oldId=crypto.randomUUID();
await query(`INSERT INTO fishing_sessions(id,user_id,species_id,area_id,challenge_data,bite_at,expires_at,status,secret_weight)
 VALUES($1,$2,$3,$4,'{"max_duration_ms":5000}',now()-interval '1 second',now()+interval '1 minute','BITE',1)`,[oldId,uid,speciesId,areaId]);
assert.equal((await query('SELECT submit_challenge($1,true,1000) AS r',[oldId]))[0].r.success,true);
await rejects('SELECT submit_challenge($1,true,1000)',[oldId]);
await db.exec('UPDATE species SET alertness=1');
const emptyCast=(await query('SELECT cast_rod($1,0) AS r',[areaId]))[0].r;
const emptySession=(await query('SELECT species_id,challenge_data FROM fishing_sessions WHERE id=$1',[emptyCast.session_id]))[0];
assert.equal(emptySession.species_id,null);
assert(isTensionChallenge(emptySession.challenge_data));
await db.exec('UPDATE species SET alertness=0');

// Exercise the actual Pinia actions with repository and clock boundaries mocked.
let clock=0, fetchCount=0, startCount=0, oldSubmits=0, lastTensionSubmission;
const storeChallenge=structuredClone(c);
storeChallenge.startedAt=1000000;storeChallenge.expiresAt=1090000;
const legacy={target_zone_start:0.2,target_zone_width:0.25,bar_speed:1.1,max_duration_ms:5000};
let fetched={id:c.sessionId,status:'BITE',challenge_data:storeChallenge};
const repo={
 castRod:async()=>({session_id:c.sessionId,server_time_ms:1000000,challenge:legacy}),
 fetchSessionChallenge:async()=>{fetchCount++;return fetched;},
 startTensionChallenge:async()=>{
  startCount++;
  return {challenge_data:{...storeChallenge,startedAt:1000000+clock,activatedAt:1000000+clock,expiresAt:1090000+clock},server_time_ms:1000000+clock};
 },
 submitChallenge:async()=>{oldSubmits++;return {success:false};},
 submitTensionChallenge:async(payload)=>{lastTensionSubmission=payload;return {success:false};},
};
const imports={
 pinia:{defineStore},
 './auth':{useAuthStore:()=>({userId:uid})},
 './equipment':{useEquipmentStore:()=>({variants:{bait:[{id:'bait-worm',quantity:10}]}})},
 '../data/supabaseEquipmentRepository':{}, '../data/supabaseFishRepository':{}, '../data/supabaseUserInAreaRepository':{},
 '../database/connection':{default:{}}, '../data/supabaseFishingAreaRepository':{supabaseFishingAreaRepository:repo},
 '../data/fishingDepth':{buildDepthConfig:()=>({maxMeters:100}),DEPTH_STEP_METERS:1},
 '../data/tensionChallenge':await import('../src/data/tensionChallenge.ts'),
};
const storeSource=await readFile('src/stores/fishing.ts','utf8');
const output=ts.transpileModule(storeSource,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const storeModule={exports:{}};
new Function('require','module','exports','window','performance',output)(
 (name)=>{assert(name in imports,'Unexpected import '+name);return imports[name];},
 storeModule,storeModule.exports,{setTimeout,clearTimeout},{now:()=>clock});
setActivePinia(createPinia());
const store=storeModule.exports.useFishingStore();store.currentAreaId=areaId;
await store.castTo(50,50);
assert.equal(store.tensionChallenge,null);assert.equal(store.castPhase,'waiting');
const start=store.startChallengeForSession(c.sessionId);
await store.startChallengeForSession(c.sessionId);
await start;
assert.equal(fetchCount,1);assert.equal(store.castPhase,'bite');assert.equal(store.tensionStartedAt,null);
assert.equal(store.tensionChallenge.seed,c.seed);assert.equal(oldSubmits,0);
clock=30000;store.advanceTensionFight();
assert.equal(store.tensionFight.tick,0);assert.equal(store.tensionFight.result,'fighting');
assert.equal(startCount,0);assert.equal(lastTensionSubmission,undefined);
store.setTensionReeling(true);store.setTensionReeling(true);
await new Promise(setImmediate);
assert.equal(startCount,1);assert.equal(store.tensionStartedAt,30000);
assert.deepEqual(JSON.parse(JSON.stringify(store.tensionInputs)),[{tick:0,reeling:true}]);
store.setTensionReeling(true);store.setTensionReeling(false);
assert.equal(store.tensionInputs.length,0);
store.setTensionReeling(true);clock=30100;store.setTensionReeling(false);
assert.deepEqual(JSON.parse(JSON.stringify(store.tensionInputs)),[{tick:0,reeling:true},{tick:6,reeling:false}]);
clock=120001;store.advanceTensionFight();await new Promise(setImmediate);
assert.equal(store.castPhase,'lost');assert.equal(store.tensionChallenge,null);
assert(lastTensionSubmission);
const verified=(await query('SELECT replay_tension_challenge($1,$2,$3) AS r',[storeChallenge,lastTensionSubmission.inputs,lastTensionSubmission.totalTicks]))[0].r;
assert.equal(verified.result,lastTensionSubmission.claimedResult);

// Cancelling an in-flight fetch must not resurrect a previous fight.
store.resetCast();await store.castTo(50,50);
let resolveFetch;
repo.fetchSessionChallenge=()=>new Promise((resolve)=>{resolveFetch=resolve;});
const stale=store.startChallengeForSession(c.sessionId);store.reelInBait();
resolveFetch(fetched);await stale;
assert.equal(store.castPhase,'idle');assert.equal(store.tensionChallenge,null);
repo.fetchSessionChallenge=async()=>({...fetched,challenge_data:legacy});
const startsBeforeLegacy=startCount;
await store.castTo(50,50);await store.startChallengeForSession(c.sessionId);
assert.equal(store.castPhase,'lost');assert.equal(store.sessionId,null);
assert.equal(store.tensionChallenge,null);assert.equal(startCount,startsBeforeLegacy);
assert.equal(oldSubmits,0);

// Releasing during the activation request must remain released when it arrives.
repo.fetchSessionChallenge=async()=>fetched;
let resolveActivation;
repo.startTensionChallenge=()=>new Promise((resolve)=>{resolveActivation=resolve;});
store.resetCast();await store.castTo(50,50);await store.startChallengeForSession(c.sessionId);
store.setTensionReeling(true);store.setTensionReeling(false);
clock+=5000;store.advanceTensionFight();assert.equal(store.tensionFight.tick,0);
const activationResponse=()=>({challenge_data:{...storeChallenge,startedAt:1000000+clock,activatedAt:1000000+clock,expiresAt:1090000+clock},server_time_ms:1000000+clock});
resolveActivation(activationResponse());await new Promise(setImmediate);
assert.equal(store.tensionReeling,false);assert.equal(store.tensionInputs.length,0);
assert.equal(store.tensionFight.tick,0);assert.equal(store.tensionStartedAt,clock);

// Leaving while activation is pending must not resurrect the previous session.
store.resetCast();await store.castTo(50,50);await store.startChallengeForSession(c.sessionId);
store.setTensionReeling(true);store.reelInBait();
assert.equal(store.castPhase,'idle');
resolveActivation(activationResponse());await new Promise(setImmediate);
assert.equal(store.castPhase,'idle');assert.equal(store.tensionChallenge,null);
assert.equal(store.isStartingTensionChallenge,false);
// A predetermined server failure resolves without starting/submitting a fight.
repo.startTensionChallenge=async()=>({resolution:{success:false,result:'HOOK_MISSED',message:'Móc trượt!'},server_time_ms:1000000+clock});
store.resetCast();await store.castTo(50,50);await store.startChallengeForSession(c.sessionId);
await store.beginTensionChallenge();
assert.equal(store.castPhase,'lost');assert.equal(store.castMessage,'Móc trượt!');
assert.equal(store.tensionChallenge,null);assert.equal(store.tensionStartedAt,null);
assert.equal(oldSubmits,0);
console.log(JSON.stringify({comparisons,outcomes:[...outcomes,'timeout'],checks:'SQL deployment, cast routing, late BITE readiness, activation authorization/expiry/idempotency, pending input release/cancellation, exact replay parity, malformed inputs, unfinished/oversized replay, rewards/XP, bait once, claimed result mismatch, replay rejection, authorization, speedhack, private helper grants, legacy RPC'},null,2));
const equipmentChecks=await validateEquipmentMechanics({db,query,rejects,uid,speciesId,areaId,play,policies});
console.log(JSON.stringify({equipmentChecks},null,2));
await db.close();
