import {world,system,GameMode} from '@minecraft/server';
import {ActionFormData,ModalFormData} from '@minecraft/server-ui';
import {chooseEffect} from '../golden_foods/core.js';
import {add,sub,mul,unit,length,distance,turnToward,selectTarget,parseAxis,limits} from './math.js';
import {safeStanding,bodyClear,blinkPoint,coordinatePoint} from './safety.js';

const EGGS=new Set(['a:gegg','a:egegg']);
const CHORUS=new Set(['a:gchorus_fruit','a:egchorus_fruit']);
const SHOTS=new Set(['pinene:golden_egg_projectile','pinene:enchanted_golden_egg_projectile']);
const shots=new Map(),anchors=new Map(),forms=new Set(),lastUse=new Map();
let errors=0;
function report(e){if(errors++<8)console.warn('[GoldenExtensions] '+String(e));}
function alive(p){try{return p?.isValid&&p.typeId==='minecraft:player'&&p.getGameMode()!==GameMode.Spectator&&p.getComponent('minecraft:health').currentValue>0;}catch{return false;}}
function ticket(p,typeId){
 const slot=p.selectedSlotIndex,container=p.getComponent('minecraft:inventory')?.container;
 const stack=container?.getItem(slot);
 return stack?.typeId===typeId?{slot,typeId,dimension:p.dimension.id,container}:undefined;
}
function stillHeld(p,t){return alive(p)&&p.dimension.id===t.dimension&&p.selectedSlotIndex===t.slot&&t.container.getItem(t.slot)?.typeId===t.typeId;}
function spend(p,t){
 if(!stillHeld(p,t))return false;
 if(p.getGameMode()===GameMode.Creative)return true;
 const item=t.container.getItem(t.slot);
 if(item.amount>1){item.amount--;t.container.setItem(t.slot,item);}else t.container.setItem(t.slot,undefined);
 return true;
}
function visible(dim,from,to){
 const delta=sub(to,from),d=length(delta);
 try{return !dim.getBlockFromRay(from,unit(delta),{maxDistance:d,includeLiquidBlocks:true,includePassableBlocks:false});}catch{return false;}
}
function lock(dim,origin,view,owner){
 const players=dim.getPlayers({location:origin,maxDistance:32}).filter(alive).map(p=>({id:p.id,point:add(p.location,{x:0,y:1.3,z:0}),entity:p}));
 return selectTarget(origin,view,players,owner,p=>visible(dim,origin,p.point))?.entity;
}
function removeShot(entity){shots.delete(entity.id);try{if(entity.isValid)entity.remove();}catch{}}
function throwEgg(p,t){
 if(!stillHeld(p,t))return;
 const enhanced=t.typeId==='a:egegg',head=p.getHeadLocation(),view=p.getViewDirection(),spawn=add(head,mul(view,.45));
 if(!visible(p.dimension,head,spawn))return;
 let entity;
 try{
  entity=p.dimension.spawnEntity(enhanced?'pinene:enchanted_golden_egg_projectile':'pinene:golden_egg_projectile',spawn);
  const component=entity.getComponent('minecraft:projectile');component.owner=p;
  const velocity=mul(view,1.5);component.shoot(velocity);
  const target=enhanced?lock(p.dimension,head,view,p.id):undefined;
  if(!spend(p,t)){removeShot(entity);return;}
  shots.set(entity.id,{entity,enhanced,owner:p.id,target,born:system.currentTick,last:spawn});
 }catch(e){if(entity)removeShot(entity);report(e);}
}
function buff(p,enhanced){
 if(!alive(p))return;
 const effects=[{id:'regeneration',amplifier:1,seconds:enhanced?20:8},{id:'strength',amplifier:enhanced?1:0,seconds:enhanced?90:60},
  // Stable 2.0 API has no hunger/saturation attribute setters. Native saturation
  // applies both, once: II for a small refill, VI for a larger refill.
  {id:'saturation',amplifier:enhanced?5:1,seconds:.05}];
 for(const effect of effects){const next=chooseEffect(p.getEffect(effect.id),effect);if(next)p.addEffect(next.id,next.ticks,{amplifier:next.amplifier,showParticles:true});}
}
world.afterEvents.projectileHitEntity.subscribe(e=>{
 try{
  if(!SHOTS.has(e.projectile.typeId))return;
  const id=e.projectile.id,shot=shots.get(id);if(!shot)return;
  shots.delete(id); // claim once, including multi-entity overlaps on the same tick
  const target=e.getEntityHit()?.entity;
  if(target?.typeId==='minecraft:player'&&visible(e.projectile.dimension,shot.last,e.location??e.projectile.location))buff(target,shot.enhanced);
  removeShot(e.projectile);
 }catch(error){report(error);}
});
world.afterEvents.projectileHitBlock.subscribe(e=>{try{if(SHOTS.has(e.projectile.typeId))removeShot(e.projectile);}catch(error){report(error);}});

