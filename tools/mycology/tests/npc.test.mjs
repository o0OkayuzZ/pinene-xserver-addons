import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { world,system,FakeEntity,ItemStack,reset } from './mock-minecraft.mjs';
import { forms,responses } from './mock-forms.mjs';
import { CONFIG } from '../pack/BP/scripts/mycology/config.js';
import { initializeNpc,canUse } from '../pack/BP/scripts/mycology/npc.js';
import { sessions } from '../pack/BP/scripts/mycology/sessions.js';
import '../pack/BP/scripts/mycology/index.js';

const minute=[...system.intervals.values()].find(t=>t.ticks===1200).f;
const originalNow=Date.now;
let now;
const state=n=>JSON.parse(n.getDynamicProperty(CONFIG.npcStateKey));
const expected=['red_mushroom','brown_mushroom','crimson_fungus','warped_fungus'].map(x=>['minecraft:'+x,64]);
function setup(island=false){
 reset();sessions.clear();forms.length=0;responses.length=0;now=1800000000000;Date.now=()=>now;
 const p=new FakeEntity('player');world.entities.set(p.id,p);initializeNpc();
 if(island)p.dimension.getBiome=()=>({id:'minecraft:mushroom_island',hasTags:()=>false});
 return p;
}
test.afterEach(()=>{Date.now=originalNow;});
function tickMinutes(n=15,roll=0){
 const random=Math.random;let call=0;Math.random=()=>++call===2?roll:0;
 try{for(let i=0;i<n;i++)minute();}finally{Math.random=random;}
}
function npcs(){return [...world.entities.values()].filter(e=>e.typeId===CONFIG.npcType);}
function spawn(){tickMinutes();return npcs().at(-1);}
function fireTimers(){
 const timers=[...system.timers];for(const [id,t] of timers){
  if(system.timers.has(id)){system.timers.delete(id);t.f();}
 }
}
function name(p,n,name='Keeper'){
 const tag=new ItemStack('minecraft:name_tag');tag.nameTag=name;n.nameTag=name;
 world.afterEvents.playerInteractWithEntity.emit({player:p,target:n,beforeItemStack:tag,itemStack:undefined});
}
function drop(n){world.afterEvents.entityDie.emit({deadEntity:n,damageSource:{cause:'entityAttack'}});}
function assertDrops(p){assert.deepEqual(p.dimension.drops.map(d=>[d.item.typeId,d.item.amount]),expected);}
function legacy(p,{id='legacy',expiresAt=now+100000,island=false,matched=true,named=false}={}){
 const n=new FakeEntity(id,CONFIG.npcType,p.dimension);n.setDynamicProperty(CONFIG.naturalTokenKey,id);world.entities.set(n.id,n);
 if(matched)world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({version:1,entityId:id,token:id,island,expiresAt}));
 if(named)n.nameTag='Old keeper';return n;
}

