import assert from 'node:assert/strict';
import { isTensionChallenge } from '../src/data/tensionChallenge.ts';

// Uses only the isolated database created by validate-tension-challenge.mjs.
export async function validateEquipmentMechanics({ db, query, rejects, uid, speciesId, areaId, play, policies }) {
 const baitId='44444444-4444-4444-8444-444444444444', hookId='55555555-5555-4555-8555-555555555555';
 const rodId='77777777-7777-4777-8777-777777777777', reelId='88888888-8888-4888-8888-888888888888';
 const lineId='99999999-9999-4999-8999-999999999999';
 const scopeId=crypto.randomUUID(), otherId=crypto.randomUUID(), otherBaitId=crypto.randomUUID();
 const setData=(id,data)=>query('UPDATE user_inventory SET data=$2 WHERE id=$1',[id,data]);
 const castAt=async(depth=10)=>{
  const r=(await query('SELECT cast_rod($1,$2) AS r',[areaId,depth]))[0].r;
  const row=(await query(`SELECT fs.*,row_to_json(m) AS mechanics FROM fishing_sessions fs
   JOIN fishing_session_mechanics m ON m.session_id=fs.id WHERE fs.id=$1`,[r.session_id]))[0];
  assert(isTensionChallenge(row.challenge_data));
  assert.equal(row.challenge_data.max_duration_ms,undefined);
  for(const key of ['failure_reason','equipment_snapshot','catch_probability','secret_weight']) assert.equal(row.challenge_data[key],undefined);
  return row;
 };
 const start=async(row)=>{
  await query("UPDATE fishing_sessions SET status='BITE',bite_at=clock_timestamp()-interval '1 second',expires_at=clock_timestamp()+interval '90 seconds' WHERE id=$1",[row.id]);
  return (await query('SELECT start_tension_challenge($1) AS r',[row.id]))[0].r;
 };
 const quantity=async(id)=>Number((await query("SELECT data->>'quantity' AS q FROM user_inventory WHERE id=$1",[id]))[0].q);
 const rewardCounts=async()=> (await query('SELECT (SELECT count(*) FROM caught)::int AS fish,(SELECT experience_point FROM user_profile WHERE id=$1) AS xp',[uid]))[0];
 const resolveFailure=async(row,reason)=>{
  assert.equal(row.mechanics.failure_reason,reason);
  const before=await rewardCounts(), baitBefore=await quantity(baitId);
  const r=await start(row);
  assert.equal(r.challenge_data,undefined); assert.equal(r.resolution.result,reason); assert.equal(r.resolution.success,false);
  assert.deepEqual(await rewardCounts(),before); assert.equal(await quantity(baitId),baitBefore-1);
  await rejects('SELECT start_tension_challenge($1)',[row.id]); assert.equal(await quantity(baitId),baitBefore-1);
 };
 await db.exec("UPDATE species SET rarity='COMMON',weight_min=2,weight_max=2,base_catch_rate=1,alertness=0,strength=40,fish_type='TEST',burst_multiplier=1.5");
 await setData(baitId,{quantity:1000,fish_type:['TEST']}); await setData(hookId,{catch_rate:1});
 await setData(rodId,{max_weight:2}); await setData(reelId,{pull_strength:20}); await setData(lineId,{durability:70});
 const basic=await castAt();
 assert.equal(basic.mechanics.failure_reason,null); // Weight exactly equals rod capacity.
 // Resolve timezone from the area's country code, with a per-area override.
 assert.equal(basic.mechanics.balance.timezone,'Asia/Ho_Chi_Minh');
 await query("UPDATE fishing_areas SET timezone=' UTC ' WHERE id=$1",[areaId]);
 assert.equal((await castAt()).mechanics.balance.timezone,'UTC');
 await query("UPDATE fishing_areas SET timezone='Invalid/Timezone' WHERE id=$1",[areaId]);
 await assert.rejects(castAt(),/Invalid fishing area timezone/);
 await query("UPDATE fishing_areas SET timezone=' ' WHERE id=$1",[areaId]);
 assert.equal((await castAt()).mechanics.balance.timezone,'Asia/Ho_Chi_Minh');
 await query("UPDATE countries SET default_timezone=NULL WHERE code='VN'");
 await assert.rejects(castAt(),/Missing timezone/);
 await query("UPDATE fishing_areas SET timezone='UTC' WHERE id=$1",[areaId]);
 assert.equal((await castAt()).mechanics.balance.timezone,'UTC');
 await query("UPDATE countries SET default_timezone='Asia/Ho_Chi_Minh' WHERE code='VN'");
 await query('UPDATE fishing_areas SET timezone=NULL WHERE id=$1',[areaId]);
 assert.equal(basic.mechanics.fish_snapshot.effective_strength,40);
 assert.equal(basic.challenge_data.config.reelSpeed,3);
 assert.equal(basic.challenge_data.config.maxTension,70);
 assert.equal(basic.challenge_data.config.startDistance,30);
 await setData(reelId,{pull_strength:40}); await setData(lineId,{durability:140});
 const upgraded=await castAt();
 assert.equal(upgraded.challenge_data.config.reelSpeed,4); assert.equal(upgraded.challenge_data.config.maxTension,140);
 assert.deepEqual(upgraded.challenge_data.fish,basic.challenge_data.fish);
 await setData(lineId,{durability:100}); await setData(reelId,{pull_strength:80});

 // Replay parity for generated configurations, including long decimal stats.
 let generatedReplayComparisons=0;
 for(const rarity of ['COMMON','UNCOMMON','RARE','EPIC','LEGENDARY']) {
  for(const [strength,durability] of [[3.125,10.00009],[40.026,100.33333],[92.123456,999.99999]]) {
   await query('UPDATE species SET rarity=$1,strength=$2,burst_multiplier=1.512345 WHERE id=$3',[rarity,strength,speciesId]);
   await setData(lineId,{durability});
   const generated=(await castAt()).challenge_data;
   for(const policy of policies) {
    const played=play(generated,policy);
    const replay=(await query('SELECT replay_tension_challenge($1,$2,$3) AS r',[generated,played.inputs,played.s.tick]))[0].r;
    for(const key of ['result','tension','distance','stamina','rng']) assert.equal(replay[key],played.s[key],key);
    generatedReplayComparisons++;
   }
  }
 }
 await query("UPDATE species SET rarity='COMMON',strength=40,burst_multiplier=1.5 WHERE id=$1",[speciesId]);
 await setData(lineId,{durability:100});

 await db.exec('UPDATE species SET base_catch_rate=0.5,alertness=0.2'); await setData(hookId,{catch_rate:0.1});
 assert.equal((await castAt()).mechanics.fish_snapshot.catch_probability,0.48);
 await setData(baitId,{quantity:1000,fish_type:['OTHER']});
 assert.equal((await castAt()).mechanics.fish_snapshot.catch_probability,0.24);
 await setData(baitId,{quantity:1000,fish_type:['TEST']}); await setData(hookId,{catch_rate:1});
 await db.exec('UPDATE species SET base_catch_rate=1,alertness=0');
 // Inventory stats take precedence over old set payload overrides.
 await query("UPDATE user_equipments SET rod=jsonb_set(rod,'{0,max_weight}','1000')");
 await setData(rodId,{max_weight:1.99}); await resolveFailure(await castAt(),'ROD_OVERWEIGHT');
 await setData(rodId,{max_weight:2}); await db.exec('UPDATE species SET alertness=1');
 await resolveFailure(await castAt(),'HOOK_MISSED'); await db.exec('UPDATE species SET alertness=0');

 // Depth: interior/endpoint peaks, boundaries, out of range and point scope.
 await query('INSERT INTO depth_scope VALUES($1,0,20,10,2)',[scopeId]);
 await query('UPDATE species_in_area SET depth_scope_id=$1',[scopeId]);
 assert.equal((await castAt(10)).mechanics.failure_reason,null);
 await resolveFailure(await castAt(21),'NO_FISH');
 assert.equal((await castAt(0)).mechanics.failure_reason,'NO_FISH');
 assert.equal((await castAt(20)).mechanics.failure_reason,'NO_FISH');
 await db.exec('UPDATE depth_scope SET peak_depth=0'); assert.equal((await castAt(0)).mechanics.failure_reason,null);
 await db.exec('UPDATE depth_scope SET peak_depth=20'); assert.equal((await castAt(20)).mechanics.failure_reason,null);
 await db.exec('UPDATE depth_scope SET min_depth=5,max_depth=5,peak_depth=5');
 assert.equal((await castAt(5)).mechanics.failure_reason,null);
 assert.equal((await castAt(6)).mechanics.failure_reason,'NO_FISH');
 await db.exec('UPDATE depth_scope SET peak_depth=6'); assert.equal((await castAt(5)).mechanics.failure_reason,'NO_FISH');
 await db.exec('UPDATE species_in_area SET depth_scope_id=NULL,weight_rate=0');
 assert.equal((await castAt()).mechanics.failure_reason,'NO_FISH');
 await db.exec('UPDATE species_in_area SET weight_rate=1');
 await db.exec("UPDATE species SET active_time=CASE WHEN EXTRACT(HOUR FROM now() AT TIME ZONE 'Asia/Ho_Chi_Minh') BETWEEN 6 AND 18 THEN 'NIGHT' ELSE 'DAY' END");
 assert.equal((await castAt()).mechanics.failure_reason,'NO_FISH'); await db.exec("UPDATE species SET active_time='ALL'");

 // Relative frequencies reflect BOTH weight_rate and bait attraction.
 await query(`INSERT INTO species(id,name,rarity,weight_min,weight_max,active_time,experience_point,base_catch_rate,fish_type,strength,alertness,burst_multiplier)
  VALUES($1,'Other fish','COMMON',2,2,'ALL',1,1,'OTHER',40,0,1.5)`,[otherId]);
 await query('INSERT INTO species_in_area VALUES($1,$2,1,NULL)',[otherId,areaId]);
 const sample=async()=>{
  let matched=0;
  for(let i=0;i<400;i++) if((await castAt()).mechanics.fish_snapshot.species_id===speciesId) matched++;
  return matched/400;
 };
 await db.exec('SELECT setseed(0.25)'); const attracted=await sample();
 assert(attracted>0.56&&attracted<0.73,`Expected 1.8/(1.8+1), got ${attracted}`);
 await query('UPDATE species_in_area SET weight_rate=3 WHERE species_id=$1',[otherId]);
 const weighted=await sample();
 assert(weighted>0.29&&weighted<0.46,`Expected 1.8/(1.8+3), got ${weighted}`);
 await db.exec('SELECT setseed(0.125)'); const noLuck=await castAt();
 await setData(rodId,{max_weight:2,luck_bonus:100});
 await db.exec('SELECT setseed(0.125)'); const lucky=await castAt();
 assert.equal(lucky.mechanics.fish_snapshot.species_id,noLuck.mechanics.fish_snapshot.species_id);
 assert.equal(lucky.mechanics.fish_snapshot.catch_probability,noLuck.mechanics.fish_snapshot.catch_probability);
 await query('DELETE FROM species_in_area WHERE species_id=$1',[otherId]); await setData(rodId,{max_weight:2});

 // Invalid configuration fails explicitly. Private snapshots are inaccessible.
 await setData(reelId,{pull_strength:'20'}); await rejects('SELECT cast_rod($1,10)',[areaId]);
 await setData(reelId,{pull_strength:80}); await setData(baitId,{quantity:0,fish_type:['TEST']});
 await rejects('SELECT cast_rod($1,10)',[areaId]); await setData(baitId,{quantity:1000,fish_type:'TEST'});
 await rejects('SELECT cast_rod($1,10)',[areaId]); await setData(baitId,{quantity:1000,fish_type:['TEST']});
 await query('UPDATE species SET strength=NULL WHERE id=$1',[speciesId]); await rejects('SELECT cast_rod($1,10)',[areaId]);
 await query('UPDATE species SET strength=40 WHERE id=$1',[speciesId]);
 await rejects("SELECT cast_rod($1,'NaN'::numeric)",[areaId]);
 await db.exec('SET ROLE authenticated'); await rejects('SELECT * FROM fishing_session_mechanics'); await db.exec('RESET ROLE');

 // Switching sets mid-fight consumes the original bait exactly once.
 const frozen=await castAt();
 await query('INSERT INTO user_inventory VALUES($1,$2,$3)',[otherBaitId,uid,{quantity:10,fish_type:['OTHER']}]);
 await query('UPDATE user_equipments SET bait=$1',[JSON.stringify([{inventory_id:otherBaitId,is_used:true}])]);
 const activated=await start(frozen), played=play(activated.challenge_data,policies[2]);
 assert.equal(played.s.result,'won');
 const oldQuantity=await quantity(baitId), newQuantity=await quantity(otherBaitId);
 const challenge=structuredClone(activated.challenge_data);
 challenge.startedAt=Date.now()-Math.ceil(played.s.tick/challenge.config.tickRate*1000)-1000;
 challenge.activatedAt=challenge.startedAt; challenge.expiresAt=challenge.startedAt+90000;
 await query('UPDATE fishing_sessions SET challenge_data=$2,bite_at=to_timestamp($3/1000.0),expires_at=to_timestamp($4/1000.0) WHERE id=$1',
  [frozen.id,challenge,challenge.startedAt,challenge.expiresAt]);
 const payload={sessionId:frozen.id,inputs:played.inputs,totalTicks:played.s.tick,claimedResult:played.s.result};
 const reward=(await query('SELECT submit_tension_challenge($1) AS r',[payload]))[0].r;
 assert.equal(reward.success,true);
 assert.equal(await quantity(baitId),oldQuantity-1); assert.equal(await quantity(otherBaitId),newQuantity);
 await rejects('SELECT submit_tension_challenge($1)',[payload]); assert.equal(await quantity(baitId),oldQuantity-1);
 await query('UPDATE user_equipments SET bait=$1',[JSON.stringify([{inventory_id:baitId,is_used:true}])]);

 // Depleted bait cannot earn rewards, even with a valid winning replay.
 const depleted=await castAt(), ready=await start(depleted);
 const completed=play(ready.challenge_data,policies[2]);
 assert.equal(completed.s.result,'won');
 const prepared=structuredClone(ready.challenge_data);
 prepared.startedAt=Date.now()-Math.ceil(completed.s.tick/prepared.config.tickRate*1000)-1000;
 prepared.activatedAt=prepared.startedAt;prepared.expiresAt=prepared.startedAt+90000;
 await query('UPDATE fishing_sessions SET challenge_data=$2,bite_at=to_timestamp($3/1000.0),expires_at=to_timestamp($4/1000.0) WHERE id=$1',
  [depleted.id,prepared,prepared.startedAt,prepared.expiresAt]);
 await setData(baitId,{quantity:0,fish_type:['TEST']});
 const beforeDepleted=await rewardCounts();
 const denied=(await query('SELECT submit_tension_challenge($1) AS r',[
  {sessionId:depleted.id,inputs:completed.inputs,totalTicks:completed.s.tick,claimedResult:'won'}]))[0].r;
 assert.equal(denied.result,'BAIT_UNAVAILABLE'); assert.deepEqual(await rewardCounts(),beforeDepleted);
 await setData(baitId,{quantity:1000,fish_type:['TEST']});

 // A verified, legitimately fast reel must not hit the legacy 300 ms floor.
 await setData(reelId,{pull_strength:1000000});
 const fast=await castAt(), fastReady=await start(fast);
 const fastPlay=play(fastReady.challenge_data,()=>true);
 assert.equal(fastPlay.s.result,'won');assert(fastPlay.s.tick/60*1000<300);
 const fastData=structuredClone(fastReady.challenge_data);
 fastData.startedAt=Date.now()-1000;fastData.activatedAt=fastData.startedAt;fastData.expiresAt=fastData.startedAt+90000;
 await query('UPDATE fishing_sessions SET challenge_data=$2,bite_at=to_timestamp($3/1000.0),expires_at=to_timestamp($4/1000.0) WHERE id=$1',
  [fast.id,fastData,fastData.startedAt,fastData.expiresAt]);
 assert.equal((await query('SELECT submit_tension_challenge($1) AS r',[
  {sessionId:fast.id,inputs:fastPlay.inputs,totalTicks:fastPlay.s.tick,claimedResult:'won'}]))[0].r.success,true);
 return {generatedReplayComparisons,spawnSamples:800,matchedShare:attracted,weightedShare:weighted};
}
