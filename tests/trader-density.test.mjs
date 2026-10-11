import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const code = readFileSync(new URL('../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/trader_density_policy.js', import.meta.url),'utf8');
const {rejectNaturalTraderDuplicate,TRADER_RADIUS} = await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
function trader(id,list,extra={}) { return {id,typeId:'minecraft:wandering_trader',nameTag:'',getProperty(){return true},location:{x:0,y:64,z:0},removed:false,dimension:{getEntities(query){if(query.type==='minecraft:trader_llama')return [];assert.equal(query.maxDistance,TRADER_RADIUS);return list.filter(e=>!e.removed)}},remove(){this.removed=true},...extra}; }
test('new natural duplicate is rejected while the existing trader stays',()=>{const list=[];const a=trader('existing',list),b=trader('new',list);list.push(a,b);assert.equal(rejectNaturalTraderDuplicate(b,'Spawned'),true);assert.equal(a.removed,false);});
test('first trader remains',()=>{const list=[];const a=trader('first',list);list.push(a);assert.equal(rejectNaturalTraderDuplicate(a,'Spawned'),false);});
test('simultaneous arrivals leave one trader, never zero',()=>{const list=[];for(let i=0;i<12;i++)list.push(trader(String(i),list));for(const e of list)rejectNaturalTraderDuplicate(e,'Spawned');assert.equal(list.filter(e=>!e.removed).length,1);});
test('loaded, command/event, named, and custom traders stay',()=>{for(const extra of [{cause:'Loaded'},{cause:'Event'},{cause:'Born'},{getProperty(){return false}},{nameTag:'NPC'},{typeId:'pinematerials:rare_material_trader'}]){const list=[];const a=trader('existing',list),b=trader('new',list,extra);list.push(a,b);assert.equal(rejectNaturalTraderDuplicate(b,extra.cause??'Spawned'),false);assert.equal(b.removed,false)}});

test('only untouched companions linked to the rejected trader are removed',()=>{
 const list=[];const existing=trader('existing',list),fresh=trader('fresh',list);list.push(existing,fresh);
 function llama(id,holder,extra={}){return {id,nameTag:'',removed:false,getComponent(name){if(name==='minecraft:leashable')return {leashHolderEntityId:'minecraft:wandering_trader',leashHolder:{id:holder}};if(name==='minecraft:is_tamed')return {tamedToPlayerId:extra.tamed?'player':undefined}},remove(){this.removed=true},...extra}}
 const own=llama('own','fresh'),kept=llama('old','existing'),named=llama('named','fresh',{nameTag:'pet'}),tamed=llama('tamed','fresh',{tamed:true}),player=llama('player','player');
 const companions=[own,kept,named,tamed,player];const original=fresh.dimension.getEntities;fresh.dimension.getEntities=q=>q.type==='minecraft:trader_llama'?companions:original(q);
 assert.equal(rejectNaturalTraderDuplicate(fresh,'Spawned'),true);assert.equal(own.removed,true);for(const e of [kept,named,tamed,player])assert.equal(e.removed,false);
});
