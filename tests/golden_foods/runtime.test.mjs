import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { chooseEffect, consumeFood, applyOneShot, effectLines } from "../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/core.js";
import { FOODS } from "../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/data.js";
import { CAPABILITIES } from "../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/capabilities.js";

function player(effects={}) {
  const values = new Map(Object.entries(effects)), calls=[];
  return {typeId:"minecraft:player", values, calls,
    getEffect(id) { return values.get(id); },
    addEffect(id,duration,options) { values.set(id,{duration,amplifier:options.amplifier}); calls.push(["add",id,duration,options.amplifier]); },
    removeEffect(id) { calls.push(["remove",id]); return values.delete(id); },
    extinguishFire() { calls.push(["extinguish"]); },
    sendMessage() { throw new Error("Food must not notify"); }
  };
}
const incoming = {id:"speed",amplifier:1,seconds:180};
test("seconds converted once and level II remains amplifier 1",()=>{
  assert.deepEqual(chooseEffect(undefined,incoming),{id:"speed",amplifier:1,ticks:3600});
});
test("weaker food cannot weaken or extend a stronger external effect",()=>{
  assert.equal(chooseEffect({amplifier:2,duration:10},incoming),null);
});
test("same level refresh uses max remaining/new, never sum",()=>{
  assert.equal(chooseEffect({amplifier:1,duration:4000},incoming),null);
  assert.equal(chooseEffect({amplifier:1,duration:100},incoming).ticks,3600);
});
test("new stronger food does not inherit lower-tier long duration",()=>{
  assert.equal(chooseEffect({amplifier:0,duration:9000},incoming).ticks,3600);
});
test("infinite same-level effect is not shortened",()=>{
  for(const duration of [-1,Infinity]) assert.equal(chooseEffect({amplifier:1,duration},incoming),null);
});
test("invalid settings cannot emit invalid addEffect calls",()=>{
  for(const seconds of [NaN,Infinity,-2,0,1000001]) assert.equal(chooseEffect(undefined,{...incoming,seconds}),null);
});
test("different foods coexist without amplifier sum or global cooldown",()=>{
  const p=player();
  consumeFood({source:p,itemStack:{typeId:"pinene:enchanted_golden_beetroot"}});
  consumeFood({source:p,itemStack:{typeId:"a:egbread"}});
  consumeFood({source:p,itemStack:{typeId:"pinene:enchanted_glistering_melon_slice"}});
  assert.equal(p.values.get("speed").amplifier,1);
  assert.equal(p.values.get("speed").duration,4800);
  assert.equal(p.values.get("regeneration").amplifier,1);
  assert.equal(p.values.get("regeneration").duration,600);
  assert.equal(p.values.get("fire_resistance").duration,6000);
});
test("unknown items and nonfood wheat never apply buffs",()=>{
  const p=player();
  for(const id of ["minecraft:golden_apple","minecraft:glistering_melon_slice","a:gwheat","a:egwheat","pinene:golden_food_guide"]) {
    assert.equal(consumeFood({source:p,itemStack:{typeId:id}}),false);
  }
  assert.deepEqual(p.calls,[]);
});
test("one completed meal applies each basic effect once without inventory writes",()=>{
  const p=player();assert.equal(consumeFood({source:p,itemStack:{typeId:"a:gbread"}}),true);
  assert.equal(p.calls.length,3);
});
test("declared debuff counters are enabled while unrelated capabilities remain gated",()=>{
  assert.equal(CAPABILITIES.cleanse_on_consume,true);
  assert.equal(CAPABILITIES.prevent_effects,true);
  assert.equal(CAPABILITIES.extinguish_on_consume,false);
  const p=player({poison:{duration:100,amplifier:0}});
  consumeFood({source:p,itemStack:{typeId:"pinene:enchanted_golden_poisonous_potato"}});
  assert.equal(p.values.has('poison'),false);
  assert.ok(effectLines(FOODS["pinene:enchanted_golden_poisonous_potato"]).includes('食後に対象の状態異常を解除'));
});
test("UI uses data seconds; night vision eight minutes is level I",()=>{
  assert.equal(effectLines(FOODS["pinene:enchanted_golden_carrot"])[0],"暗視 I：480秒");
});
test("gated cleanse prototype only removes allowlisted effects",()=>{
  const p=player({poison:{duration:100,amplifier:0},bad_omen:{duration:100,amplifier:0}});
  applyOneShot(p,{key:"cleanse_on_consume",effect_ids:["poison","bad_omen"]},{cleanse_on_consume:true},assert.fail);
  assert.ok(!p.values.has("poison"));assert.ok(p.values.has("bad_omen"));
});
test("gated one-shot shortening keeps amplifier and shortens once",()=>{
  const p=player({poison:{duration:100,amplifier:2},wither:{duration:-1,amplifier:0},hunger:{duration:80,amplifier:0}});
  applyOneShot(p,{key:"reduce_existing_effect_duration_once",ratio:.25,effect_ids:["poison","wither","hunger","bad_omen"]},{reduce_existing_effect_duration_once:true},assert.fail);
  assert.deepEqual(p.values.get("poison"),{duration:75,amplifier:2});
  assert.equal(p.values.get("wither").duration,-1);assert.equal(p.values.get("hunger").duration,60);
});
test("invalidating native Effect handle is not read after removal",()=>{
  let removed=false;
  const p={getEffect:()=>({get duration(){if(removed)throw Error("invalid");return 100;},amplifier:1}),
    removeEffect:()=>{removed=true;return true;},addEffect:()=>{}};
  applyOneShot(p,{key:"reduce_existing_effect_duration_once",ratio:.25,effect_ids:["poison"]},{reduce_existing_effect_duration_once:true},assert.fail);
});
test("failed gated shortening restores the captured duration",()=>{
  let adds=0;const p=player({poison:{duration:100,amplifier:1}}), errors=[];
  const add=p.addEffect.bind(p);p.addEffect=(...args)=>{if(++adds===1)throw Error("native failure");add(...args);};
  applyOneShot(p,{key:"reduce_existing_effect_duration_once",ratio:.25,effect_ids:["poison"]},{reduce_existing_effect_duration_once:true},e=>errors.push(e));
  assert.equal(p.values.get("poison").duration,100);assert.equal(errors.length,1);
});
test("registration has one onConsume callback; only guide onUse opens UI",()=>{
  const path=new URL("../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/main.js",import.meta.url);
  const code=readFileSync(path,"utf8").replace(/^import .*;$/gm,"");
  const components=new Map();let consumes=0, guides=0;
  const system={beforeEvents:{startup:{subscribe(cb){cb({itemComponentRegistry:{registerCustomComponent:(id,c)=>components.set(id,c)}});}}},run:cb=>cb()};
  const world={beforeEvents:{effectAdd:{subscribe(){}}},afterEvents:{playerLeave:{subscribe(){}}}};
  runInNewContext(code,{system,world,useExtension:()=>{},consumeFood:()=>consumes++,showGuide:()=>guides++,console});
  const food=components.get("pinene:golden_food_consume"),guide=components.get("pinene:golden_food_guide");
  assert.deepEqual(Object.keys(food),["onConsume"]);assert.equal(consumes,0);
  food.onConsume({});assert.equal(consumes,1);assert.equal(guides,0);
  guide.onUse({source:player()});assert.equal(guides,1);assert.equal(consumes,1);
});

