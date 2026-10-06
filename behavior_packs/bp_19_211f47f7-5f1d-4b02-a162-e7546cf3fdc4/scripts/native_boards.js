/** Native crafting prototype. No custom forms and no script-owned ingredient transfer.
 * Production integration of the approved native crafting prototype.
 * Minecraft still owns recipe matching, consumption, container returns and output.
 * Stable API lacks a craft event, so wear uses conservative binary session evidence:
 * a registered result must increase while that recipe's ingredients also decrease.
 * Quantity is deliberately NOT inferred; one used native screen = one wear session.
 */
import { world, system, ItemStack } from '@minecraft/server';
import { COOKING_RUNTIME, OBSERVED_ITEM_IDS } from './cooking_runtime.js';
import { sessionBreakChance, shouldBreakSession, initialUsesFromDamage, visualDamage } from './wear_curve.js';
export const LIMITS = Object.freeze({ copper: 2, iron: 3, gold: 4, diamond: 6, netherite: 7 });
const ORIGIN_KEY = 'pinene_native:origin_v1';
const STATE = 'pinene_cooking:knife';
const pending = new Set();
const sessions = new Map();
const USES_KEY = 'pinene_cooking:uses_v1';
const BREAK_DUE_KEY = 'pinene_cooking:break_due_v1';
const SESSION_TTL = 20 * 60 * 10;
export function knifeMaterial(typeId) {
  return Object.keys(LIMITS).find(m => typeId === `pinene_cooking:${m}_knife`);
}
export function isBoard(typeId) {
  return typeof typeId === 'string' && typeId.startsWith('pinene_cooking:') && typeId.endsWith('_cutting_board');
}
/** Snapshot is only a race guard. Transfers still move the original ItemStack. */
/** @param {import("@minecraft/server").ItemStack | undefined} stack */
export function knifeSnapshot(stack) {
  if(!stack) return '';
  const d=stack.getComponent('minecraft:durability');
  const ench=stack.getComponent('minecraft:enchantable')?.getEnchantments()??[];
  const props=(stack.getDynamicPropertyIds?.()??[]).sort().map(k=>[k,stack.getDynamicProperty(k)]);
  return JSON.stringify([stack.typeId,stack.amount,stack.nameTag??'',stack.getLore?.()??[],
    d?.damage??0,d?.maxDurability??0,stack.lockMode,stack.keepOnDeath,
    (stack.getTags?.()??[]).sort(),ench.map(e=>[e.type.id,e.level]).sort(),props]);
}
/** @param {import("@minecraft/server").ItemStack | undefined} stack */
export function knifeUsable(stack) {
  if(!knifeMaterial(stack?.typeId)||stack.amount!==1) return false;
  const d=stack.getComponent('minecraft:durability');
  return !!d && Number.isInteger(d.damage) && d.damage>=0 && d.damage<d.maxDurability;
}
function inv(entity) { return entity.getComponent('minecraft:inventory')?.container; }
function key(block) { return `${block.dimension.id}:${block.location.x},${block.location.y},${block.location.z}`; }
function center(block) { return { x:block.location.x+0.5, y:block.location.y+0.145, z:block.location.z+0.5 }; }
function log(event, data={}) { console.warn('[pinene_cooking_native] '+JSON.stringify({event,...data})); }
// Brief native HUD notice only; never replace or delay the crafting screen.
const RANK_NUMERALS = Object.freeze(['', 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII']);
export function rankActionbarText(material) {
  if(material==='empty') return '§7現在ランク：§f未設定§r';
  const rank=LIMITS[material];
  if(!Number.isInteger(rank)||rank<1||rank>=RANK_NUMERALS.length) return undefined;
  return '§7現在ランク：§f'+RANK_NUMERALS[rank]+'§r';
}
/** @param {import('@minecraft/server').Player} player */
function showRankActionbar(player,material) {
  const text=rankActionbarText(material);
  if(!text) return;
  try { if(player.isValid) player.onScreenDisplay.setActionBar(text); }
  catch(error) { log('rank_notice_failed',{error:String(error)}); }
}
function scheduleRankActionbar(player,block) {
  const location={...block.location},dimension=block.dimension,type=block.typeId;
  // setActionBar is not permitted in a before-event callback.
  system.run(()=>{
    try {
      const fresh=dimension.getBlock(location);
      if(!fresh||fresh.typeId!==type||!nearby(player,fresh)) return;
      const h=holderInfo(fresh);
      if(h.valid&&knifeUsable(h.stack)&&fresh.permutation.getAllStates()[STATE]===h.material)
        showRankActionbar(player,h.material);
    } catch(error) { log('rank_notice_failed',{error:String(error)}); }
  });
}

function holders(block) {
  return block.dimension.getEntities({location:center(block),maxDistance:0.4})
    .filter(e=>e.isValid && e.getDynamicProperty(ORIGIN_KEY)===key(block));
}
function holderInfo(block) {
  const found=holders(block);
  if(found.length!==1) return { valid:false, found };
  const entity=found[0], storage=inv(entity), stack=storage?.getItem(0);
  const material=knifeMaterial(stack?.typeId);
  return { valid:!!material && stack?.amount===1 && entity.typeId===`pinene_cooking:placed_${material}_knife`,
    found, entity, storage, stack, material };
}
function nearby(player,block) {
  if(!player.isValid || player.dimension.id!==block.dimension.id) return false;
  const health=player.getComponent('minecraft:health');
  if(health && health.currentValue<=0) return false;
  const a=player.location,b=center(block);
  return (a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2<=36;
}
function report(player,text) { try{player.sendMessage(text);}catch{} }
function knifeUses(stack,material) {
  const stored=stack?.getDynamicProperty(USES_KEY);
  if(Number.isSafeInteger(stored)&&stored>=0) return stored;
  const damage=stack?.getComponent('minecraft:durability')?.damage;
  return initialUsesFromDamage(material,Number.isSafeInteger(damage)&&damage>=0?damage:0);
}
function breakDue(stack) { return stack?.getDynamicProperty(BREAK_DUE_KEY)===true; }
const OBSERVED_ITEMS = new Set(OBSERVED_ITEM_IDS);
function trackedCounts(player) {
  const counts=Object.create(null),add=stack=>{
    if(!stack||!OBSERVED_ITEMS.has(stack.typeId)) return;
    counts[stack.typeId]=(counts[stack.typeId]??0)+stack.amount;
  };
  const inventory=inv(player);
  if(inventory) for(let i=0;i<inventory.size;i++) add(inventory.getItem(i));
  try { add(player.getComponent('minecraft:cursor_inventory')?.item); } catch {}
  return counts;
}
function detectedUsedRecipe(before,after,maxRank=7) {
  for(const [resultId,recipe] of Object.entries(COOKING_RUNTIME)) {
    if(recipe.rank>maxRank) continue;
    if((after[resultId]??0)-(before[resultId]??0)<recipe.resultCount) continue;
    let valid=true;
    for(const part of recipe.ingredients) {
      let consumed=0;
      for(const id of part.ids) consumed+=(before[id]??0)-(after[id]??0);
      if(consumed<part.count){valid=false;break;}
    }
    if(valid) return resultId;
  }
  return undefined;
}
function markUsedSession(player,block,h,roll=Math.random()) {
  if(!h.valid||breakDue(h.stack)) return undefined;
  const stack=h.storage.getItem(0), material=knifeMaterial(stack?.typeId);
  if(!material||!knifeUsable(stack)) return undefined;
  const usesBefore=knifeUses(stack,material), chance=sessionBreakChance(material,usesBefore);
  const uses=usesBefore+1, due=shouldBreakSession(material,usesBefore,roll);
  stack.setDynamicProperty(USES_KEY,uses);
  if(due) stack.setDynamicProperty(BREAK_DUE_KEY,true);
  const durability=stack.getComponent('minecraft:durability');
  if(durability) durability.damage=visualDamage(material,uses);
  h.storage.setItem(0,stack);
  log('knife_session_used',{player:player.id,block:key(block),material,uses,chance,due});
  return {material,uses,chance,due};
}
function startCookingSession(player,block) {
  const h=holderInfo(block);
  if(!h.valid||!knifeUsable(h.stack)||breakDue(h.stack)) return;
  // Capture before the native screen can move ingredients onto its crafting grid.
  sessions.set(player.id,{dimension:block.dimension,location:{...block.location},type:block.typeId,
    material:h.material,entityId:h.entity.id,knife:knifeSnapshot(h.stack),before:trackedCounts(player),
    playerLocation:{...player.location},started:system.currentTick,used:false});
}
function sessionPlayer(session,playerId) {
  const player=world.getAllPlayers().find(p=>p.id===playerId);
  if(!player?.isValid||player.dimension.id!==session.dimension.id||system.currentTick-session.started>SESSION_TTL) return;
  const a=player.location,b=session.playerLocation;
  if((a.x-b.x)**2+(a.y-b.y)**2+(a.z-b.z)**2>0.25) return;
  return player;
}
function otherSessionOwnsBoard(player,block) {
  for(const [id,session] of sessions) {
    if(!sessionPlayer(session,id)){sessions.delete(id);continue;}
    if(id!==player.id&&session.dimension.id===block.dimension.id&&session.type===block.typeId&&
      session.location.x===block.location.x&&session.location.y===block.location.y&&session.location.z===block.location.z) return true;
  }
  return false;
}
// The old form implementation stored only type + damage on a marker entity.
// Convert that exact marker once; ambiguous markers are never deleted or guessed.
function legacyHolders(block) {
  return block.dimension.getEntities({location:center(block),maxDistance:0.4}).filter(e=>
    e.isValid&&Object.keys(LIMITS).some(m=>e.typeId===`pinene_cooking:placed_${m}_knife`)&&
    e.getDynamicProperty(ORIGIN_KEY)===undefined);
}
function migrateLegacyKnife(block) {
  if(holders(block).length) return false;
  const found=legacyHolders(block);
  if(found.length!==1) throw new Error('ambiguous_legacy_knife');
  const entity=found[0],material=entity.typeId.split(':')[1].replace('placed_','').replace('_knife','');
  const storage=inv(entity),damage=entity.getDynamicProperty('pinene_cooking:knife_damage');
  if(!storage||storage.size!==1||storage.getItem(0)||!Number.isSafeInteger(damage)||damage<0) throw new Error('legacy_knife_state_invalid');
  const stack=new ItemStack(`pinene_cooking:${material}_knife`,1),d=stack.getComponent('minecraft:durability');
  if(!d||damage>=d.maxDurability) throw new Error('legacy_knife_damage_invalid');
  d.damage=damage;
  const old=block.permutation;
  try {
    storage.setItem(0,stack);
    entity.setDynamicProperty(ORIGIN_KEY,key(block));
    block.setPermutation(old.withState(STATE,material));
  } catch(error) {
    // Legacy metadata stays present until migration is verified.
    try{block.setPermutation(old);entity.setDynamicProperty(ORIGIN_KEY,undefined);storage.setItem(0,undefined);}catch{}
    throw error;
  }
  log('legacy_knife_migrated',{block:key(block),material,damage});
  return true;
}
function resolvePendingBreak(player,block) {
  const h=holderInfo(block);
  if(!h.valid||!breakDue(h.stack)) return false;
  const previous=block.permutation;
  block.setPermutation(previous.withState(STATE,'empty'));
  try {
    h.storage.setItem(0,undefined);
    if(h.storage.getItem(0)) throw new Error('knife_break_clear_failed');
  } catch(error) {
    try{block.setPermutation(previous);}catch{}
    throw error;
  }
  sessions.delete(player.id);
  try{h.entity.remove();}catch(error){log('empty_holder_remove_failed',{error:String(error)});}
  report(player,'§cナイフが寿命で壊れました。');
  log('knife_broken',{player:player.id,block:key(block),material:h.material});
  return true;
}
function queued(player,block,action) {
  const token=key(block);
  if(pending.has(token)) return;
  pending.add(token);
  const location={...block.location}, type=block.typeId, dimension=block.dimension;
  system.run(()=>{
    try{
      const fresh=dimension.getBlock(location);
      if(!fresh || fresh.typeId!==type || !nearby(player,fresh)) return;
      action(fresh);
    }catch(error){ log('action_error',{error:String(error),block:token});report(player,'§c処理を停止しました。ナイフの保管状態を確認してください。'); }
    finally{pending.delete(token);}
  });
}
/** Use the native move operation to retain name, durability, lore and enchants. */
export function moveIntoEmpty(source,fromSlot,target,toSlot) {
  if(!source.getItem(fromSlot)) throw new Error('source_empty');
  if(target.getItem(toSlot)) throw new Error('destination_occupied');
  source.moveItem(fromSlot,toSlot,target);
}
function place(player,block,slot,expectedType,expectedSnapshot) {
  const source=inv(player), stack=source?.getItem(slot), material=knifeMaterial(stack?.typeId);
  if(!source || !material || stack.typeId!==expectedType || stack.amount!==1 || holders(block).length) return;
  if(!knifeUsable(stack)||knifeSnapshot(stack)!==expectedSnapshot) return;
  if(block.permutation.getAllStates()[STATE]!=='empty') throw new Error('board_state_without_holder');
  const next=block.permutation.withState(STATE,material);
  const entity=block.dimension.spawnEntity(`pinene_cooking:placed_${material}_knife`,center(block));
  let moved=false;
  try{
    entity.setDynamicProperty(ORIGIN_KEY,key(block));
    const storage=inv(entity);
    if(!storage || storage.size!==1 || storage.getItem(0)) throw new Error('invalid_knife_storage');
    moveIntoEmpty(source,slot,storage,0);moved=true;
    block.setPermutation(next);
  }catch(error){
    const storage=inv(entity);
    if(moved && storage?.getItem(0) && !source.getItem(slot)) {
      try{moveIntoEmpty(storage,0,source,slot);moved=false;}catch(rollback){log('rollback_failed',{error:String(rollback)});}
    }
    // Never delete an entity that still holds the player's knife.
    if(!inv(entity)?.getItem(0)) try{entity.remove();}catch{}
    throw error;
  }
  log('knife_placed',{material,damage:stack.getComponent('minecraft:durability')?.damage??0});
  report(player,'§aナイフを置きました。手を空けると料理、本を持つと料理図鑑を開けます。');
  showRankActionbar(player,material);
}
function retrieve(player,block) {
  const h=holderInfo(block), target=inv(player);
  if(!h.valid || !target) throw new Error('knife_storage_mismatch');
  let empty=-1;
  for(let i=0;i<target.size;i++) if(!target.getItem(i)){empty=i;break;}
  if(empty<0){report(player,'§eナイフを戻す空き枠が必要です。');return;}
  const previous=block.permutation;
  block.setPermutation(previous.withState(STATE,'empty'));
  try{moveIntoEmpty(h.storage,0,target,empty);}
  catch(error){try{block.setPermutation(previous);}catch{}throw error;}
  if(h.storage.getItem(0)) throw new Error('knife_transfer_incomplete');
  try{h.entity.remove();}catch(error){log('empty_holder_remove_failed',{error:String(error)});}
  report(player,'§aナイフを回収しました。');
  showRankActionbar(player,'empty');
}
export function seedPlacedKnife(block,material) {
  if(!LIMITS[material] || holders(block).length) throw new Error('initial_board_not_empty');
  const next=block.permutation.withState(STATE,material);
  const entity=block.dimension.spawnEntity(`pinene_cooking:placed_${material}_knife`,center(block));
  entity.setDynamicProperty(ORIGIN_KEY,key(block));
  const storage=inv(entity);if(!storage || storage.size!==1) throw new Error('initial_knife_storage_unavailable');
  storage.setItem(0,new ItemStack(`pinene_cooking:${material}_knife`,1));
  block.setPermutation(next);
}
world.beforeEvents.playerInteractWithBlock.subscribe(event=>{
  if(event.cancel) return;
  if(!isBoard(event.block.typeId)){sessions.delete(event.player.id);return;}
  const {player,block}=event;
  if(event.isFirstEvent===false){event.cancel=true;return;}
  try{
    if(otherSessionOwnsBoard(player,block)){
      event.cancel=true;system.run(()=>report(player,'§eこのまな板は他のプレイヤーが使用中です。使用者が画面を閉じて少し移動すると交代できます。'));return;
    }
    sessions.delete(player.id);
    const legacy=legacyHolders(block);
    if(legacy.length){
      event.cancel=true;queued(player,block,b=>{if(migrateLegacyKnife(b))report(player,'§a設置済みナイフを引き継ぎました。もう一度まな板を開いてください。');});return;
    }
    const held=inv(player)?.getItem(player.selectedSlotIndex), h=holderInfo(block);
    if(h.found.length>1){event.cancel=true;throw new Error('multiple_knife_holders');}
    if(h.valid&&breakDue(h.stack)){
      event.cancel=true;queued(player,block,b=>resolvePendingBreak(player,b));return;
    }
    if(player.isSneaking && h.valid){event.cancel=true;queued(player,block,b=>retrieve(player,b));return;}
    if(knifeMaterial(held?.typeId)){
      event.cancel=true;
      if(!h.found.length){const slot=player.selectedSlotIndex;const snapshot=knifeSnapshot(held);queued(player,block,b=>place(player,b,slot,held.typeId,snapshot));}
      else system.run(()=>report(player,'§eナイフは設置済みです。手を空けて開くか、スニークして回収してください。'));
      return;
    }
    if(!h.valid || !knifeUsable(h.stack) || block.permutation.getAllStates()[STATE]!==h.material){
      event.cancel=true;system.run(()=>report(player,'§e銅以上のナイフをまな板に置いてください。'));return;
    }
    scheduleRankActionbar(player,block);
    startCookingSession(player,block);
    // Do not cancel: Minecraft opens and retains its normal crafting screen.
  }catch(error){event.cancel=true;log('interaction_rejected',{error:String(error)});}
});
world.beforeEvents.playerBreakBlock.subscribe(event=>{
  if(!isBoard(event.block.typeId)) return;
  // Keep the item safely in its holder during the first integration phase.
  // Occupied-board destruction/drop behavior remains a separate test gate.
  if(holders(event.block).length||legacyHolders(event.block).length){event.cancel=true;system.run(()=>report(event.player,'§e先にスニーク操作でナイフを回収してください。'));}
});
system.runInterval(()=>{
  for(const [playerId,session] of sessions) {
    try {
      const player=sessionPlayer(session,playerId);
      if(!player?.isValid||player.dimension.id!==session.dimension.id||system.currentTick-session.started>SESSION_TTL){
        sessions.delete(playerId);continue;
      }
      const block=session.dimension.getBlock(session.location);
      if(!block||block.typeId!==session.type||!nearby(player,block)){sessions.delete(playerId);continue;}
      const h=holderInfo(block);
      if(!h.valid||h.entity.id!==session.entityId||h.material!==session.material){
        sessions.delete(playerId);continue;
      }
      if(session.used) continue;
      if(breakDue(h.stack)||knifeSnapshot(h.stack)!==session.knife){sessions.delete(playerId);continue;}
      const output=detectedUsedRecipe(session.before,trackedCounts(player),LIMITS[session.material]);
      if(!output) continue;
      const wear=markUsedSession(player,block,h);
      if(wear) session.used=true;
      if(wear) log('cooking_session_detected',{player:player.id,block:key(block),output,...wear});
    } catch(error) { sessions.delete(playerId);log('session_monitor_failed',{error:String(error)}); }
  }
},1);
world.afterEvents.playerLeave.subscribe(({playerId})=>sessions.delete(playerId));
system.run(()=>log('ready',{ui:'native',serverApi:'2.7.0',knifeWear:'probabilistic_session_v1',multiplayer:true}));

// Read-only, world-local fixture audit. Never infers or charges craft-time wear.
export function summarizeTestKnives(stacks) {
  const knives=stacks.filter(s=>knifeMaterial(s?.typeId));
  const worn=knives.filter(s=>s.nameTag==='検証用・使用47の銅ナイフ');
  const total=knives.reduce((n,s)=>n+s.amount,0), fixture=worn[0];
  const material=knifeMaterial(fixture?.typeId);
  const damage=fixture?.getComponent('minecraft:durability')?.damage;
  const uses=material?knifeUses(fixture,material):undefined;
  const fixtureOK=worn.length===1&&fixture?.amount===1&&material==='copper';
  return {total,fixtureOK,damage,uses,breakDue:breakDue(fixture),ok:total===8&&fixtureOK};
}
