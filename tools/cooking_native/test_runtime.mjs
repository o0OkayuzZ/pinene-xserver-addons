import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
import {COOKING_RUNTIME,OBSERVED_ITEM_IDS} from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/cooking_runtime.js';
import {sessionBreakChance,shouldBreakSession,initialUsesFromDamage,visualDamage} from '../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/wear_curve.js';
const code=fs.readFileSync(new URL('../../behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/native_boards.js',import.meta.url),'utf8').replace(/^import .*?;$/gm,'').replace(/export /g,'');
function environment(random=.999999){
 const events={},queue=[],intervals=[],entities=[],messages=[],actionbars=[];
 let restricted=false;
 const copy=x=>x?.clone();
 class Stack{
  constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.nameTag='';this.damage=0;this.maxDurability=96;this.lore=[];this.props={};}
  clone(){const s=new Stack(this.typeId,this.amount);s.nameTag=this.nameTag;s.damage=this.damage;s.maxDurability=this.maxDurability;s.lore=[...this.lore];s.props=JSON.parse(JSON.stringify(this.props));if(this.lockMode!==undefined)s.lockMode=this.lockMode;if(this.keepOnDeath!==undefined)s.keepOnDeath=this.keepOnDeath;return s;}
  getLore(){return [...this.lore];}getTags(){return [];}getDynamicProperty(k){return this.props[k];}
  setDynamicProperty(k,v){if(v===undefined)delete this.props[k];else this.props[k]=v;}getDynamicPropertyIds(){return Object.keys(this.props);}
  getComponent(id){if(id==='minecraft:durability'){const self=this;return {get damage(){return self.damage;},set damage(v){self.damage=v;},get maxDurability(){return self.maxDurability;}};}if(id==='minecraft:enchantable')return {getEnchantments:()=>[]};}
 }
 class Inv{constructor(n=36){this.size=n;this.slots=Array(n);}getItem(i){return copy(this.slots[i]);}setItem(i,s){this.slots[i]=copy(s);}moveItem(from,to,target){assert(!target.slots[to]);target.slots[to]=this.slots[from];this.slots[from]=undefined;}}
 class Perm{constructor(state='empty'){this.state=state;}getState(){return this.state;}getAllStates(){return {"pinene_cooking:knife":this.state};}withState(k,s){return new Perm(s);}}
 const block={typeId:'pinene_cooking:oak_cutting_board',location:{x:0,y:0,z:0},permutation:new Perm(),setPermutation(p){if(this.fail){this.fail=false;throw Error('set_failed');}this.permutation=p;}};
 const dimension={id:'minecraft:overworld',getBlock(){return block;},getEntities(){return entities.filter(e=>e.isValid);},spawnEntity(typeId,location){const props=new Map(),storage=new Inv(1);const e={id:'holder_'+entities.length,typeId,location,isValid:true,getComponent:()=>({container:storage}),getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),remove(){this.isValid=false;}};entities.push(e);return e;}};block.dimension=dimension;
 const inventory=new Inv(),cursor={item:undefined};let health=20;
 const player={id:'p',isValid:true,location:{x:0.5,y:0,z:0.5},dimension,selectedSlotIndex:0,isSneaking:false,
  getComponent:id=>id==='minecraft:inventory'?{container:inventory}:id==='minecraft:health'?{currentValue:health}:id==='minecraft:cursor_inventory'?cursor:undefined,
  sendMessage:m=>messages.push(m),onScreenDisplay:{setActionBar:text=>{assert.equal(restricted,false);actionbars.push(text);}}};
 const world={getAllPlayers:()=>[player],beforeEvents:{playerInteractWithBlock:{subscribe:f=>{const previous=events.interact;events.interact=e=>{const old=restricted;restricted=true;try{previous?.(e);f(e);}finally{restricted=old;}};}},playerBreakBlock:{subscribe:f=>events.break=f}},afterEvents:{playerLeave:{subscribe:f=>events.leave=f}}};
 const system={currentTick:0,run:f=>{queue.push(f);return queue.length;},runInterval:(f,t=1)=>{intervals.push({f,t});return intervals.length;}};
 const fakeMath=Object.create(Math);fakeMath.random=()=>random;
 const sandbox={world,system,ItemStack:Stack,COOKING_RUNTIME,OBSERVED_ITEM_IDS,sessionBreakChance,shouldBreakSession,initialUsesFromDamage,visualDamage,Math:fakeMath,console:{warn(){}}};
 vm.runInNewContext(code+'\nglobalThis.api={moveIntoEmpty,knifeMaterial,seedPlacedKnife,knifeSnapshot,knifeUsable,summarizeTestKnives,rankActionbarText,knifeUses,breakDue,trackedCounts,detectedUsedRecipe,markUsedSession,resolvePendingBreak,migrateLegacyKnife};',sandbox);
 function flush(){while(queue.length)queue.shift()();}
 function tick(n=1){for(let step=0;step<n;step++){system.currentTick++;for(const x of intervals)if(system.currentTick%x.t===0)x.f();flush();}}
 function click(){const e={player,block,isFirstEvent:true,cancel:false};events.interact(e);flush();return e;}
 flush();return {world,system,api:sandbox.api,Inv,Stack,entities,inventory,cursor,player,block,messages,actionbars,events,click,flush,tick,setHealth:v=>{health=v;}};
}
function knife(e){const s=new e.Stack('pinene_cooking:copper_knife');s.damage=37;s.nameTag='kept name';s.lore=['kept lore'];e.inventory.setItem(0,s);return s;}
test('legacy marker migrates once with damage retained',()=>{
 const e=environment(),marker=e.block.dimension.spawnEntity('pinene_cooking:placed_copper_knife',{x:.5,y:.145,z:.5});
 marker.setDynamicProperty('pinene_cooking:knife_damage',37);e.block.permutation.state='copper';
 assert.equal(e.click().cancel,true);assert.equal(marker.getComponent().container.getItem(0).damage,37);
 assert.equal(e.click().cancel,false);e.player.isSneaking=true;e.click();assert.equal(e.inventory.getItem(0).damage,37);
 assert.equal(e.entities.filter(x=>x.isValid).length,0);
});
test('duplicate legacy markers are preserved and rejected',()=>{
 const e=environment();for(let n=0;n<2;n++){const a=e.block.dimension.spawnEntity('pinene_cooking:placed_copper_knife',{});a.setDynamicProperty('pinene_cooking:knife_damage',7);}
 assert.equal(e.click().cancel,true);assert.equal(e.entities.filter(x=>x.isValid).length,2);
 assert(e.entities.every(x=>!x.getComponent().container.getItem(0)));
});
test('failed legacy migration retains damage and allows a safe retry',()=>{
 const e=environment(),a=e.block.dimension.spawnEntity('pinene_cooking:placed_copper_knife',{});a.setDynamicProperty('pinene_cooking:knife_damage',17);e.block.fail=true;
 e.click();assert.equal(a.getComponent().container.getItem(0),undefined);assert.equal(a.getDynamicProperty('pinene_cooking:knife_damage'),17);
 e.click();assert.equal(a.getComponent().container.getItem(0).damage,17);
});
test('second player cannot take knife while first native screen is active',()=>{
 const e=environment();knife(e);e.click();e.click();
 const second={...e.player,id:'p2',isSneaking:true};e.world.getAllPlayers=()=>[e.player,second];
 const event={player:second,block:e.block,isFirstEvent:true,cancel:false};e.events.interact(event);e.flush();
 assert.equal(event.cancel,true);assert.equal(e.block.permutation.state,'copper');
 e.player.location={x:2,y:0,z:2};e.events.interact({...event,cancel:false});e.flush();assert.equal(e.block.permutation.state,'empty');
});
test('used session retains ownership until operator moves away',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese'));e.click();
 e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.tick();
 const second={...e.player,id:'p2',isSneaking:true};e.world.getAllPlayers=()=>[e.player,second];
 e.events.interact({player:second,block:e.block,isFirstEvent:true,cancel:false});e.flush();assert.equal(e.block.permutation.state,'copper');
});
test('native ingredient snapshot is taken before deferred callbacks',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese'));
 e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});
 e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.flush();e.tick();
 assert.equal(e.entities[0].getComponent().container.getItem(0).damage,38);
});
test('higher-rank output pickup cannot count as crafting on copper board',()=>{
 const e=environment();assert.equal(e.api.detectedUsedRecipe({'minecraft:bread':1,'minecraft:apple':1,'pine:butter':1},{'pine:apple_bread':1},2),undefined);
});
test('movement abandons stale inventory evidence',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese'));e.click();
 e.player.location={x:1,y:0,z:1};e.tick();e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.tick();
 assert.equal(e.entities[0].getComponent().container.getItem(0).damage,37);
});
test('empty board refuses native open',()=>{const e=environment();assert.equal(e.click().cancel,true);});
test('normal unrelated crafting table untouched',()=>{const e=environment();e.block.typeId='minecraft:crafting_table';assert.equal(e.click().cancel,false);});
test('place stores exact knife, not recreated default',()=>{const e=environment();const s=knife(e);e.click();assert.equal(e.inventory.getItem(0),undefined);const a=e.entities[0].getComponent().container.getItem(0);assert.deepEqual(a,s);assert.equal(e.block.permutation.state,'copper');});
test('native screen opening is not canceled after placing',()=>{const e=environment();knife(e);e.click();assert.equal(e.click().cancel,false);});
test('retrieval keeps wear/name/lore',()=>{const e=environment();const s=knife(e);e.click();e.player.isSneaking=true;e.click();assert.deepEqual(e.inventory.getItem(0),s);assert.equal(e.block.permutation.state,'empty');});
test('full inventory retrieval leaves stored knife intact',()=>{const e=environment();knife(e);e.click();for(let i=0;i<36;i++)e.inventory.setItem(i,new e.Stack('minecraft:stone',64));e.player.isSneaking=true;e.click();assert.equal(e.block.permutation.state,'copper');assert.equal(e.entities[0].getComponent().container.getItem(0).damage,37);});
test('failed permutation change rolls knife back',()=>{const e=environment();const s=knife(e);e.block.fail=true;e.click();assert.deepEqual(e.inventory.getItem(0),s);assert.equal(e.entities.filter(a=>a.isValid).length,0);});
test('no phantom knife allowed by visual state alone',()=>{const e=environment();e.block.permutation.state='netherite';assert.equal(e.click().cancel,true);});
test('separate players do not disable cooking globally',()=>{const e=environment();knife(e);e.click();e.world.getAllPlayers=()=>[e.player,{id:'second'}];assert.equal(e.click().cancel,false);});
test('occupied board mining preserves the stored knife',()=>{const e=environment();knife(e);e.click();const ev={player:e.player,block:e.block,cancel:false};e.events.break(ev);e.flush();assert.equal(ev.cancel,true);assert.equal(e.entities[0].getComponent().container.getItem(0).amount,1);});
test('move refuses occupied destination',()=>{const e=environment();knife(e);const other=new e.Inv(1);other.setItem(0,new e.Stack('minecraft:stone'));assert.throws(()=>e.api.moveIntoEmpty(e.inventory,0,other,0));assert.equal(e.inventory.getItem(0).damage,37);});
test('repeated 100 placements/retrievals neither duplicate nor reset metadata in mock',()=>{const e=environment();const s=knife(e);for(let i=0;i<100;i++){e.player.isSneaking=false;e.click();e.player.isSneaking=true;e.click();assert.deepEqual(e.inventory.getItem(0),s);}assert.equal(e.entities.filter(a=>a.isValid).length,0);});
test('queued placement refuses a swapped source item',()=>{const e=environment();knife(e);e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});e.inventory.setItem(0,new e.Stack('minecraft:diamond'));e.flush();assert.equal(e.inventory.getItem(0).typeId,'minecraft:diamond');assert.equal(e.entities.length,0);});

