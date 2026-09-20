import {test} from 'node:test';
import assert from 'node:assert/strict';
import {CardRegistry} from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/CardRegistry.js';
import {DeckManager} from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/deck/DeckManager.js';
import {KEYS} from '../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/gf/core/Persistence.js';
function fixture(dimension='pinene_pvp:pvp_island') {
 const values=new Map();const player={id:'test',dimension:{id:dimension},getDynamicProperty:k=>values.get(k),setDynamicProperty:(k,v)=>values.set(k,v)};
 const registry=new CardRegistry();const decks=new DeckManager(registry,undefined,()=>0.3);
 const cards=registry.all().flatMap(c=>[c,c,c]).slice(0,16);
 const config={randomDeck:cards.map((c,i)=>({copyId:`copy_${i}`,cardId:c.id})),fixedAttack:[],autoDefense:[],settings:{defensePriority:'manual_first'}};
 return {player,values,decks,config};
}
test('normal world keeps configuration without starting combat or writing a battle',()=>{
 const {player,values,decks,config}=fixture('minecraft:overworld');decks.saveConfiguration(player,config);
 assert.equal(decks.load(player).active,false);assert.equal(values.has(KEYS.battle),false);
 assert.throws(()=>decks.use(player,0,()=>{}));assert.equal(values.has(KEYS.battle),false);
});
test('repeated use and reshuffles preserve all sixteen card copies',()=>{
 const {player,decks,config}=fixture();decks.saveConfiguration(player,config);
 for(let i=0;i<40;i++)decks.use(player,i%5,()=>{});
 const b=decks.load(player).battle;const ids=[...b.hand,...b.drawPile,...b.discardPile];
 assert.equal(b.hand.length,5);assert.equal(ids.length,16);assert.equal(new Set(ids).size,16);assert.equal(b.resolving,null);
});
test('failed synchronous effect releases the lock and preserves card ownership',()=>{
 const {player,decks,config}=fixture();decks.saveConfiguration(player,config);
 assert.throws(()=>decks.use(player,0,()=>{throw Error('effect failed');}),/effect failed/);
 assert.equal(decks.busy.size,0);assert.equal(decks.load(player).battle.resolving,null);decks.use(player,1,()=>{});
});
test('corrupt ownership data is not silently overwritten',()=>{
 const {player,values,decks}=fixture();values.set(KEYS.configuration,'broken saved data');
 assert.throws(()=>decks.load(player));assert.equal(values.get(KEYS.configuration),'broken saved data');assert.equal(values.has(KEYS.battle),false);
});
