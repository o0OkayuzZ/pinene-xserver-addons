import { world,system } from '@minecraft/server';
import { NF_REGISTRY } from './nf_registry.js';
import { NFStateManager } from './nf_state.js';
import { NF_INTERACTIONS } from './nf_interactions.js';
import { logError,validEntity } from './util.js';

const PREFIX='pinene:myco_nf_state_';
const POSITIVE=new Set(['absorption','conduit_power','dolphins_grace','fire_resistance','haste',
 'health_boost','hero_of_the_village','invisibility','jump_boost','night_vision','regeneration',
 'resistance','saturation','slow_falling','speed','strength','village_hero','water_breathing']);
const short=id=>id.replace(/^minecraft:/,'');

export function createNFRuntime(registry=NF_REGISTRY,interactions=NF_INTERACTIONS) {
 const active=new Map();let timer,installed=false;
 function keys(player){return player.getDynamicPropertyIds().filter(key=>key.startsWith(PREFIX));}
 function persist(player,manager) {
  const snapshot=manager.snapshot(),wanted=new Set();
  // One property per ACTIVE infection avoids the 32 KB property limit when
  // future species are added. No property/index for nonexistent infections.
  for(const state of snapshot.states) {
   const key=PREFIX+state.nfId,written=JSON.stringify({...snapshot,states:[state]});
   if(written.length>8000)throw new Error('NF custom state exceeds safe property size');
   player.setDynamicProperty(key,written);wanted.add(key);
  }
  for(const key of keys(player))if(!wanted.has(key))player.setDynamicProperty(key,undefined);
 }
 function create(player) {
  const entry={player,ownedEffects:new Map(),water:undefined,positive:undefined,busy:false};
  entry.manager=new NFStateManager(registry,{
   interactions,notify:(event,id,message)=>{
    if(event==='severe'||event==='worsening')player.sendMessage(message);
    else if(['onset','phase','recovery','cure'].includes(event))player.sendMessage(`§7[NF] ${registry.get(id).displayName}：${{onset:'発症',phase:'症状変化',recovery:'回復',cure:'治癒'}[event]}`);
   },
   cleanup:(state,definition,reason)=>definition.cleanup?.(player,state,reason),
   kill:()=>{persist(player,entry.manager);player.kill();}
  });
  return entry;
 }
 function reconcileEffects(entry) {
  const player=entry.player,desired=new Map(entry.manager.symptoms().map(f=>[f.effect,f]));
  for(const [id,owned] of entry.ownedEffects)if(!desired.has(id)){
   const current=player.getEffect(id);
   // Do not erase a stronger/longer effect from another addon or potion.
   if(current&&current.amplifier===owned.amplifier&&current.duration<=owned.duration)player.removeEffect(id);
   entry.ownedEffects.delete(id);
  }
  for(const [id,f] of desired){
   const amplifier=f.level-1,duration=40,current=player.getEffect(id);
   if(!current||current.amplifier<amplifier||current.amplifier===amplifier&&current.duration<duration){
    player.addEffect(id,duration,{amplifier,showParticles:false});
    entry.ownedEffects.set(id,{amplifier,duration});
   }
  }
 }
 function finish(entry) {
  persist(entry.player,entry.manager);reconcileEffects(entry);
  if(!entry.manager.states.size)active.delete(entry.player.id);
 }
 function safely(player,action) {
  try{action();}catch(error){logError(`NF ${player?.id??'runtime'}`,error);}
 }
 function start() {
  if(timer!==undefined||!active.size)return;
  timer=system.runInterval(()=>{
   for(const entry of [...active.values()])safely(entry.player,()=>{
    if(!validEntity(entry.player)){active.delete(entry.player.id);return;}
    entry.busy=true;
    try {
     pollEnvironment(entry);entry.manager.tick(1);finish(entry);
    }finally{entry.busy=false;}
   });
   if(!active.size){system.clearRun(timer);timer=undefined;}
  },20);
 }
 function wants(entry,event){return [...entry.manager.states.keys()].some(id=>registry.get(id).triggers?.[event]);}
 function positiveCount(player){return player.getEffects().filter(e=>POSITIVE.has(short(e.typeId))).length;}
 function pollEnvironment(entry) {
  // Stable API exposes no water-entry or effect-removal event. Only players
  // with a relevant ACTIVE trigger are polled by the existing 1-second timer.
  if(wants(entry,'waterEnter')){
   const water=entry.player.isInWater;
   if(water&&!entry.water)entry.manager.dispatch('waterEnter');
   entry.water=water;
  }
  if(wants(entry,'positiveEffectsChanged')){
   const count=positiveCount(entry.player);
   if(count!==entry.positive)entry.manager.dispatch('positiveEffectsChanged',{count});
   entry.positive=count;
  }
 }
 function restore(player) {
  if(active.has(player.id))return;
  const saved=keys(player);if(!saved.length)return;
  const entry=create(player),records=saved.map(key=>JSON.parse(player.getDynamicProperty(key)));
  // Validate every individual record before combining. Partial writes preserve
  // each state's remaining online duration; wall-clock time never participates.
  for(const record of records){const probe=new NFStateManager(registry);probe.restore(record);}
  const onlineTime=Math.max(...records.map(r=>r.onlineTime)),states=[];
  for(const record of records)for(const state of record.states){
   const offset=onlineTime-record.onlineTime;
   state.startTime+=offset;
   if(state.fatalState.fatalExecuteAt!==null)state.fatalState.fatalExecuteAt+=offset;
   if(state.fatalState.warningAt!==undefined)state.fatalState.warningAt+=offset;
   states.push(state);
  }
  entry.manager.restore({version:1,onlineTime,states});
  active.set(player.id,entry);start();
 }
 function activate(player,id) {
  restore(player);
  const entry=active.get(player.id)??create(player);
  entry.manager.infect(id);active.set(player.id,entry);finish(entry);start();
 }
 function clear(player,reason) {
  restore(player);
  const entry=active.get(player.id);
  if(entry){entry.manager.clear(reason);finish(entry);}
 }
 function dispatch(player,event,payload) {
  const entry=active.get(player?.id);if(!entry||entry.busy)return;
  entry.busy=true;
  try{entry.manager.dispatch(event,payload);finish(entry);}finally{entry.busy=false;}
 }
 function install() {
  if(installed)return;installed=true;
  world.afterEvents.worldLoad.subscribe(()=>{
   for(const player of world.getAllPlayers())safely(player,()=>restore(player));
  });
  world.afterEvents.playerSpawn.subscribe(e=>safely(e.player,()=>{
   if(e.initialSpawn)restore(e.player);else clear(e.player,'death');
  }));
  world.afterEvents.playerLeave.subscribe(e=>{active.delete(e.playerId);});
  world.afterEvents.entityDie.subscribe(e=>{
   if(e.deadEntity.typeId==='minecraft:player')safely(e.deadEntity,()=>clear(e.deadEntity,'death'));
  });
  world.afterEvents.entityHurt.subscribe(e=>safely(e.hurtEntity,()=>dispatch(e.hurtEntity,'damage',e)));
  world.afterEvents.itemUse.subscribe(e=>safely(e.source,()=>dispatch(e.source,'itemUse',e)));
  world.afterEvents.effectAdd.subscribe(e=>safely(e.entity,()=>{
   const entry=active.get(e.entity.id);
   if(entry&&!entry.busy&&wants(entry,'positiveEffectsChanged')){
    const count=positiveCount(e.entity);
    if(count!==entry.positive){entry.positive=count;dispatch(e.entity,'positiveEffectsChanged',{count});}
   }
  }));
  world.afterEvents.itemCompleteUse.subscribe(e=>safely(e.source,()=>{
   if(e.itemStack.typeId==='minecraft:milk_bucket'){clear(e.source,'milk');return;}
   if(e.itemStack.getComponent('minecraft:food'))dispatch(e.source,'food',e);
   dispatch(e.source,'consumeItem',e);
  }));
 }
 return {install,activate,clear,restore,dispatch,active};
}
export const nfRuntime=createNFRuntime();
