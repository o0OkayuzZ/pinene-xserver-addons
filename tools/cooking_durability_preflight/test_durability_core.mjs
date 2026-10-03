import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {planKnifeWear as plan, nativeIntegrationGate as gate,
  NATIVE_GATE_REQUIREMENTS as requirements, describeCraftOutput as describe} from './durability_core.mjs';
const defaults = {maxDurability:96,damage:0,requestedOperations:1,resultCount:1,
  unit:'recipe_execution',mode:'exact'};
const p = changes => plan({...defaults,...changes});
for (const [material,max] of Object.entries({copper:96,iron:128,gold:64,diamond:512,netherite:640})) {
  test(`${material}: last permitted operation consumes the exact remaining durability`,()=>{
    const r=p({maxDurability:max,damage:max-1});assert.equal(r.nextDamage,max);
    assert.equal(r.cost,1);assert.equal(r.breaks,true);assert.equal(r.producedItems,1);
  });
  test(`${material}: exhausted knife authorizes zero output`,()=>{
    const r=p({maxDurability:max,damage:max});assert.equal(r.acceptedOperations,0);
    assert.equal(r.cost,0);assert.equal(r.breaks,false);
  });
}
test('normal recipe action costs one under explicit action policy',()=>assert.equal(p({}).cost,1));
test('two-item result is one operation under action policy',()=>{
  const r=p({resultCount:2});assert.equal(r.cost,1);assert.equal(r.producedItems,2);
});
test('four cheese pieces are one operation under action policy',()=>assert.equal(p({resultCount:4}).cost,1));
test('sixteen butter pieces are one operation under action policy',()=>assert.equal(p({resultCount:16}).cost,1));
test('legacy output-based alternative stays explicit, not automatic',()=>assert.equal(p({resultCount:4,unit:'output_item'}).cost,4));
test('a fifty-operation batch is fifty, not one',()=>assert.equal(p({requestedOperations:50,resultCount:2}).cost,50));
test('exact mode rejects oversized batch without changing damage',()=>{
  const r=p({damage:95,requestedOperations:20});assert.equal(r.cost,0);assert.equal(r.nextDamage,95);assert.equal(r.producedItems,0);
});
test('up-to mode caps oversized batch before authorizing it',()=>{
  const r=p({damage:94,requestedOperations:20});assert.equal(r.acceptedOperations,0);
  const s=p({damage:94,requestedOperations:20,mode:'up_to',resultCount:4});
  assert.equal(s.acceptedOperations,2);assert.equal(s.producedItems,8);assert.equal(s.cost,2);assert.equal(s.breaks,true);
});
test('output policy cannot make one four-output batch with only three points',()=>assert.equal(p({damage:93,resultCount:4,unit:'output_item',mode:'up_to'}).acceptedOperations,0));
test('zero request does not break an already depleted knife again',()=>assert.equal(p({damage:96,requestedOperations:0}).breaks,false));
test('does not mutate caller input',()=>{
  const v=Object.freeze({...defaults});plan(v);assert.deepEqual(v,defaults);
});
test('plan is immutable',()=>assert.equal(Object.isFrozen(p({})),true));
for (const [field,value] of [['damage',-1],['damage',97],['damage',1.2],['damage',NaN],
  ['damage',Infinity],['maxDurability',0],['maxDurability',1.2],['requestedOperations',-1],
  ['requestedOperations',65537],['requestedOperations',2.2],['resultCount',0],['resultCount',65]]) {
  test(`invalid ${field}=${value} is rejected`,()=>assert.throws(()=>p({[field]:value})));
}
test('billing unit is mandatory',()=>assert.throws(()=>p({unit:undefined})));
test('batch mode is mandatory',()=>assert.throws(()=>p({mode:undefined})));
test('null input is rejected',()=>assert.throws(()=>plan(null)));
test('no evidence disables integration',()=>assert.equal(gate(undefined).allowed,false));
test('after-event availability alone never enables charging',()=>assert.equal(gate({afterEventAvailable:true}).allowed,false));
for (const missing of requirements) {
  test(`missing ${missing} disables integration`,()=>{
    const e=Object.fromEntries(requirements.map(k=>[k,true]));delete e[missing];assert.equal(gate(e).allowed,false);
  });
}
test('nonboolean truthy values are not evidence',()=>assert.equal(gate(Object.fromEntries(requirements.map(k=>[k,'verified']))).allowed,false));
test('complete hypothetical evidence opens the pure gate, not a game hook',()=>assert.equal(gate(Object.fromEntries(requirements.map(k=>[k,true]))).allowed,true));
const recipes=[{id:'pine:cheese',resultCount:4},{id:'pine:honey_bread',resultCount:1}];
test('return bottles are ignored rather than double billed',()=>assert.equal(describe({typeId:'minecraft:glass_bottle',amount:1},recipes).kind,'untracked_output'));
test('return buckets are ignored rather than double billed',()=>assert.equal(describe({typeId:'minecraft:bucket',amount:1},recipes).kind,'untracked_output'));
test('output candidate is never permission to consume a knife',()=>{
  const r=describe({typeId:'pine:cheese',amount:8},recipes);assert.equal(r.candidateOperations,2);assert.equal(r.chargeAllowed,false);
});
test('ambiguous recipe result is rejected',()=>assert.equal(describe({typeId:'pine:cheese',amount:4},[...recipes,{id:'pine:cheese',resultCount:2}]).kind,'ambiguous_output'));
test('partial stack is not guessed as one operation',()=>assert.equal(describe({typeId:'pine:cheese',amount:3},recipes).kind,'nonintegral_batch'));
test('absent event output never causes debit',()=>assert.equal(describe(undefined,recipes).chargeAllowed,false));
test('pure module has no game imports, hooks, or world mutations',()=>{
  const s=fs.readFileSync(new URL('./durability_core.mjs',import.meta.url),'utf8');
  for(const forbidden of ['@minecraft/server','setItem(','.damage =','runInterval(','.show(','.subscribe(']) assert(!s.includes(forbidden),forbidden);
});
test('property sweep never authorizes negative durability or partial output batches',()=>{
  for(const max of [64,96,128,512,640])for(let damage=0;damage<=max;damage++)for(const resultCount of [1,2,4,8,16]) {
    const r=p({maxDurability:max,damage,resultCount,requestedOperations:64,mode:'up_to'});
    assert(r.nextDamage<=max);assert(r.remainingAfter>=0);assert.equal(r.cost,r.acceptedOperations);
    assert.equal(r.producedItems,r.acceptedOperations*resultCount);
  }
});