test('spawn cadence remains 15 active minutes, countdown persists without an offline burst',()=>{
 setup();tickMinutes(14);assert.equal(npcs().length,0);assert.equal(world.getDynamicProperty(CONFIG.spawnClockKey),14);
 initializeNpc();tickMinutes(1);assert.equal(npcs().length,1);assert.equal(world.getDynamicProperty(CONFIG.spawnClockKey),0);
 now+=86400000;tickMinutes(1);assert.equal(npcs().length,1);
 world.entities.delete('player');tickMinutes(20);assert.equal(world.getDynamicProperty(CONFIG.spawnClockKey),1);
});
for(const [island,chance,lifetime] of [[false,0.04,1800000],[true,0.20,2700000]]){
 test(`${island?'island':'normal'} chance boundary, lifetime and safe 24–48 block radius`,()=>{
  const p=setup(island);tickMinutes(15,chance);assert.equal(npcs().length,0);
  tickMinutes(15,chance-0.000001);const n=npcs()[0];assert(n);
  assert.equal(state(n).spawnedAt,now);assert.equal(state(n).expiresAt,now+lifetime);assert.equal(state(n).island,island);
  const distance=Math.hypot(n.location.x-p.location.x,n.location.z-p.location.z);
  assert(distance>=24&&distance<=48);assert.equal(n.location.y,64);
 });
}
test('each lottery spawns at most one, existing temporary and permanent NPCs never block it',()=>{
 const p=setup();const a=spawn();now+=900000;const b=spawn();name(p,a);now+=900000;const c=spawn();
 assert.equal(npcs().length,3);assert(state(a).permanent);assert.equal(state(b).expiresAt,1800000000000+2700000);
 assert.equal(state(c).expiresAt,now+1800000);assert.equal(world.getDynamicProperty(CONFIG.leaseKey),undefined);
});
test('independent timers retire A without removing B; distance alone never retires either',()=>{
 const p=setup();const a=spawn();now+=900000;const b=spawn();assert.equal(system.timers.size,2);
 p.location.x=100000;fireTimers();assert(a.isValid&&b.isValid);
 now=state(a).expiresAt;fireTimers();assert.equal(a.isValid,false);assert.equal(b.isValid,true);assert.equal(system.timers.size,1);
 now=state(b).expiresAt;fireTimers();assert.equal(b.isValid,false);assert.equal(p.dimension.drops.length,0);
 // Even an unexpected duplicate death signal after remove has no reward.
 drop(a);drop(b);assert.equal(p.dimension.drops.length,0);
});
test('active UI allows only existing sessions and never more than five minutes grace',()=>{
 const p=setup(),a=spawn();p.location={...a.location};sessions.set(p.id,{npcId:a.id,openedAt:now});
 now=state(a).expiresAt;fireTimers();assert(a.isValid);assert.equal(canUse(p,a,false),false);assert(canUse(p,a,true));
 assert.equal([...system.timers.values()][0].ticks,200);
 now+=299999;fireTimers();assert(a.isValid);assert.equal([...system.timers.values()][0].ticks,1);
 now++;assert.equal(canUse(p,a,true),false);fireTimers();assert.equal(a.isValid,false);assert.equal(p.dimension.drops.length,0);
});
test('ending UI during grace retires only that NPC at the next bounded check',()=>{
 const p=setup(),a=spawn();now+=60000;const b=spawn();sessions.set(p.id,{npcId:a.id});now=state(a).expiresAt;fireTimers();
 sessions.clear();now+=10000;fireTimers();assert.equal(a.isValid,false);assert(b.isValid);
});
for(const named of [false,true])test(`${named?'permanent':'temporary'} natural actual death drops four exact stacks once`,()=>{
 const p=setup(),n=spawn();if(named)name(p,n);drop(n);drop(n);assertDrops(p);assert(state(n).naturalOrigin);assert(state(n).deathClaimed);assert.equal(system.timers.size,0);
});
test('actual death during a delayed expiry callback still earns four stacks',()=>{
 const p=setup(),n=spawn();now=state(n).expiresAt+CONFIG.maxGraceMs+1;drop(n);drop(n);assertDrops(p);
});
test('summon, egg and test individuals, including named ones, have no lifetime or special drops',()=>{
 const p=setup();for(const id of ['summon','egg','test']){
  const n=new FakeEntity(id,CONFIG.npcType,p.dimension);world.entities.set(id,n);name(p,n);
  now+=86400000;world.afterEvents.entityLoad.emit({entity:n});assert(n.isValid);assert.equal(n.getDynamicProperty(CONFIG.npcStateKey),undefined);assert(canUse(p,n));drop(n);
 }assert.equal(p.dimension.drops.length,0);
});
test('naming disables expiry, preserves origin and token, and remains permanent through renames',()=>{
 const p=setup(),n=spawn(),token=n.getDynamicProperty(CONFIG.naturalTokenKey);name(p,n);
 assert.equal(state(n).expiresAt,null);assert(state(n).permanent&&state(n).naturalOrigin);assert.equal(system.timers.size,0);
 now+=86400000;name(p,n,'Renamed');fireTimers();assert(n.isValid);assert.equal(n.getDynamicProperty(CONFIG.naturalTokenKey),token);
 n.nameTag='';world.afterEvents.entityLoad.emit({entity:n});assert(state(n).permanent);assert(n.isValid);
});
test('name tag without an actual name does not grant permanence or open a form',()=>{
 const p=setup(),n=spawn();p.location={...n.location};const tag=new ItemStack('minecraft:name_tag');tag.nameTag='Not yet applied';
 world.afterEvents.playerInteractWithEntity.emit({player:p,target:n,beforeItemStack:tag});
 assert.equal(state(n).permanent,false);assert.equal(forms.length,0);
});
test('consumed last name tag bypasses UI; bare hand and ordinary item still open appraisal',async()=>{
 const p=setup(),n=spawn();p.location={...n.location};name(p,n);assert.equal(forms.length,0);
 for(const item of [undefined,new ItemStack('minecraft:stone')]){
  responses.push({canceled:true});world.afterEvents.playerInteractWithEntity.emit({player:p,target:n,beforeItemStack:item,itemStack:item});
  await new Promise(resolve=>setImmediate(resolve));
 }assert.equal(forms.length,2);assert.equal(sessions.size,0);
});
test('JSON permits native naming and excludes name tags from the trade interaction',()=>{
 const c=JSON.parse(readFileSync(new URL('../pack/BP/entities/mushroom_appraiser.json',import.meta.url)))['minecraft:entity']['components'];
 assert.deepEqual(c['minecraft:nameable'],{allow_name_tag_renaming:true,always_show:true});assert(c['minecraft:persistent']);
 assert.deepEqual(c['minecraft:interact'].interactions[0].on_interact.filters,{test:'has_equipment',subject:'other',domain:'hand',operator:'not',value:'name_tag'});
 assert.equal(c['minecraft:interact'].interactions[0].on_interact.event,'pinene:interacted');
 assert.equal(c['minecraft:loot'],undefined);assert.equal(c['minecraft:despawn'],undefined);
});
function reload(n){
 const copy=new FakeEntity(n.id,n.typeId,n.dimension);copy.props=new Map(n.props);copy.nameTag=n.nameTag;copy.location={...n.location};
 world.entities.set(copy.id,copy);return copy;
}
test('restart rebuilds each remaining deadline from persisted entity data',()=>{
 setup();const a=spawn();now+=600000;const b=spawn();const sa=state(a),sb=state(b);
 const aa=reload(a),bb=reload(b);system.timers.clear();initializeNpc();assert.equal(system.timers.size,2);
 assert.deepEqual(state(aa),sa);assert.deepEqual(state(bb),sb);
 assert.deepEqual([...system.timers.values()].map(t=>t.ticks).sort((a,b)=>a-b),[24000,36000]);
});
test('permanent restart retains origin and four-stack death reward with stale v1 lease',()=>{
 const p=setup(),n=spawn();name(p,n);const copy=reload(n);world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({entityId:'other',token:'stale',expiresAt:0}));
 now+=86400000;system.timers.clear();initializeNpc();assert(copy.isValid);assert(state(copy).permanent&&state(copy).naturalOrigin);
 assert.equal(system.timers.size,0);drop(copy);drop(copy);assertDrops(p);
});
test('restart between native naming and JS callback still recognizes the saved name',()=>{
 setup();const n=spawn();n.nameTag='Native saved name';assert.equal(state(n).permanent,false);
 now+=86400000;const copy=reload(n);initializeNpc();assert(copy.isValid);assert(state(copy).permanent);
});
for(const named of [false,true])test(`${named?'permanent':'temporary'} unload removes wakeup; load after deadline reconciles safely`,()=>{
 const p=setup(),n=spawn();if(named)name(p,n);world.entities.delete(n.id);n.isValid=false;
 world.afterEvents.entityRemove.emit({removedEntityId:n.id});assert.equal(system.timers.size,0);
 now+=86400000;initializeNpc();const copy=reload(n);world.afterEvents.entityLoad.emit({entity:copy});
 assert.equal(copy.isValid,named);assert.equal(p.dimension.drops.length,0);
});
test('unloaded entity at wakeup is not treated as dead; future load restores remaining timer',()=>{
 setup();const n=spawn();world.entities.delete(n.id);fireTimers();assert.equal(system.timers.size,0);
 now+=600000;const copy=reload(n);world.afterEvents.entityLoad.emit({entity:copy});assert(copy.isValid);assert.equal([...system.timers.values()][0].ticks,24000);
});
test('legacy matching lease migrates once, preserving deadline, island and original world data',()=>{
 const p=setup(),n=legacy(p,{island:true});const old=world.getDynamicProperty(CONFIG.leaseKey);
 world.afterEvents.entityLoad.emit({entity:n});const saved=state(n);assert.equal(saved.migration,'lease-v1');assert(saved.island);assert.equal(saved.expiresAt,now+100000);
 assert.equal(saved.spawnedAt,saved.expiresAt-2700000);assert.equal(world.getDynamicProperty(CONFIG.leaseKey),old);
 world.setDynamicProperty(CONFIG.leaseKey,undefined);now+=1000;initializeNpc();assert.deepEqual(state(n),saved);
});
test('unloaded legacy lease survives new spawns and later migrates independently',()=>{
 const p=setup(),n=legacy(p);world.entities.delete(n.id);const old=world.getDynamicProperty(CONFIG.leaseKey);initializeNpc();spawn();
 assert.equal(world.getDynamicProperty(CONFIG.leaseKey),old);const copy=reload(n);world.afterEvents.entityLoad.emit({entity:copy});assert(copy.isValid);assert.equal(state(copy).migration,'lease-v1');assert.equal(system.timers.size,2);
});
test('legacy orphan is preserved for one bounded recovery stay, not deleted as stale',()=>{
 const p=setup(),n=legacy(p,{matched:false});world.afterEvents.entityLoad.emit({entity:n});assert(n.isValid);
 const saved=state(n);assert.equal(saved.migration,'orphan-v1');assert.equal(saved.island,null);assert.equal(saved.spawnedAt,null);assert.equal(saved.expiresAt,now+2700000);
 now+=1000;initializeNpc();assert.deepEqual(state(n),saved);now=saved.expiresAt;fireTimers();assert.equal(n.isValid,false);assert.equal(p.dimension.drops.length,0);
});
test('named orphan never undergoes stale removal and retains natural death reward',()=>{
 const p=setup(),n=legacy(p,{matched:false,named:true});world.afterEvents.entityLoad.emit({entity:n});now+=86400000;initializeNpc();assert(n.isValid);assert(state(n).permanent);drop(n);assertDrops(p);
});
test('corrupt legacy lease does not delete an orphan or block other loaded NPCs',()=>{
 const p=setup(),n=legacy(p,{matched:false});world.setDynamicProperty(CONFIG.leaseKey,'bad json');
 const warn=console.warn;console.warn=()=>{};try{initializeNpc();}finally{console.warn=warn;}
 assert(n.isValid);assert.equal(state(n).migration,'orphan-v1');assert(spawn());
});
test('repeated load notifications keep one timer per NPC; runtime never scans dimensions',()=>{
 const p=setup(),a=spawn(),b=spawn();
 p.dimension.getEntities=()=>{throw new Error('unexpected runtime scan');};
 for(let i=0;i<3;i++)world.afterEvents.entityLoad.emit({entity:a});
 assert.equal(system.timers.size,2);name(p,a);assert.equal(system.timers.size,1);
 spawn();assert.equal(npcs().length,3);assert.equal(system.timers.size,2);
 now=state(b).expiresAt;fireTimers();assert(a.isValid);assert.equal(b.isValid,false);
});
test('an invalid saved v2 state is preserved and does not block other startup deadlines',()=>{
 const p=setup(),a=spawn(),b=spawn();a.setDynamicProperty(CONFIG.npcStateKey,'corrupt');now=state(b).expiresAt;
 const warn=console.warn;console.warn=()=>{};try{initializeNpc();}finally{console.warn=warn;}
 assert(a.isValid);assert.equal(a.getDynamicProperty(CONFIG.npcStateKey),'corrupt');assert.equal(b.isValid,false);assert.equal(p.dimension.drops.length,0);
});
test('all four edited runtime files exactly match the tested authoring BP',()=>{
 const author=new URL('../pack/BP/',import.meta.url);
 const runtime=new URL('../../../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/',import.meta.url);
 for(const path of ['entities/mushroom_appraiser.json','scripts/mycology/config.js','scripts/mycology/index.js','scripts/mycology/npc.js'])
  assert.deepEqual(readFileSync(new URL(path,runtime)),readFileSync(new URL(path,author)),path);
});