test('same-type worn knife swapped before queue is not consumed',()=>{
 const e=environment();knife(e);e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});
 const replacement=knife(e);replacement.damage=2;e.inventory.setItem(0,replacement);e.flush();
 assert.equal(e.inventory.getItem(0).damage,2);assert.equal(e.entities.length,0);
});
test('same-type renamed knife swapped before queue is not consumed',()=>{
 const e=environment();knife(e);e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});
 const replacement=knife(e);replacement.nameTag='different';e.inventory.setItem(0,replacement);e.flush();
 assert.equal(e.inventory.getItem(0).nameTag,'different');assert.equal(e.entities.length,0);
});
test('exhausted knife cannot enable a recipe table',()=>{
 const e=environment();const s=knife(e);s.damage=96;e.inventory.setItem(0,s);e.click();
 assert.equal(e.entities.length,0);assert.equal(e.block.permutation.state,'empty');
});
test('negative knife damage fails closed',()=>{
 const e=environment();const s=knife(e);s.damage=-1;e.inventory.setItem(0,s);e.click();assert.equal(e.entities.length,0);
});
test('health change before placement preserves the knife',()=>{
 const e=environment();const s=knife(e);e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});
 e.setHealth(0);e.flush();
 assert.deepEqual(e.inventory.getItem(0),s);assert.equal(e.entities.length,0);
});

