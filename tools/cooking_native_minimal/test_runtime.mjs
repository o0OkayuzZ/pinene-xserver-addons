import test from 'node:test';import assert from 'node:assert/strict';import vm from 'node:vm';import fs from 'node:fs';
const code=fs.readFileSync(new URL('./native_boards.js',import.meta.url),'utf8').replace(/^import .*?;$/gm,'').replace(/export /g,'');
function environment(){
 const events={},queue=[],entities=[],messages=[];
 const copy=x=>x?.clone();
 class Stack{constructor(typeId,amount=1){this.typeId=typeId;this.amount=amount;this.nameTag='';this.damage=0;this.lore=[];}clone(){const s=new Stack(this.typeId,this.amount);Object.assign(s,JSON.parse(JSON.stringify(this)));return s;}getLore(){return [...this.lore];}getComponent(id){return id==='minecraft:durability'?{damage:this.damage,maxDurability:96}:undefined;}}
 class Inv{constructor(n=36){this.size=n;this.slots=Array(n);}getItem(i){return copy(this.slots[i]);}setItem(i,s){this.slots[i]=copy(s);}moveItem(from,to,target){assert(!target.slots[to]);target.slots[to]=this.slots[from];this.slots[from]=undefined;}}
 class Perm{constructor(state='empty'){this.state=state;}getState(){return this.state;}getAllStates(){return {"pinene_cooking:knife":this.state};}withState(k,s){return new Perm(s);}}
 const block={typeId:'pinene_cooking:oak_cutting_board',location:{x:0,y:0,z:0},permutation:new Perm(),setPermutation(p){if(this.fail){this.fail=false;throw Error('set_failed');}this.permutation=p;}};
 const dimension={id:'minecraft:overworld',getBlock(){return block;},getEntities(){return entities.filter(e=>e.isValid);},spawnEntity(typeId,location){const props=new Map(),storage=new Inv(1);const e={typeId,location,isValid:true,getComponent:()=>({container:storage}),getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),remove(){this.isValid=false;}};entities.push(e);return e;}};block.dimension=dimension;
 const inventory=new Inv();const player={id:'p',isValid:true,location:{x:0.5,y:0,z:0.5},dimension,selectedSlotIndex:0,isSneaking:false,getComponent:()=>({container:inventory}),sendMessage:m=>messages.push(m)};
 const world={getAllPlayers:()=>[player],beforeEvents:{playerInteractWithBlock:{subscribe:f=>events.interact=f},playerBreakBlock:{subscribe:f=>events.break=f}}};
 const system={run:f=>{queue.push(f);return queue.length;}};const sandbox={world,system,ItemStack:Stack,console:{warn(){}}};
 vm.runInNewContext(code+'\nglobalThis.api={moveIntoEmpty,knifeMaterial,seedPlacedKnife,knifeSnapshot,knifeUsable};',sandbox);
 function flush(){while(queue.length)queue.shift()();}
 function click(){const e={player,block,isFirstEvent:true,cancel:false};events.interact(e);flush();return e;}
 flush();return {world,system,api:sandbox.api,Inv,Stack,entities,inventory,player,block,messages,events,click,flush};
}
function knife(e){const s=new e.Stack('pinene_cooking:copper_knife');s.damage=37;s.nameTag='kept name';s.lore=['kept lore'];e.inventory.setItem(0,s);return s;}
test('empty board refuses native open',()=>{const e=environment();assert.equal(e.click().cancel,true);});
test('normal unrelated crafting table untouched',()=>{const e=environment();e.block.typeId='minecraft:crafting_table';assert.equal(e.click().cancel,false);});
test('place stores exact knife, not recreated default',()=>{const e=environment();const s=knife(e);e.click();assert.equal(e.inventory.getItem(0),undefined);const a=e.entities[0].getComponent().container.getItem(0);assert.deepEqual(a,s);assert.equal(e.block.permutation.state,'copper');});
test('native screen opening is not canceled after placing',()=>{const e=environment();knife(e);e.click();assert.equal(e.click().cancel,false);});
test('retrieval keeps wear/name/lore',()=>{const e=environment();const s=knife(e);e.click();e.player.isSneaking=true;e.click();assert.deepEqual(e.inventory.getItem(0),s);assert.equal(e.block.permutation.state,'empty');});
test('full inventory retrieval leaves stored knife intact',()=>{const e=environment();knife(e);e.click();for(let i=0;i<36;i++)e.inventory.setItem(i,new e.Stack('minecraft:stone',64));e.player.isSneaking=true;e.click();assert.equal(e.block.permutation.state,'copper');assert.equal(e.entities[0].getComponent().container.getItem(0).damage,37);});
test('failed permutation change rolls knife back',()=>{const e=environment();const s=knife(e);e.block.fail=true;e.click();assert.deepEqual(e.inventory.getItem(0),s);assert.equal(e.entities.filter(a=>a.isValid).length,0);});
test('no phantom knife allowed by visual state alone',()=>{const e=environment();e.block.permutation.state='netherite';assert.equal(e.click().cancel,true);});
test('multiplayer integration deliberately blocked',()=>{const e=environment();knife(e);e.click();e.world.getAllPlayers=()=>[e.player,{id:'second'}];assert.equal(e.click().cancel,true);});
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
 e.player.getComponent=id=>id==='minecraft:health'?{currentValue:0}:{container:e.inventory};e.flush();
 assert.deepEqual(e.inventory.getItem(0),s);assert.equal(e.entities.length,0);
});
