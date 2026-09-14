const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const path=require('node:path');
const scripts=path.resolve(__dirname,'../behavior_packs/bp_16_3efecae8-a036-4e14-94d3-876e29fe0ae9/scripts/infinite_castle');
function setup(){
 const callbacks={},jobs=[],worldProps=new Map(),props=new Map(),inventory=Array(3),armor={},messages=[];
 const world={getDynamicProperty:k=>worldProps.get(k),setDynamicProperty:(k,v)=>worldProps.set(k,v),getAllPlayers:()=>[player],afterEvents:{entityDie:{subscribe:f=>callbacks.die=f},playerSpawn:{subscribe:f=>callbacks.spawn=f}}};
 const system={run:f=>jobs.push(f),runInterval:()=>{}};
 const equipment={getEquipment:s=>armor[s]?.clone(),setEquipment:(s,i)=>{armor[s]=i?.clone();return true;}};
 const container={size:3,getItem:i=>inventory[i]?.clone(),setItem:(i,item)=>inventory[i]=item?.clone()};
 const player={typeId:'minecraft:player',dimension:{id:'minecraft:overworld'},getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),sendMessage:s=>messages.push(s),getComponent:id=>id.endsWith('inventory')?{container}:id.endsWith('equippable')?equipment:{currentValue:20}};
 const sandbox={world,system,EquipmentSlot:{Head:'head',Chest:'chest',Legs:'legs',Feet:'feet',Offhand:'offhand'},console:{warn(){}}};vm.createContext(sandbox);
 vm.runInContext(fs.readFileSync(path.join(scripts,'castleTemporaryDeathPolicy.js'),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/^export /gm,'')+'\nglobalThis.api={beginTemporaryCastleVisit,finishTemporaryCastleVisit,installTemporaryCastleDeathReturn};',sandbox);
 return {...sandbox.api,world,player,inventory,armor,container,callbacks,jobs,props,messages};
}
function item(name,keep=false){return {typeId:name,keepOnDeath:keep,lore:['original lore'],getLore(){return [...this.lore];},setLore(v){this.lore=[...v];},clone(){const result=item(this.typeId,this.keepOnDeath);result.lore=[...this.lore];return result;}};}
let n=0;function test(name,f){f();n++;console.log('PASS '+name);}
test('entry and normal exit restore original lore and keepOnDeath',()=>{
 const s=setup();s.inventory[0]=item('minecraft:stone');s.armor.head=item('zombiegear:zombie_helmet',true);
 s.beginTemporaryCastleVisit(s.player);assert.equal(s.inventory[0].keepOnDeath,true);assert.equal(s.inventory[0].lore.length,2);
 s.finishTemporaryCastleVisit(s.player);assert.equal(s.inventory[0].keepOnDeath,false);assert.equal(s.armor.head.keepOnDeath,true);assert.deepEqual(s.armor.head.lore,['original lore']);
});
test('inventory failure rolls back entry and never creates a session',()=>{
 const s=setup();s.inventory[0]=item('stone');s.inventory[1]=item('dirt');let count=0;const set=s.container.setItem;
 s.container.setItem=(i,item)=>{if(++count===2)throw Error('write');set(i,item);};assert.throws(()=>s.beginTemporaryCastleVisit(s.player));
 assert.equal(s.inventory[0].keepOnDeath,false);assert.equal(s.inventory[1].keepOnDeath,false);assert.equal(s.props.get('infinite_castle:temporary_carry_session_v1'),undefined);
});
test('death preserves converted Zombie Gear marker and removes new loot',()=>{
 const s=setup();s.armor.head=item('zombiegear:zombie_helmet');s.beginTemporaryCastleVisit(s.player);
 s.armor.head.typeId='zombiegear:zombie_helmet_c1';s.inventory[1]=item('minecraft:diamond');s.player.dimension.id='infinite_castle:dungeon';
 s.installTemporaryCastleDeathReturn(p=>p.dimension.id='minecraft:overworld');s.callbacks.die({deadEntity:s.player});s.callbacks.spawn({player:s.player});s.jobs.splice(0).forEach(f=>f());
 assert.equal(s.inventory[1],undefined);assert.equal(s.armor.head.typeId,'zombiegear:zombie_helmet_c1');assert.deepEqual(s.armor.head.lore,['original lore']);assert.equal(s.armor.head.keepOnDeath,false);
});
test('existing castle visitors without provenance retain unknown items on migration',()=>{
 const s=setup();s.inventory[0]=item('minecraft:diamond');s.player.dimension.id='infinite_castle:dungeon';s.installTemporaryCastleDeathReturn(p=>p.dimension.id='minecraft:overworld');
 s.callbacks.die({deadEntity:s.player});s.callbacks.spawn({player:s.player});s.jobs.splice(0).forEach(f=>f());assert.equal(s.inventory[0].typeId,'minecraft:diamond');
});
test('teleport failure preserves provenance for a later recovery retry',()=>{
 const s=setup();s.inventory[0]=item('stone');s.beginTemporaryCastleVisit(s.player);s.player.dimension.id='infinite_castle:dungeon';s.installTemporaryCastleDeathReturn(()=>{throw Error('teleport');});
 s.callbacks.die({deadEntity:s.player});s.callbacks.spawn({player:s.player});s.jobs.splice(0).forEach(f=>f());assert.equal(s.props.get('infinite_castle:temporary_death_pending_v1'),true);assert.ok(s.props.get('infinite_castle:temporary_carry_session_v1'));assert.equal(s.inventory[0].keepOnDeath,true);
});
console.log(`${n} temporary castle policy tests passed`);
