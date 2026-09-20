import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
const file=fileURLToPath(new URL('../behavior_packs/bp_06_8aa58918-0a45-44ac-8d7a-dc5c1be8ef8a/scripts/deathPolicy.js', import.meta.url));
const {shouldCreateTomb,clearDeathMarkers}=await import('data:text/javascript;base64,'+readFileSync(file).toString('base64'));
const slots={Head:'head',Chest:'chest',Legs:'legs',Feet:'feet',Offhand:'offhand'};
function player({tags=[],items=[],equipment={},dimension='minecraft:overworld',available=true}={}) {
 const state=new Set(tags);
 return {dimension:{id:dimension},hasTag:t=>state.has(t),getTags:()=>[...state],removeTag:t=>state.delete(t),
 getComponent:id=>!available?undefined:id==='minecraft:inventory'?{container:{size:36,getItem:i=>items[i]}}:{getEquipment:s=>equipment[s]}};
}
test('current inventory overrides stale empty tag',()=>assert.equal(shouldCreateTomb(player({tags:['empty'],items:[{typeId:'minecraft:stone'}]}),false,slots),'create'));
test('boots alone produce a tomb',()=>assert.equal(shouldCreateTomb(player({tags:['empty'],equipment:{feet:{}}}),false,slots),'create'));
test('fallback recognizes the actual boots tag',()=>assert.equal(shouldCreateTomb(player({tags:['empty','getFeet'],available:false}),false,slots),'create'));
test('empty inventory policy remains configurable',()=>{assert.equal(shouldCreateTomb(player(),false,slots),'empty');assert.equal(shouldCreateTomb(player(),true,slots),'create');});
test('castle policy preserved even when empty graves enabled',()=>assert.equal(shouldCreateTomb(player({dimension:'infinite_castle:dungeon',items:[{}]}),true,slots),'castle'));
test('duplicate death stays blocked',()=>assert.equal(shouldCreateTomb(player({tags:['dead'],items:[{}]}),true,slots),'already-processed'));
test('respawn clears incomplete death record, preserving unrelated tags',()=>{const p=player({tags:['dead','dim:minecraft:overworld','keep-me'],items:[{}]});clearDeathMarkers(p);assert.deepEqual(p.getTags(),['keep-me']);assert.equal(shouldCreateTomb(p,false,slots),'create');});
test('respawn clears all old coordinate records',()=>{const p=player({tags:['dead','cords:1 2 3','cords:4 5 6','dim:minecraft:overworld']});clearDeathMarkers(p);assert.deepEqual(p.getTags(),[]);});
