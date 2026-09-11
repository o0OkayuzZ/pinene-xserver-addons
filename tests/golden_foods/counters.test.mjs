import test from 'node:test';
import assert from 'node:assert/strict';
import {activateFoodCounters,counterState,incomingEffectDecision} from '../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/counterEffects.js';
import {consumeFood} from '../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/core.js';
function player(){const props=new Map(),effects=new Map();return{typeId:'minecraft:player',effects,getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),getEffect:k=>effects.get(k),removeEffect:k=>effects.delete(k),addEffect:(k,d,o)=>effects.set(k,{duration:d,...o})};}
test('carrot cleans blindness/darkness and prevents only the declared effects for 480s',()=>{
    const p=player();for(const id of ['blindness','darkness','poison'])p.effects.set(id,{duration:100,amplifier:0});
    consumeFood({source:p,itemStack:{typeId:'pinene:enchanted_golden_carrot'}});assert.ok(!p.effects.has('blindness')&&!p.effects.has('darkness'));assert.ok(p.effects.has('poison'));
    activateFoodCounters(p,'pinene:enchanted_golden_carrot',100);const s=counterState(p);
    for(const id of ['blindness','darkness'])assert.equal(incomingEffectDecision(s,id,80,101).cancel,true);
    assert.equal(incomingEffectDecision(s,'poison',80,101).cancel,false);assert.equal(incomingEffectDecision(s,'darkness',80,9700).cancel,false);
});
test('potato prevents poison, halves incoming hunger/nausea, survives serialization',()=>{
    const p=player();activateFoodCounters(p,'pinene:golden_poisonous_potato',0);const s=JSON.parse(JSON.stringify(counterState(p)));
    assert.equal(incomingEffectDecision(s,'poison',120,1).cancel,true);assert.equal(incomingEffectDecision(s,'hunger',240,1).duration,120);assert.equal(incomingEffectDecision(s,'blindness',60,1).duration,60);
});
test('poison conversion obeys cooldown and does not invent immunity to hunger',()=>{
    const p=player();activateFoodCounters(p,'pinene:enchanted_golden_poisonous_potato',0);const s=counterState(p);
    assert.ok(incomingEffectDecision(s,'poison',120,1).convert);s.nextPoisonProc=201;assert.equal(incomingEffectDecision(s,'poison',120,100).convert,null);assert.ok(incomingEffectDecision(s,'poison',120,201).convert);
    assert.equal(incomingEffectDecision(s,'hunger',200,1).cancel,false);
});
test('non-counter food adds no feature',()=>{const p=player();assert.equal(activateFoodCounters(p,'a:gbread',0),false);});
