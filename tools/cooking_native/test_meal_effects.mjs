import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { applyMealEffects, MEAL_COOLDOWN_KEY } from '../../behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5/scripts/meal_effects.js';
import { MEALS } from '../../behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5/scripts/meal_catalog.generated.js';
const meal={effects:[{id:'speed',seconds:30,amplifier:0}],cooldownSeconds:30};
function player(){
  const properties=new Map(),effects=new Map(),calls=[];
  return {typeId:'minecraft:player',isValid:true,properties,effects,calls,
    getDynamicProperty:k=>properties.get(k),setDynamicProperty:(k,v)=>properties.set(k,v),
    getEffect:k=>effects.get(k),addEffect:(id,duration,options)=>{calls.push({id,duration,options});effects.set(id,{duration,amplifier:options.amplifier});}};
}
test('effects are granted for all 100 catalog meals with exact configured tick durations',()=>{
  assert.equal(Object.keys(MEALS).length,100);
  for(const data of Object.values(MEALS)){
    const p=player(),r=applyMealEffects(p,data,1000);
    assert.equal(r.status,data.effects.length?'applied':'food_only');
    assert.equal(p.calls.length,data.effects.length);
    for(let i=0;i<data.effects.length;i++)assert.deepEqual(p.calls[i],{
      id:'minecraft:'+data.effects[i].id,duration:data.effects[i].seconds*20,options:{amplifier:0,showParticles:false}});
  }
});
test('different meals share the cooldown and duplicate callbacks do not reapply',()=>{
  const p=player();applyMealEffects(p,meal,1000);
  const second={effects:[{id:'regeneration',seconds:4,amplifier:0}],cooldownSeconds:30};
  assert.equal(applyMealEffects(p,second,1001).status,'cooldown');
  assert.equal(p.calls.length,1);
});
test('cooldown ends at exactly 30 seconds without additive duration stacking',()=>{
  const p=player();applyMealEffects(p,meal,1000);p.effects.clear();
  assert.equal(applyMealEffects(p,meal,30999).status,'cooldown');
  assert.equal(applyMealEffects(p,meal,31000).status,'applied');
  assert.equal(p.calls.at(-1).duration,600);
});
test('stronger potion effects, longer equal effects and infinite effects are preserved',()=>{
  for(const current of [{amplifier:1,duration:10},{amplifier:0,duration:1000},{amplifier:0,duration:-1}]){
    const p=player();p.effects.set('minecraft:speed',current);
    assert.equal(applyMealEffects(p,meal,1000).status,'preserved');
    assert.equal(p.calls.length,0);assert.equal(p.properties.size,0);
  }
});
test('a shorter equal-strength effect is refreshed, never added to the old duration',()=>{
  const p=player();p.effects.set('minecraft:speed',{amplifier:0,duration:60});
  applyMealEffects(p,meal,1000);assert.equal(p.calls[0].duration,600);
});
test('cooldown belongs to each player and survives a reconnect via dynamic property',()=>{
  const first=player(),other=player();applyMealEffects(first,meal,1000);
  assert.equal(applyMealEffects(other,meal,1001).status,'applied');
  const reconnect=player();reconnect.properties.set(MEAL_COOLDOWN_KEY,first.properties.get(MEAL_COOLDOWN_KEY));
  assert.equal(applyMealEffects(reconnect,meal,1001).status,'cooldown');
});
test('food-only meals do not consume or extend an effect cooldown',()=>{
  const p=player();applyMealEffects(p,{effects:[],cooldownSeconds:0},1000);assert.equal(p.properties.size,0);
});
test('foreign entities, missing dishes and invalid players are ignored',()=>{
  for(const p of [undefined,{typeId:'minecraft:cow'},{...player(),isValid:false}])assert.equal(applyMealEffects(p,meal).status,'ignored');
  assert.equal(applyMealEffects(player(),undefined).status,'ignored');
});
test('a failed effect does not claim successful application or bill a cooldown',()=>{
  const p=player();p.addEffect=()=>{throw Error('simulated API failure');};
  const result=applyMealEffects(p,meal,1000);assert.equal(result.status,'failed');assert.equal(p.properties.size,0);
});
test('custom component is registered at startup and grants effects only on actual consumption',()=>{
  const code=fs.readFileSync(new URL('../../behavior_packs/bp_18_7e540260-69ce-4a82-951d-bc793e151cd5/scripts/meal_component.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'');
  let startup,component;const p=player();
  vm.runInNewContext(code,{system:{beforeEvents:{startup:{subscribe:f=>startup=f}}},MEALS,applyMealEffects,console});
  startup({itemComponentRegistry:{registerCustomComponent:(id,definition)=>{assert.equal(id,'pine:meal_effects');component=definition;}}});
  assert.equal(p.calls.length,0);assert.deepEqual(Object.keys(component),['onConsume']);
  component.onConsume({source:p,itemStack:{typeId:'pine:honey_bread'}});assert.equal(p.calls.length,1);
});
