import { world,system,ItemStack } from '@minecraft/server';
import { CONFIG } from './config.js';
import { sessions,hasNpcSession } from './sessions.js';
import { readJSON,writeJSON,validEntity,entityById,distance2,logError } from './util.js';
// Entity properties are authoritative; the map only holds loaded-entity wakeups.
const expiryTimers=new Map();
function token(entity){return entity.getDynamicProperty(CONFIG.naturalTokenKey);}
function clearExpiry(id){
 const timer=expiryTimers.get(id);
 if(timer!==undefined)system.clearRun(timer);
 expiryTimers.delete(id);
}
function saveState(entity,state){writeJSON(entity,CONFIG.npcStateKey,state);}
function stateFor(entity){
 let state=readJSON(entity,CONFIG.npcStateKey,null);
 if(!state&&token(entity)){
  // Lazy, once per entity migration. Keep v1 intact for still-unloaded entities.
  let old=null;
  try{old=readJSON(world,CONFIG.leaseKey,null);}catch(error){logError('legacy NPC lease',error);}
  const matched=old?.entityId===entity.id&&old.token===token(entity)&&Number.isFinite(old.expiresAt);
  const now=Date.now();
  // Orphaned v1 tokens have no trustworthy deadline/biome. Give a single
  // conservative 45-minute recovery stay instead of deleting on world upgrade.
  const onIsland=matched?old.island===true:null;
  const expiresAt=matched?old.expiresAt:now+CONFIG.islandLifetimeMs;
  state={version:2,naturalOrigin:true,spawnedAt:matched?expiresAt-(onIsland?CONFIG.islandLifetimeMs:CONFIG.normalLifetimeMs):null,
   expiresAt,island:onIsland,permanent:false,deathClaimed:false,retired:false,migration:matched?'lease-v1':'orphan-v1'};
  saveState(entity,state);
 }
 if(!state)return null;
 if(state.version!==2||state.naturalOrigin!==true||typeof state.permanent!=='boolean'||
    (!state.permanent&&!Number.isFinite(state.expiresAt)))throw new Error('Invalid NPC lifecycle state');
 // nameTag itself survives a restart between native naming and the deferred
 // interaction callback. Never clear naturalOrigin or the legacy token.
 if(!state.permanent&&!state.retired&&!state.deathClaimed&&entity.nameTag){
  state={...state,permanent:true,expiresAt:null};saveState(entity,state);
 }
 if(state.permanent)clearExpiry(entity.id);
 return state;
}
function retire(entity,state){
 clearExpiry(entity.id);
 if(validEntity(entity)){
  if(state)saveState(entity,{...state,retired:true});
  entity.remove(); // Not kill(): retirement never triggers death loot.
 }
}
export function canUse(player,npc,existingSession=false){
 if(!validEntity(player)||!validEntity(npc)||npc.typeId!==CONFIG.npcType)return false;
 if(player.dimension.id!==npc.dimension.id||distance2(player.location,npc.location)>CONFIG.interactionDistance**2)return false;
 const state=stateFor(npc);
 if(!state)return true; // Administrative individual: no natural loot or deadline.
 if(state.retired||state.deathClaimed)return false;
 const now=Date.now();return state.permanent||now<state.expiresAt||(existingSession&&now<state.expiresAt+CONFIG.maxGraceMs);
}
export function requireUsable(player,npc,existingSession=true){
 if(!canUse(player,npc,existingSession))throw new Error('鑑定士が不在・遠距離・滞在終了のため鑑定できません。アイテムは消費していません。');
}
function armExpiry(entity,state,delayMs=state.expiresAt-Date.now()){
 clearExpiry(entity.id);
 if(state.permanent||state.retired||state.deathClaimed)return;
 const id=entity.id;
 expiryTimers.set(id,system.runTimeout(()=>{
  expiryTimers.delete(id);
  const loaded=entityById(id);
  // Unloaded entities retain their deadline; entityLoad will reconcile them.
  if(validEntity(loaded))try{reconcileLoaded(loaded);}catch(error){logError('NPC expiry',error);}
 },Math.min(2147483647,Math.max(1,Math.ceil(delayMs/50)))));
}
function reconcileLoaded(entity){
 if(entity.typeId!==CONFIG.npcType)return;
 const state=stateFor(entity);if(!state)return;
 if(state.retired){retire(entity,state);return;}
 if(state.permanent||state.deathClaimed){clearExpiry(entity.id);return;}
 const now=Date.now();
 if(now<state.expiresAt){armExpiry(entity,state);return;}
 if(now<state.expiresAt+CONFIG.maxGraceMs&&hasNpcSession(entity.id)){
  armExpiry(entity,state,Math.min(10000,state.expiresAt+CONFIG.maxGraceMs-now));return;
 }
 retire(entity,state);
}
// Use the pre-interaction stack: the last name tag may already be consumed.
export function isNameTagInteraction(event){
 return (event.beforeItemStack??event.itemStack)?.typeId==='minecraft:name_tag';
}
export function reconcileNpcInteraction(entity){
 if(validEntity(entity))try{reconcileLoaded(entity);}catch(error){logError('NPC interaction',error);}
}
function island(dimension,location){
 const biome=dimension.getBiome(location);
 return CONFIG.islandBiomeIds.includes(biome.id)||CONFIG.islandBiomeTags.some(tag=>typeof biome.hasTags==='function'&&biome.hasTags([tag]));
}
// Stable API has no Block.isSolid. Restrict landing surfaces to known full
// terrain cubes; unknown/custom blocks and partial blocks fail closed.
const safeTerrain=new Set(['grass_block','dirt','coarse_dirt','dirt_with_roots','mycelium','podzol',
 'stone','granite','diorite','andesite','deepslate','tuff','calcite','gravel','sand','red_sand',
 'sandstone','red_sandstone','terracotta','hardened_clay','snow','snow_block','clay','moss_block',
 'mud','packed_mud','bedrock'].map(id=>'minecraft:'+id));
