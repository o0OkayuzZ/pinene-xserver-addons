/** Native crafting prototype. No form calls and no inventory-delta craft inference.
 * Installed only in the separate single-player integration world.
 * Recipe matching and ingredient transfers belong exclusively to Minecraft.
 * Craft-time knife wear is NOT implemented in this stable-API phase.
 */
import { world, system, ItemStack } from '@minecraft/server';
export const LIMITS = Object.freeze({ copper: 2, iron: 3, gold: 4, diamond: 6, netherite: 7 });
const ORIGIN_KEY = 'pinene_native:origin_v1';
const STATE = 'pinene_cooking:knife';
const pending = new Set();
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
function log(event, data={}) { console.warn('[pinene_native_minimal] '+JSON.stringify({event,...data})); }
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
function queued(player,block,action) {
  const token=key(block);
  if(pending.has(token)) return;
  pending.add(token);
  const location={...block.location}, type=block.typeId, dimension=block.dimension;
  system.run(()=>{
    try{
      const fresh=dimension.getBlock(location);
      if(!fresh || fresh.typeId!==type || !nearby(player,fresh) || world.getAllPlayers().length!==1) return;
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
  report(player,'§aナイフを置きました。手を空けてまな板を開いてください。');
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
  if(!isBoard(event.block.typeId)) return;
  const {player,block}=event;
  // This prototype is deliberately not a multiplayer rollout.
  if(event.isFirstEvent===false){event.cancel=true;return;}
  if(world.getAllPlayers().length!==1){event.cancel=true;system.run(()=>report(player,'§eこの試験版は単独プレイ専用です。'));return;}
  try{
    const held=inv(player)?.getItem(player.selectedSlotIndex), h=holderInfo(block);
    if(h.found.length>1){event.cancel=true;throw new Error('multiple_knife_holders');}
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
    // Do not cancel: Minecraft opens and retains its normal crafting screen.
  }catch(error){event.cancel=true;log('interaction_rejected',{error:String(error)});}
});
world.beforeEvents.playerBreakBlock.subscribe(event=>{
  if(!isBoard(event.block.typeId)) return;
  // Keep the item safely in its holder during the first integration phase.
  // Occupied-board destruction/drop behavior remains a separate test gate.
  if(holders(event.block).length){event.cancel=true;system.run(()=>report(event.player,'§e試験版では先にスニーク操作でナイフを回収してください。'));}
});
system.run(()=>log('ready',{ui:'native',serverApi:'2.7.0',knifeWear:false,multiplayer:false}));
