const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),scripts=path.join(root,"behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5/scripts");
const catalogSource=fs.readFileSync(path.join(scripts,'meshy_food_catalog.js'),'utf8').replace('export const','const');
const source=fs.readFileSync(path.join(scripts,'main.js'),'utf8').replace(/^import .*;\r?\n/gm,'');
const catalog=Object.fromEntries(JSON.parse(fs.readFileSync(path.join(root,'docs/meshy_food/catalog.json'))).map(r=>['pine:'+r.name,r.entity_id]));
let checks=0;
function runCase(label,fn){fn();checks++;console.log('PASS',label);}
function env(options={}){
 const o={id:'pine:honey_bread',amount:3,mode:'Survival',face:'Up',surface:1,yaw:45,sneak:true,...options};
 const hooks={},queue=[],spawned=[],drops=[],messages=[];let held={typeId:o.id,amount:o.amount},writes=0;
 const dimension={id:'overworld',getBlock(p){if(Math.floor(p.y)===10)return {typeId:'minecraft:stone',isAir:false,isLiquid:false};return {isAir:!o.blocked}},getEntities(query={}){if(o.occupied)return [{}];return spawned.filter(e=>{if(e.removed)return false;if(!query.location||query.maxDistance==null)return true;const dx=e.location.x-query.location.x,dy=e.location.y-query.location.y,dz=e.location.z-query.location.z;return dx*dx+dy*dy+dz*dz<=query.maxDistance*query.maxDistance})},spawnEntity(id,loc){if(o.spawnFail)throw Error('spawn failed');const e={id:'e'+spawned.length,typeId:id,location:{...loc},dimension,setRotation(rot){if(o.rotationFail)throw Error('rotation failed');this.rotation=rot},remove(){this.removed=true}};spawned.push(e);return e},spawnItem(item,loc){if(o.dropFail)throw Error('drop failed');const drop={item,loc,remove(){this.removed=true}};drops.push(drop);return drop}};
 const inventory={getItem(){return held?{...held}:undefined},setItem(slot,value){if(o.inventoryFail)throw Error('inventory failed');writes++;held=value}};
 const player={id:'p',typeId:'minecraft:player',selectedSlotIndex:0,isSneaking:o.sneak,dimension,getRotation(){return {y:o.yaw}},getGameMode(){return o.mode},getComponent(){return {container:inventory}},getHeadLocation(){return {x:.5,y:12,z:.5}},sendMessage(s){messages.push(s)}};
 function signal(name){return {subscribe(fn){hooks[name]=fn}}}
 const world={beforeEvents:{playerInteractWithBlock:signal('block'),itemUse:signal('use')},afterEvents:{entityHitEntity:signal('hit')}};
 const context=vm.createContext({world,system:{run(fn){queue.push(fn)}},GameMode:{Creative:'Creative',Survival:'Survival',Adventure:'Adventure'},ItemStack:class {constructor(typeId,amount){this.typeId=typeId;this.amount=amount}},console:{warn(){}}});
 vm.runInContext(catalogSource+'\n'+source,context);
 function flush(){while(queue.length)queue.shift()()}
 flush();
 function block(override={}){const {blockLocation={x:0,y:10,z:0},...eventOverride}=override;const ev={player,itemStack:{typeId:o.id},block:{dimension,location:blockLocation,typeId:'minecraft:stone'},blockFace:o.face,faceLocation:{x:.5,y:o.surface,z:.5},isFirstEvent:true,cancel:false,...eventOverride};hooks.block(ev);return ev}
 return {o,hooks,block,flush,spawned,drops,messages,player,held:()=>held,writes:()=>writes,queue};
}
runCase('all 35 IDs place their own Meshy entity and use exactly one survival item',()=>{
 assert.equal(Object.keys(catalog).length,35);
 for(const [item,entity] of Object.entries(catalog)){const e=env({id:item});assert.equal(e.block().cancel,true);assert.equal(e.spawned.length,0);e.flush();assert.equal(e.spawned[0].typeId,entity);assert.equal(e.held().amount,2);assert.equal(e.writes(),1)}
});
runCase('creative placement consumes no item (no hunger/use success dependency)',()=>{const e=env({mode:'Creative'});e.block();e.flush();assert.equal(e.spawned.length,1);assert.equal(e.writes(),0)});
runCase('eight yaw directions and negative diagonals retained',()=>{for(const yaw of [0,45,90,135,180,-135,-90,-45]){const e=env({yaw});e.block();e.flush();assert.equal(e.spawned[0].rotation.y,yaw)}});
runCase('slab surface uses ray hit height, bottom is not sunk into support',()=>{const e=env({surface:.5});e.block();e.flush();assert.equal(e.spawned[0].location.y,10.502)});
runCase('integer top face reported as zero stays above the block',()=>{for(const surface of [0,-0,0.00000001,1]){const e=env({surface});e.block();e.flush();assert.equal(e.spawned[0].location.y,11.002)}});
runCase('normal eating and normal block use untouched',()=>{const e=env({sneak:false});assert.equal(e.block().cancel,false);const use={source:e.player,itemStack:{typeId:e.o.id},cancel:false};e.hooks.use(use);assert.equal(use.cancel,false);assert.equal(e.queue.length,0)});
runCase('Shift food use is canceled without a duplicate spawn',()=>{const e=env();e.block();const use={source:e.player,itemStack:{typeId:e.o.id},cancel:false};e.hooks.use(use);e.flush();assert.equal(use.cancel,true);assert.equal(e.spawned.length,1)});
runCase('non-target items unchanged',()=>{const e=env({id:'minecraft:apple'});assert.equal(e.block().cancel,false);e.flush();assert.equal(e.spawned.length,0)});
runCase('held input follow-up and same-location double input cannot place twice',()=>{const e=env();e.block();e.block();e.block({isFirstEvent:false});e.flush();assert.equal(e.spawned.length,1);assert.equal(e.writes(),1)});
runCase('rapid distinct first-events queue instead of being discarded while a placement is pending',()=>{const e=env();e.block({blockLocation:{x:0,y:10,z:0}});e.block({blockLocation:{x:1,y:10,z:0}});assert.equal(e.spawned.length,0);e.flush();assert.equal(e.spawned.filter(x=>!x.removed).length,2);assert.equal(e.held().amount,1);assert.equal(e.writes(),2)});
for(const [label,options] of Object.entries({occupied:{occupied:true},blocked:{blocked:true},side:{face:'North'},spectator:{mode:'Spectator'},adventure:{mode:'Adventure'},spawn_failure:{spawnFail:true},rotation_failure:{rotationFail:true},inventory_failure:{inventoryFail:true}})){
 runCase(label+' leaves no new entity or consumed item',()=>{const e=env(options);e.block();e.flush();assert.equal(e.spawned.filter(x=>!x.removed).length,0);assert.equal(e.held().amount,3);assert.equal(e.writes(),0)});
}
runCase('cancelled interactions respected',()=>{const e=env();e.block({cancel:true});e.flush();assert.equal(e.spawned.length,0)});
runCase('changing selected slot before deferred work aborts placement',()=>{const e=env();e.block();e.player.selectedSlotIndex=1;e.flush();assert.equal(e.spawned.length,0);assert.equal(e.writes(),0)});
runCase('last survival item clears slot exactly once',()=>{const e=env({amount:1});e.block();e.flush();assert.equal(e.held(),undefined);assert.equal(e.writes(),1)});
runCase('hit retrieval returns the corresponding item once',()=>{const e=env();e.block();e.flush();const event={damagingEntity:e.player,hitEntity:e.spawned[0]};e.hooks.hit(event);e.hooks.hit(event);assert.equal(e.drops.length,1);assert.equal(e.drops[0].item.typeId,e.o.id);assert.equal(e.spawned[0].removed,true)});
runCase('failed item drop leaves food placed',()=>{const e=env({dropFail:true});e.block();e.flush();e.hooks.hit({damagingEntity:e.player,hitEntity:e.spawned[0]});assert.equal(e.spawned[0].removed,undefined)});
console.log(JSON.stringify({result:'PASS',test_cases:checks,catalog_items:35,runtime_verified:false}));