function aimRange(p,enhanced,mode='aim'){
 const range=limits(p.dimension.id,enhanced).blink;
 if(!enhanced||mode==='view')return range;
 const origin=p.getHeadLocation(),view=p.getViewDirection();
 let d=range;
 try{
  const hit=p.dimension.getBlockFromRay(origin,view,{maxDistance:range,includeLiquidBlocks:true,includePassableBlocks:false});
  if(hit){const location=add(hit.block.location,hit.faceLocation);d=Math.min(d,Math.max(0,distance(origin,location)-.4));}
  const entities=p.dimension.getEntitiesFromRay(origin,view,{maxDistance:range}).filter(h=>h.entity.id!==p.id&&!SHOTS.has(h.entity.typeId));
  for(const hit of entities)if(hit.distance<d)d=Math.max(0,hit.distance-.8);
 }catch{return 0;}
 return d;
}
function warp(p,t,mode='aim',coordinate){
 if(!stillHeld(p,t))return false;
 const dim=p.dimension,origin={...p.location},enhanced=t.typeId==='a:egchorus_fruit';
 const dest=coordinate?coordinatePoint(dim,origin,coordinate,limits(dim.id,true).coordinate):blinkPoint(dim,origin,p.getViewDirection(),aimRange(p,enhanced,mode));
 if(!dest||distance(origin,dest)<.75)return false;
 const safeOrigin=safeStanding(dim,origin);
 if(!p.tryTeleport(dest,{dimension:dim,checkForBlocks:true,keepVelocity:false}))return false;
 try{
  if(!spend(p,t)){p.tryTeleport(origin,{dimension:dim,checkForBlocks:true,keepVelocity:false});return false;}
 }catch(error){p.tryTeleport(origin,{dimension:dim,checkForBlocks:true,keepVelocity:false});throw error;}
 if(enhanced&&dim.id==='minecraft:the_end'){
  anchors.delete(p.id);
  if(safeOrigin)anchors.set(p.id,{point:origin,dimension:dim.id,expires:system.currentTick+1200});
 }
 return true;
}
async function advanced(p,t){
 if(forms.has(p.id))return;forms.add(p.id);
 try{
  if(!stillHeld(p,t))return;
  const origin={...p.location},dim=p.dimension.id,l=limits(dim,true);
  const form=new ActionFormData().title('エンチャントされた金のコーラスフルーツ')
   .body(`転移方式を選択\n現在地 X: ${origin.x.toFixed(1)} Y: ${origin.y.toFixed(1)} Z: ${origin.z.toFixed(1)}\nDimension: ${dim}\n座標指定：最大${l.coordinate}ブロック\n${dim==='minecraft:the_end'?'End Resonance : ACTIVE':''}`)
   .button('視線方向へワープ').button('照準地点へワープ').button('座標を指定').button('ヴォイドアンカー確認');
  const result=await form.show(p);if(result.canceled||!stillHeld(p,t))return;
  let success;
  if(result.selection===0||result.selection===1)success=warp(p,t,result.selection===0?'view':'aim');
  else if(result.selection===2){
   const base={...p.location};
   const input=await new ModalFormData().title('座標を指定').textField('X','1250 または ~100',{defaultValue:'~'}).textField('Y','72 または ~',{defaultValue:'~'}).textField('Z','-430 または ~-50',{defaultValue:'~'}).show(p);
   if(input.canceled||!stillHeld(p,t))return;
   try{const [x,y,z]=input.formValues;success=warp(p,t,'coordinate',{x:parseAxis(x,base.x),y:parseAxis(y,base.y),z:parseAxis(z,base.z)});}catch(e){await new ActionFormData().title('座標を確認してください').body(String(e.message)).button('閉じる').show(p);return;}
  }else if(result.selection===3){
   const a=anchors.get(p.id),active=a&&a.dimension===p.dimension.id&&a.expires>system.currentTick;
   await new ActionFormData().title('ヴォイド・アンカー').body(active?`有効：残り${Math.ceil((a.expires-system.currentTick)/20)}秒\nX: ${a.point.x.toFixed(1)} Y: ${a.point.y.toFixed(1)} Z: ${a.point.z.toFixed(1)}\n奈落への落下時に一度だけ自動帰還します。`:'現在、有効なアンカーはありません。\nエンドで安全地点からワープすると60秒間記録されます。').button('閉じる').show(p);return;
  }
  if(success===false)await new ActionFormData().title('テレポート失敗').body('経路と着地点の安全を確認できませんでした。距離・壁・足場を確認してください。アイテムは消費していません。').button('閉じる').show(p);
 }catch(error){report(error);}finally{forms.delete(p.id);}
}
export function useExtension(event){
 const p=event.source,id=event.itemStack?.typeId;
 if(!alive(p)||(!EGGS.has(id)&&!CHORUS.has(id)))return;
 const previous=lastUse.get(p.id);
 if(previous===system.currentTick)return;
 lastUse.set(p.id,system.currentTick);
 const t=ticket(p,id);if(!t)return;
 try{
  if(EGGS.has(id))throwEgg(p,t);
  else if(id==='a:egchorus_fruit'&&p.isSneaking)system.run(()=>{void advanced(p,t);});
  else warp(p,t); // no form, chat, actionbar or science text on normal use
 }catch(error){report(error);}
}
system.runInterval(()=>{
 for(const [id,s] of shots){
  try{
   const e=s.entity;if(!e.isValid){shots.delete(id);continue;}
   if(system.currentTick-s.born>400){removeShot(e);continue;}
   const current=e.location,velocity=e.getVelocity();
   // Check swept segments as a second guard against high-speed wall tunneling.
   if(!visible(e.dimension,s.last,current)){removeShot(e);continue;}
   s.last={...current};
   if(!s.enhanced)continue;
   const target=s.target;
   if(!alive(target)||target.dimension.id!==e.dimension.id||distance(current,target.location)>32){
    s.target=lock(e.dimension,current,velocity,s.owner);
   }
   let next=velocity;
   if(s.target&&alive(s.target)&&visible(e.dimension,current,add(s.target.location,{x:0,y:1.3,z:0})))next=turnToward(velocity,sub(add(s.target.location,{x:0,y:1.3,z:0}),current));
   if(!visible(e.dimension,current,add(current,next))){removeShot(e);continue;}
   e.getComponent('minecraft:projectile').shoot(next);
  }catch(error){shots.delete(id);report(error);}
 }
 for(const [id,a] of anchors){
  try{
   const p=world.getEntity(id);
   if(!alive(p)||p.dimension.id!==a.dimension||system.currentTick>=a.expires){anchors.delete(id);continue;}
   if(p.location.y<p.dimension.heightRange.min-8&&p.getVelocity().y<0){
    anchors.delete(id);
    if(safeStanding(p.dimension,a.point))p.tryTeleport(a.point,{dimension:p.dimension,checkForBlocks:true,keepVelocity:false});
   }
  }catch(error){anchors.delete(id);report(error);}
 }
},1);
world.afterEvents.playerLeave.subscribe(e=>{anchors.delete(e.playerId);forms.delete(e.playerId);lastUse.delete(e.playerId);});
world.afterEvents.entityDie.subscribe(e=>{anchors.delete(e.deadEntity.id);});
world.afterEvents.playerDimensionChange.subscribe(e=>{anchors.delete(e.player.id);});