test('test audit reads eight knives with exactly one worn fixture',()=>{
 const e=environment();const stacks=Array.from({length:8},()=>new e.Stack('pinene_cooking:copper_knife'));
 stacks[0].nameTag='検証用・使用47の銅ナイフ';stacks[0].damage=47;
 const r=e.api.summarizeTestKnives(stacks);assert.equal(r.ok,true);assert.equal(r.uses,47);assert.equal(r.damage,47);
 stacks[0].setDynamicProperty('pinene_cooking:uses_v1',48);assert.equal(e.api.summarizeTestKnives(stacks).uses,48);
});
test('test audit rejects missing and duplicate knife fixtures',()=>{
 const e=environment();const a=new e.Stack('pinene_cooking:copper_knife');a.nameTag='検証用・使用47の銅ナイフ';a.damage=47;
 assert.equal(e.api.summarizeTestKnives([a]).ok,false);
 const copies=Array.from({length:8},()=>a.clone());assert.equal(e.api.summarizeTestKnives(copies).fixtureOK,false);
});


test('rank notice uses existing limits and standard ASCII roman numerals',()=>{
 const e=environment();for(const [m,n] of Object.entries({copper:'II',iron:'III',gold:'IV',diamond:'VI',netherite:'VII'}))
 assert.equal(e.api.rankActionbarText(m),'§7現在ランク：§f'+n+'§r');
 for(const m of [undefined,'missing','toString','__proto__'])assert.equal(e.api.rankActionbarText(m),undefined);
});
test('placing knife emits one notice without changing its name or damage',()=>{
 const e=environment(),s=knife(e);e.click();assert.deepEqual(e.actionbars,['§7現在ランク：§fII§r']);
 assert.deepEqual(e.entities[0].getComponent().container.getItem(0),s);
});
test('native open is not canceled or delayed by deferred HUD notice',()=>{
 const e=environment();knife(e);e.click();e.actionbars.length=0;
 const event={player:e.player,block:e.block,isFirstEvent:true,cancel:false};e.events.interact(event);
 assert.equal(event.cancel,false);assert.equal(e.actionbars.length,0);e.flush();
 assert.deepEqual(e.actionbars,['§7現在ランク：§fII§r']);
});
test('retrieval reports unset rank once',()=>{
 const e=environment();knife(e);e.click();e.actionbars.length=0;e.player.isSneaking=true;e.click();
 assert.deepEqual(e.actionbars,['§7現在ランク：§f未設定§r']);e.flush();assert.equal(e.actionbars.length,1);
});
test('empty and unrelated boards do not invent a rank notice',()=>{
 const e=environment();e.click();e.block.typeId='minecraft:crafting_table';e.click();assert.equal(e.actionbars.length,0);
});
test('failed placement does not announce success',()=>{
 const e=environment();knife(e);e.block.fail=true;e.click();assert.equal(e.actionbars.length,0);
});
test('repeat held-input events do not refresh the notice',()=>{
 const e=environment();knife(e);e.click();e.actionbars.length=0;
 for(let i=0;i<50;i++)e.events.interact({player:e.player,block:e.block,isFirstEvent:false,cancel:false});
 e.flush();assert.equal(e.actionbars.length,0);
});
test('notice failure never rolls back a completed place or retrieve',()=>{
 const e=environment(),s=knife(e);e.player.onScreenDisplay.setActionBar=()=>{throw Error('hud unavailable');};
 e.click();assert.equal(e.block.permutation.state,'copper');assert.equal(e.inventory.getItem(0),undefined);
 assert.equal(e.click().cancel,false);e.player.isSneaking=true;e.click();assert.deepEqual(e.inventory.getItem(0),s);
});
test('disconnect before deferred notice suppresses stale display',()=>{
 const e=environment();knife(e);e.click();e.actionbars.length=0;
 e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});e.player.isValid=false;e.flush();
 assert.equal(e.actionbars.length,0);
});
test('leaving the board before deferred notice suppresses stale display',()=>{
 const e=environment();knife(e);e.click();e.actionbars.length=0;
 e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});e.player.location={x:99,y:0,z:0};e.flush();
 assert.equal(e.actionbars.length,0);
});
test('removing the knife before deferred notice suppresses stale rank',()=>{
 const e=environment();knife(e);e.click();e.actionbars.length=0;
 e.events.interact({player:e.player,block:e.block,isFirstEvent:true,cancel:false});
 e.entities[0].getComponent().container.setItem(0,undefined);e.block.permutation.state='empty';e.flush();
 assert.equal(e.actionbars.length,0);
});
test('session wear adds one lightweight monitor but no UI reopening or title popup',()=>{
 assert.equal((code.match(/runInterval\(/g)||[]).length,1);assert.equal(code.includes('runTimeout('),false);
 assert.equal(code.includes('.show('),false);assert.equal(code.includes('.setTitle('),false);
 assert.equal(/\.nameTag\s*=(?!=)/.test(code),false);
});


test('opening and closing without a detected recipe does not age the knife',()=>{
 const e=environment();knife(e);e.click();e.click();e.tick(20);
 const s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.damage,37);assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),undefined);
});
test('one detected cheese craft ages the placed knife exactly once',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese',1));e.click();
 e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.tick();
 let s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.damage,38);assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),38);
 e.inventory.setItem(2,new e.Stack('pine:cheese',8));e.tick(20);
 s=e.entities[0].getComponent().container.getItem(0);assert.equal(s.damage,38);
});
test('shift-style sixteen cheese output is still one used session',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese',4));e.click();
 e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',16));e.tick();
 const s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),38);assert.equal(s.damage,38);
});
test('picking up a tracked result without consuming its recipe ingredients does not age the knife',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese',1));e.click();
 e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.tick(10);
 const s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),undefined);assert.equal(s.damage,37);
});
test('ingredient loss without a result does not age the knife',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese',1));e.click();
 e.inventory.setItem(1,undefined);e.tick(10);
 const s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),undefined);
});
test('crafted output on the cursor is included in used-session detection',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese',1));e.click();
 e.inventory.setItem(1,undefined);e.cursor.item=new e.Stack('pine:cheese',4);e.tick();
 const s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),38);
});
test('mixed allowed seed consumption can prove an oil session without billing every seed',()=>{
 const e=environment();knife(e);e.click();
 const ids=['minecraft:wheat_seeds','minecraft:pumpkin_seeds','minecraft:melon_seeds','minecraft:beetroot_seeds'];
 ids.forEach((id,i)=>e.inventory.setItem(i+1,new e.Stack(id,2)));
 e.inventory.setItem(5,new e.Stack('minecraft:glass_bottle',1));e.click();
 for(let i=1;i<=5;i++)e.inventory.setItem(i,undefined);
 e.inventory.setItem(6,new e.Stack('pine:cooking_oil',1));e.tick();
 const s=e.entities[0].getComponent().container.getItem(0);
 assert.equal(s.getDynamicProperty('pinene_cooking:uses_v1'),38);
});
test('a winning break roll is persisted but does not delete the knife during the completed session',()=>{
 const e=environment(0);knife(e);e.click();
 let stored=e.entities[0].getComponent().container.getItem(0);
 stored.setDynamicProperty('pinene_cooking:uses_v1',100);stored.damage=95;
 e.entities[0].getComponent().container.setItem(0,stored);
 e.inventory.setItem(1,new e.Stack('pine:whole_cheese',1));e.click();
 e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.tick();
 stored=e.entities[0].getComponent().container.getItem(0);
 assert.equal(stored.getDynamicProperty('pinene_cooking:break_due_v1'),true);
 assert.equal(e.block.permutation.state,'copper');assert.equal(e.entities[0].isValid,true);
});
test('pending probabilistic break resolves before the next native board opening',()=>{
 const e=environment(0);knife(e);e.click();
 let stored=e.entities[0].getComponent().container.getItem(0);
 stored.setDynamicProperty('pinene_cooking:uses_v1',100);stored.setDynamicProperty('pinene_cooking:break_due_v1',true);
 e.entities[0].getComponent().container.setItem(0,stored);
 const ev=e.click();assert.equal(ev.cancel,true);assert.equal(e.block.permutation.state,'empty');
 assert.equal(e.entities[0].isValid,false);assert(e.messages.some(m=>m.includes('寿命で壊れました')));
});
test('pending break cannot be dodged by sneaking to retrieve the knife',()=>{
 const e=environment(0);knife(e);e.click();
 let stored=e.entities[0].getComponent().container.getItem(0);
 stored.setDynamicProperty('pinene_cooking:uses_v1',100);stored.setDynamicProperty('pinene_cooking:break_due_v1',true);
 e.entities[0].getComponent().container.setItem(0,stored);e.player.isSneaking=true;e.click();
 assert.equal(e.block.permutation.state,'empty');assert.equal(e.inventory.getItem(0),undefined);
});
test('session wear metadata survives normal retrieval when no break was rolled',()=>{
 const e=environment();knife(e);e.click();e.inventory.setItem(1,new e.Stack('pine:whole_cheese',1));e.click();
 e.inventory.setItem(1,undefined);e.inventory.setItem(2,new e.Stack('pine:cheese',4));e.tick();
 e.player.isSneaking=true;e.click();
 const returned=e.inventory.getItem(0);
 assert.equal(returned.getDynamicProperty('pinene_cooking:uses_v1'),38);assert.equal(returned.damage,38);
});