/** @param {import('@minecraft/server').Block | undefined} block */
function safeFloor(block){return !!block&&!block.isWaterlogged&&safeTerrain.has(block.typeId);}
/** @param {import('@minecraft/server').Dimension} dimension */
function groundAt(dimension,x,z){
 try {
  const b=dimension.getTopmostBlock({x:Math.floor(x),z:Math.floor(z)});if(!safeFloor(b))return null;
  const feet={x:b.location.x+0.5,y:b.location.y+1,z:b.location.z+0.5};
  const air1=dimension.getBlock(feet),air2=dimension.getBlock({x:feet.x,y:feet.y+1,z:feet.z});
  if(!air1?.isAir||!air2?.isAir)return null;
  // Avoid a spawn with no neighboring floor (isolated pillars / sharp ledges).
  for(const [dx,dz] of [[1,0],[-1,0],[0,1],[0,-1]]){
   const support=dimension.getBlock({x:feet.x+dx,y:feet.y-1,z:feet.z+dz});
   if(!safeFloor(support))return null;
  }
  return feet;
 }catch{return null;} // Unloaded or out-of-bounds columns are expected, not force-loaded.
}
function eligible(player){
 if(player.dimension.id!=='minecraft:overworld')return false;
 if(String(player.getGameMode()).toLowerCase()==='spectator')return false;
 const p=groundAt(player.dimension,player.location.x,player.location.z);
 return !!p && Math.abs(p.y-player.location.y)<=6;
}
function attempt(players){
 if(!CONFIG.naturalSpawningEnabled)return;
 const candidates=players.filter(eligible);if(!candidates.length)return;
 const islands=candidates.filter(p=>{try{return island(p.dimension,p.location);}catch{return false;}});
 const pool=islands.length?islands:candidates;
 const chosen=pool[Math.floor(Math.random()*pool.length)];
 const onIsland=islands.length>0;
 if(Math.random()>=(onIsland?CONFIG.islandChance:CONFIG.normalChance))return;
 const dim=chosen.dimension;
 for(let i=0;i<CONFIG.spawnAttempts;i++){
  const angle=Math.random()*Math.PI*2;
  const radius=Math.sqrt(CONFIG.spawnRadiusMin**2+Math.random()*(CONFIG.spawnRadiusMax**2-CONFIG.spawnRadiusMin**2));
  const spot=groundAt(dim,chosen.location.x+Math.cos(angle)*radius,chosen.location.z+Math.sin(angle)*radius);
  if(!spot)continue;
  // All players, not only the chosen target, get a minimum 24-block buffer.
  const tooClose=players.some(p=>p.dimension.id===dim.id&&distance2(p.location,spot)<CONFIG.spawnRadiusMin**2);
  const ds=distance2(chosen.location,spot);
  if(tooClose||ds>CONFIG.spawnRadiusMax**2||ds<CONFIG.spawnRadiusMin**2)continue;
  if(onIsland){try{if(!island(dim,spot))continue;}catch{continue;}}
  let npc;
  try{
   npc=dim.spawnEntity(CONFIG.npcType,spot);
   const t=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
   npc.setDynamicProperty(CONFIG.naturalTokenKey,t);
   const now=Date.now();
   const state={version:2,naturalOrigin:true,spawnedAt:now,island:onIsland,
    expiresAt:now+(onIsland?CONFIG.islandLifetimeMs:CONFIG.normalLifetimeMs),permanent:false,deathClaimed:false,retired:false};
   saveState(npc,state);armExpiry(npc,state);return;
  }catch(error){if(validEntity(npc))retire(npc,null);logError('spawn',error);return;}
 }
}
export function initializeNpc(){
 // One startup enumeration, then entityLoad and per-individual timers only.
 for(const timer of expiryTimers.values())system.clearRun(timer);
 expiryTimers.clear();
 for(const id of ['overworld','nether','the_end']){
  try{for(const entity of world.getDimension(id).getEntities({type:CONFIG.npcType})){
   try{reconcileLoaded(entity);}catch(error){logError('initialize NPC entity',error);}
  }}catch(error){logError('initialize NPC dimension',error);}
 }
}
export function installNpc(){
 world.afterEvents.entityLoad.subscribe(e=>{try{reconcileLoaded(e.entity);}catch(error){logError('entity load',error);}});
 world.afterEvents.entityRemove.subscribe(e=>clearExpiry(e.removedEntityId));
 world.afterEvents.playerInteractWithEntity.subscribe(e=>{
  if(e.target.typeId===CONFIG.npcType)system.run(()=>reconcileNpcInteraction(e.target));
 });
 world.afterEvents.entityDie.subscribe(e=>{
  const npc=e.deadEntity;if(npc.typeId!==CONFIG.npcType)return;
  clearExpiry(npc.id);
  try{
   const state=stateFor(npc);
   if(!state||state.retired||state.deathClaimed)return;
   // Claim BEFORE item output: duplicate death notifications cannot pay twice.
   // Actual death keeps its reward even if the deadline callback is pending.
   saveState(npc,{...state,deathClaimed:true});
   const location=npc.location,dim=npc.dimension;
   for(const item of ['red_mushroom','brown_mushroom','crimson_fungus','warped_fungus'])
    dim.spawnItem(new ItemStack('minecraft:'+item,64),location);
  }catch(error){logError('natural death loot',error);}
 });
 world.afterEvents.playerLeave.subscribe(e=>sessions.delete(e.playerId));
 // One minute = 1200 ticks. Not a per-tick entity or inventory poll. Counts active
 // overworld minutes and persists the countdown; no offline catch-up spawn burst.
 system.runInterval(()=>{
  try{
   const players=world.getAllPlayers().filter(p=>p.dimension.id==='minecraft:overworld'&&String(p.getGameMode()).toLowerCase()!=='spectator');
   if(!players.length)return;
   const raw=world.getDynamicProperty(CONFIG.spawnClockKey);
   let minutes=raw===undefined?0:raw;
   if(typeof minutes!=='number'||!Number.isInteger(minutes)||minutes<0||minutes>=CONFIG.spawnIntervalMinutes)throw new Error('corrupt spawn countdown');
   minutes++;
   if(minutes>=CONFIG.spawnIntervalMinutes){world.setDynamicProperty(CONFIG.spawnClockKey,0);attempt(players);}
   else world.setDynamicProperty(CONFIG.spawnClockKey,minutes);
  }catch(error){logError('spawn clock',error);}
 },1200);
}
