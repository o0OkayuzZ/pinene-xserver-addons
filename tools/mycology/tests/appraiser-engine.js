// Disposable local world ONLY; prepare_appraiser_world.py installs this harness.
import {world,system,ItemStack} from '@minecraft/server';
import {CONFIG} from './mycology/config.js';
import {engineAttempt,initializeNpc,reconcileNpcInteraction,canUse} from './mycology/npc.js';
import {sessions} from './mycology/sessions.js';
const pause=t=>new Promise(resolve=>system.runTimeout(resolve,t));
const key='appraiser_test:phase',resultsKey='appraiser_test:results';
const ids=['red_mushroom','brown_mushroom','crimson_fungus','warped_fungus'].map(x=>'minecraft:'+x);
let running=false;
const removedAt=new Map();
world.afterEvents.entityRemove.subscribe(e=>{
 if(e.typeId===CONFIG.npcType){removedAt.set(e.removedEntityId,Date.now());log('ENTITY_REMOVE',{id:e.removedEntityId});}
});
world.afterEvents.entityLoad.subscribe(e=>{
 if(e.entity.typeId===CONFIG.npcType)log('ENTITY_LOAD',{id:e.entity.id});
});
function log(message,value){console.warn('[APPRAISER ENGINE] '+message+' '+JSON.stringify(value??null));}
function check(value,message){if(!value)throw new Error(message);}
const state=n=>JSON.parse(n.getDynamicProperty(CONFIG.npcStateKey));
const save=(n,s)=>n.setDynamicProperty(CONFIG.npcStateKey,JSON.stringify(s));
const npcById=id=>{try{return world.getEntity(id);}catch{return undefined;}};
const natural=dim=>dim.getEntities({type:CONFIG.npcType}).filter(n=>n.getDynamicProperty(CONFIG.npcStateKey));
function fixture(p,changes={}){
 const n=p.dimension.spawnEntity(CONFIG.npcType,{x:p.location.x+5,y:p.location.y,z:p.location.z});
 n.setDynamicProperty(CONFIG.naturalTokenKey,'engine-'+n.id);
 save(n,{version:2,naturalOrigin:true,spawnedAt:Date.now(),expiresAt:Date.now()+1800000,island:false,permanent:false,retired:false,deathClaimed:false,...changes});
 return n;
}
function clean(dim){
 for(const n of dim.getEntities({type:CONFIG.npcType}))n.remove();
 for(const n of dim.getEntities({type:'minecraft:item'}))n.remove();
}
function drops(dim){return dim.getEntities({type:'minecraft:item'}).map(n=>{const s=n.getComponent('minecraft:item').itemStack;return [s.typeId,s.amount];});}
function four(dim){const got=drops(dim);check(got.length===4&&ids.every(id=>got.filter(x=>x[0]===id&&x[1]===64).length===1),'expected four stacks: '+JSON.stringify(got));}
async function record(name,fn){
 let result;try{await fn();result={name,pass:true};}catch(e){result={name,pass:false,error:String(e),stack:e.stack};}
 const results=JSON.parse(world.getDynamicProperty(resultsKey)??'[]');results.push(result);world.setDynamicProperty(resultsKey,JSON.stringify(results));log('RESULT',result);
}
async function spawnCheck(p){
 await record('native spawn permits A + B and permanent A with unchanged balance config',async()=>{
  p.runCommand('gamemode creative @s');p.teleport({x:0.5,y:-60,z:0.5});
  const area=p.dimension.runCommand('tickingarea add circle 0 -60 0 4 appraiser_engine');
  log('SPAWN_AREA',area);await pause(80);
  p.dimension.runCommand('fill -32 -64 -16 32 -64 16 grass_block');await pause(20);
  check(p.dimension.getBlock({x:0,y:-64,z:0})?.typeId==='minecraft:grass_block','test grass platform unavailable');
  const top=p.dimension.getTopmostBlock({x:0,z:0});
  log('SPAWN_DIAGNOSTIC',{position:p.location,mode:p.getGameMode(),top:top?{type:top.typeId,location:top.location,waterlogged:top.isWaterlogged}:null,biome:p.dimension.getBiome(p.location).id});
  check(CONFIG.spawnIntervalMinutes===15&&CONFIG.normalChance===0.04&&CONFIG.islandChance===0.20,'balance changed');
  const existing=new Set(natural(p.dimension).map(n=>n.id));
  const random=Math.random;try{Math.random=()=>0;engineAttempt([p]);engineAttempt([p]);}finally{Math.random=random;}
  const ns=natural(p.dimension).filter(n=>!existing.has(n.id));check(ns.length===2,'expected two natural spawns, got '+ns.length);
  for(const n of ns){const s=state(n);check(s.expiresAt-s.spawnedAt===1800000,'normal lifetime');check(Math.hypot(n.location.x-p.location.x,n.location.z-p.location.z)>=24,'distance');}
  ns[0].nameTag='Keeper';reconcileNpcInteraction(ns[0]);check(state(ns[0]).permanent,'named natural not permanent');
  try{Math.random=()=>0;engineAttempt([p]);}finally{Math.random=random;}
  check(natural(p.dimension).length===existing.size+3,'permanent blocks spawn');
  for(const n of natural(p.dimension))if(!existing.has(n.id))n.remove();
 });
 p.dimension.runCommand('tickingarea remove appraiser_engine');
}
async function run(p){
 if(running)return;running=true;
 try{
  world.setDynamicProperty(resultsKey,'[]');clean(p.dimension);
  p.runCommand('gamemode creative @s');p.teleport({x:0.5,y:-60,z:0.5},{rotation:{x:0,y:0}});
  p.dimension.runCommand('time set day');await pause(60);
  await spawnCheck(p);
  for(const named of [false,true])await record((named?'permanent':'temporary')+' natural death: four exact stacks',async()=>{
   clean(p.dimension);const n=fixture(p);if(named)n.nameTag='Named';reconcileNpcInteraction(n);n.kill();await pause(5);four(p.dimension);
  });
  await record('administrative named summon death: zero special loot',async()=>{
   clean(p.dimension);const n=p.dimension.spawnEntity(CONFIG.npcType,{x:5,y:-60,z:0});n.nameTag='Admin';n.kill();await pause(5);check(drops(p.dimension).length===0,'admin loot');
  });
  await record('independent real timers retire only expired A and never pay loot',async()=>{
   clean(p.dimension);const a=fixture(p,{expiresAt:Date.now()+500}),b=fixture(p,{expiresAt:Date.now()+60000});
   const aid=a.id,bid=b.id;reconcileNpcInteraction(a);reconcileNpcInteraction(b);await pause(25);
   check(!npcById(aid)&&npcById(bid),'independent expiry failed');check(drops(p.dimension).length===0,'expiry loot');
  });
  await record('UI grace respects existing session and hard five-minute cap',async()=>{
   clean(p.dimension);const n=fixture(p,{expiresAt:Date.now()-1000});sessions.set(p.id,{npcId:n.id,openedAt:Date.now()});
   reconcileNpcInteraction(n);check(n.isValid&&canUse(p,n,true)&&!canUse(p,n,false),'grace permissions');
   save(n,{...state(n),expiresAt:Date.now()-CONFIG.maxGraceMs-1});reconcileNpcInteraction(n);sessions.delete(p.id);
   check(!n.isValid&&drops(p.dimension).length===0,'grace cap');
  });
  await record('legacy lease migrates and dies with four stacks',async()=>{
   clean(p.dimension);const n=p.dimension.spawnEntity(CONFIG.npcType,{x:5,y:-60,z:0}),t='legacy-'+n.id;
   n.setDynamicProperty(CONFIG.naturalTokenKey,t);world.setDynamicProperty(CONFIG.leaseKey,JSON.stringify({entityId:n.id,token:t,island:true,expiresAt:Date.now()+60000}));
   reconcileNpcInteraction(n);check(state(n).migration==='lease-v1'&&state(n).island,'migration');n.kill();await pause(5);four(p.dimension);
  });
  await record('orphan legacy token is preserved once, including name permanence',async()=>{
   clean(p.dimension);world.setDynamicProperty(CONFIG.leaseKey,undefined);
   const n=p.dimension.spawnEntity(CONFIG.npcType,{x:5,y:-60,z:0});n.setDynamicProperty(CONFIG.naturalTokenKey,'orphan');
   reconcileNpcInteraction(n);const first=state(n);check(first.migration==='orphan-v1'&&n.isValid,'orphan removed');
   initializeNpc();check(state(n).expiresAt===first.expiresAt,'migration renewed');n.nameTag='Old keeper';reconcileNpcInteraction(n);check(state(n).permanent,'orphan permanence');
  });
  clean(p.dimension);await prepareName(p);world.setDynamicProperty(key,'native-name');log('READY_NATIVE_NAME',{npc:world.getDynamicProperty('appraiser_test:namedId')});
 }finally{running=false;}
}
async function prepareName(p){
 clean(p.dimension);p.runCommand('gamemode survival @s');p.teleport({x:0.5,y:-60,z:0.5},{rotation:{x:0,y:0}});
 const n=fixture(p);n.teleport({x:0.5,y:-60,z:2.5});n.addEffect('slowness',20000,{amplifier:255,showParticles:false});
 const c=p.getComponent('minecraft:inventory').container;for(let i=0;i<c.size;i++)c.setItem(i);
 const tag=new ItemStack('minecraft:name_tag',1);tag.nameTag='Appraiser Keeper';c.setItem(0,tag);p.selectedSlotIndex=0;
 world.setDynamicProperty('appraiser_test:namedId',n.id);p.sendMessage('TEST: right-click the appraiser with the single named tag.');await pause(5);
}
async function inspectName(p){
 await record('native survival name tag consumed, name applied, v2 permanent and no appraisal session',async()=>{
  const n=npcById(world.getDynamicProperty('appraiser_test:namedId'));check(n,'missing native name target');
  const s=state(n);check(n.nameTag==='Appraiser Keeper'&&s.permanent&&s.naturalOrigin&&s.expiresAt===null,'name/state '+JSON.stringify({name:n.nameTag,state:s}));
  check(!p.getComponent('minecraft:inventory').container.getItem(0),'single name tag not consumed');check(!sessions.has(p.id),'name opened appraisal');
 });
}
async function prepareRestart(p){
 const n=npcById(world.getDynamicProperty('appraiser_test:namedId'));check(n&&state(n).permanent,'native permanent required');
 const expiry=fixture(p,{expiresAt:Date.now()+5000}),future=fixture(p,{expiresAt:Date.now()+1800000});
 world.setDynamicProperty('appraiser_test:expiredId',expiry.id);world.setDynamicProperty('appraiser_test:futureId',future.id);
 world.setDynamicProperty('appraiser_test:futureState',JSON.stringify(state(future)));world.setDynamicProperty(key,'restart-pending');
 reconcileNpcInteraction(expiry);reconcileNpcInteraction(future);log('READY_RESTART',{permanent:n.id,expired:expiry.id,future:future.id});
}
async function verifyRestart(p){
 await pause(60);
 await record('actual world reopen preserves permanent name/origin and future deadline, expires old temporary',async()=>{
  const n=npcById(world.getDynamicProperty('appraiser_test:namedId')),future=npcById(world.getDynamicProperty('appraiser_test:futureId'));
  check(n&&state(n).permanent&&state(n).naturalOrigin&&n.nameTag==='Appraiser Keeper','permanent restart');
  check(!npcById(world.getDynamicProperty('appraiser_test:expiredId')),'expired entity remains');
  check(future&&future.getDynamicProperty(CONFIG.npcStateKey)===world.getDynamicProperty('appraiser_test:futureState'),'future deadline changed');
  check(drops(p.dimension).length===0,'restart expiry loot');
 });
 world.setDynamicProperty(key,'restart-done');log('READY_UNLOAD');
}
async function unload(p){
 p.runCommand('gamemode creative @s');
 // Creative dimension travel needs no remote overworld platform or ticking area.
 const deadline=Date.now()+120000;
 const expired=fixture(p,{expiresAt:deadline}),future=fixture(p,{expiresAt:Date.now()+1800000});
 reconcileNpcInteraction(expired);reconcileNpcInteraction(future);
 world.setDynamicProperty('appraiser_test:unloadExpired',expired.id);world.setDynamicProperty('appraiser_test:unloadFuture',future.id);
 const source=p.dimension;
 p.teleport({x:5000.5,y:100,z:5000.5},{dimension:world.getDimension('nether')});await pause(20);
 try{source.runCommand('tickingarea remove appraiser_remote');}catch{}
 const keeper=world.getDynamicProperty('appraiser_test:namedId');
 log('AWAY',{position:p.location,deadline,expired:expired.id,future:future.id,keeper});
 for(let i=0;i<9;i++){
  await pause(200);
  if(removedAt.has(expired.id)&&removedAt.has(future.id)&&removedAt.has(keeper))break;
 }
 const unloaded={expired:removedAt.get(expired.id),future:removedAt.get(future.id),permanent:removedAt.get(keeper)};
 log('UNLOADED',unloaded);
 while(Date.now()<=deadline+1000)await pause(100);
 p.teleport({x:0.5,y:-60,z:0.5},{dimension:source});await pause(100);
 await record('real chunk unload/load preserves permanent and future, removes expired without loot',async()=>{
  check(!npcById(world.getDynamicProperty('appraiser_test:unloadExpired')),'expired load remains');
  check(npcById(world.getDynamicProperty('appraiser_test:unloadFuture')),'future missing');
  const n=npcById(world.getDynamicProperty('appraiser_test:namedId'));check(n&&state(n).permanent&&state(n).naturalOrigin,'permanent load');
  check(drops(p.dimension).length===0,'unload expiry loot');
  check(unloaded.expired<deadline&&unloaded.future&&unloaded.permanent,'source entities never unloaded before expiry');
 });
 p.runCommand('gamemode creative @s');
 log('READY_FINAL_DEATH');
}
async function finalDeath(p){
 await record('native-named permanent after actual restart and travel still drops four stacks',async()=>{
  const n=npcById(world.getDynamicProperty('appraiser_test:namedId'));check(n,'keeper absent');n.kill();await pause(5);four(p.dimension);
 });
 world.setDynamicProperty(key,'done');log('COMPLETE',JSON.parse(world.getDynamicProperty(resultsKey)));
}
world.afterEvents.playerInteractWithEntity.subscribe(e=>{
 if(e.target.typeId!==CONFIG.npcType)return;
 log('NATIVE_INTERACTION',{before:e.beforeItemStack?.typeId,after:e.itemStack?.typeId,name:e.target.nameTag});
 system.run(()=>log('INTERACTION_STATE',{state:e.target.getDynamicProperty(CONFIG.npcStateKey),ui:sessions.has(e.player.id)}));
});
system.afterEvents.scriptEventReceive.subscribe(e=>{
 const p=e.sourceEntity;if(!p||p.typeId!=='minecraft:player')return;
 const actions={'appraiser_test:run':run,'appraiser_test:spawn':spawnCheck,'appraiser_test:inspect':inspectName,'appraiser_test:restart':prepareRestart,'appraiser_test:unload':unload,'appraiser_test:death':finalDeath};
 if(actions[e.id])void actions[e.id](p).catch(error=>log('HARNESS_ERROR',String(error)));
 if(e.id==='appraiser_test:status')log('STATUS',{phase:world.getDynamicProperty(key),results:world.getDynamicProperty(resultsKey)});
});
world.afterEvents.playerSpawn.subscribe(e=>{
 if(!e.initialSpawn)return;
 system.runTimeout(()=>{
  const phase=world.getDynamicProperty(key);log('JOIN',{phase});
  if(phase==='restart-pending')void verifyRestart(e.player).catch(error=>log('HARNESS_ERROR',String(error)));
  else if(!phase)void run(e.player).catch(error=>log('HARNESS_ERROR',String(error)));
 },40);
});
