import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const root=new URL('../../',import.meta.url);
const staged='docs/golden_foods/legacy_food_stage/bp/';
const read=p=>readFileSync(new URL(p,root),'utf8');
const data=JSON.parse(read(staged+'scripts/golden_foods/data.js').split(' = ')[1].trim().replace(/;$/,''));
const science=JSON.parse(read(staged+'scripts/golden_foods/science_ja.js').split(' = ')[1].trim().replace(/;$/,''));
const code=read('behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/core.js').replace(/^import .*;$/gm,'').replaceAll('export function','function');
const context={FOODS:data,CAPABILITIES:{}};runInNewContext(code,context);
test('legacy consumables have Japanese names, one effect owner, native container return and matching guide nutrition',()=>{
 for(const id of ['astew','gstew','estew','gmbucket','egmbucket']){
  const c=JSON.parse(read(staged+`items/${id}.json`))['minecraft:item'].components;
  const d=data['a:'+id];assert.equal(c['minecraft:display_name'].value,d.name);assert.match(d.name,/[ぁ-んァ-ヶ一-龯]/);
  assert.ok(c['pinene:golden_food_consume']);assert.equal(c['minecraft:food'].effects,undefined);
  assert.equal(c['minecraft:food'].nutrition,d.food.nutrition);
  assert.equal(c['minecraft:food'].using_converts_to,id.includes('bucket')?'minecraft:bucket':'minecraft:bowl');
  assert.ok(science.families[d.family].design);assert.ok(science.families[d.family].sources.length);
 }
});
test('milk and stew consume once, have no regeneration V, do not clear other buffs or touch inventory',()=>{
 for(const id of ['astew','gstew','estew','gmbucket','egmbucket']){
  const calls=[];const p={typeId:'minecraft:player',getEffect:()=>undefined,addEffect:(...a)=>calls.push(a)};
  assert.equal(context.consumeFood({source:p,itemStack:{typeId:'a:'+id}}),true);
  assert.equal(calls.length,data['a:'+id].effects.length);
  assert.ok(calls.every(c=>c[2].amplifier<=1));
  for(let i=0;i<calls.length;i++)assert.equal(calls[i][1],data['a:'+id].effects[i].seconds*20);
 }
});
test('all 19 golden guide detail screens render names, chemistry, design rationale and real effect values',async()=>{
 const guide=read(staged+'scripts/golden_foods/guide.js').replace(/^import .*;$/gm,'').replace('export async function','async function');
 const listed=Object.entries(data).filter(([id])=>id!=="a:astew").map(([,food])=>food);
 for(let selected=0;selected<listed.length;selected++){
  const forms=[];
  class Form{constructor(){forms.push(this);this.buttons=[];}title(v){this.heading=v;return this;}body(v){this.text=v;return this;}button(...v){this.buttons.push(v);return this;}async show(){return forms.length===1?{canceled:false,selection:selected}:{canceled:true};}}
  const ctx={FOODS:data,SCIENCE:science,effectLines:context.effectLines,ActionFormData:Form};runInNewContext(guide,ctx);
  await ctx.showGuide({id:'test',isValid:true},assert.fail);
  assert.equal(forms[0].buttons.length,19);assert.equal(forms.length,2);
  const food=listed[selected];assert.equal(forms[1].heading,food.name);assert.ok(forms[1].text.includes(science.families[food.family].body));
  if(science.families[food.family].design)assert.ok(forms[1].text.includes(science.families[food.family].design));
  for(const effect of food.effects)assert.ok(forms[1].text.includes(`${effect.seconds}秒`));
 }
});
