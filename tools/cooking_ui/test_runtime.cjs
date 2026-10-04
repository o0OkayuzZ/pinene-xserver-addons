const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const root = path.resolve(__dirname, '../..');
const bp = path.join(root, 'behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4');
const source = name => fs.readFileSync(path.join(bp, 'scripts', name), 'utf8')
  .replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
const maxima = {};
for (const name of fs.readdirSync(path.join(bp, 'items'))) {
  const item = JSON.parse(fs.readFileSync(path.join(bp, 'items', name)))['minecraft:item'];
  maxima[item.description.identifier] = item.components['minecraft:durability']?.max_durability;
}
function env() {
  class ItemStack {
    constructor(typeId, amount = 1) { this.typeId = typeId; this.amount = amount; this.maxAmount = maxima[typeId] ? 1 : 64; this.damage = 0; }
    clone() { return Object.assign(new ItemStack(this.typeId, this.amount), this); }
    isStackableWith(other) { return this.typeId === other.typeId && this.damage === other.damage; }
    getComponent(id) {
      if (id !== 'minecraft:durability' || !maxima[this.typeId]) return;
      const self = this;
      return { maxDurability: maxima[this.typeId], get damage() { return self.damage; }, set damage(v) {
        assert.ok(Number.isInteger(v) && v >= 0 && v <= maxima[self.typeId]); self.damage = v;
      }};
    }
  }
  const slots = Array(36);
  const container = { size: 36, getItem: i => slots[i]?.clone(), setItem: (i,v) => { slots[i] = v?.clone(); }, addItem(value) {
    const stack = value.clone();
    for (const v of slots) if (v?.isStackableWith(stack)) { const n = Math.min(v.maxAmount-v.amount, stack.amount); v.amount+=n; stack.amount-=n; }
    for (let i=0;i<slots.length && stack.amount;i++) if (!slots[i]) { const n=Math.min(stack.maxAmount,stack.amount);slots[i]=stack.clone();slots[i].amount=n;stack.amount-=n; }
    return stack.amount ? stack : undefined;
  }};
  const queue = [], intervals = new Map(), handlers = {}, forms = [], drops = [], messages = [];
  let serial = 0;
  const event = name => ({subscribe(fn) { handlers[name] = fn; }});
  const system = { run(fn) { queue.push(fn); return ++serial; }, runInterval(fn) { const id=++serial;intervals.set(id,fn);return id; }, clearRun(id) {intervals.delete(id);}, afterEvents: {scriptEventReceive:event('script')} };
  const world = {beforeEvents:{playerInteractWithBlock:event('interact')},afterEvents:{playerBreakBlock:event('break'),playerLeave:event('leave')},getAllPlayers:()=>[player]};
  const entities = [];
  const permutation = { knife: 'empty', getState(k) { return k === 'pinene_cooking:knife' ? this.knife : 'south'; },withState(k,v) {return {...this,knife:v};} };
  const block = { typeId:'pinene_cooking:oak_cutting_board',location:{x:0,y:0,z:0},permutation,setPermutation(p) {this.permutation=p;} };
  const dimension = {id:'minecraft:overworld',getBlock:()=>block,getEntities:()=>entities.filter(x=>x.isValid),spawnItem(s) {drops.push(s.clone());},spawnEntity(typeId,location) {
    const props=new Map();const entity={typeId,location,isValid:true,dimension, getDynamicProperty:k=>props.get(k),setDynamicProperty:(k,v)=>props.set(k,v),setRotation(){},remove(){this.isValid=false;}};
    entities.push(entity);return entity;
  }};
  block.dimension=dimension;
  const tags=new Set();
  const player={id:'p1',typeId:'minecraft:player',isValid:true,dimension,location:{x:.5,y:1,z:.5},selectedSlotIndex:0,
    getComponent:id=>id==='minecraft:inventory'?{container}:id==='minecraft:health'?{currentValue:20}:undefined,
    sendMessage:m=>messages.push(m),hasTag:t=>tags.has(t),addTag:t=>tags.add(t),removeTag:t=>tags.delete(t)};
  class Observable {
    constructor(value) {this.value=value;this.listeners=new Set();}
    getData(){return this.value;}
    setData(v){this.value=v;for(const fn of this.listeners)fn(v);}
    subscribe(fn){this.listeners.add(fn);return fn;}
    unsubscribe(fn){this.listeners.delete(fn);}
  }
  class CustomForm {
    constructor(p,title){this.player=p;this.title=title;this.fields=[];this.buttons=[];this.shows=0;forms.push(this);}
    dropdown(label,value,items,options){this.fields.push({label,value,items,options});return this;}
    header(){return this;} label(){return this;} image(){return this;}
    button(label,fn,options){this.buttons.push({label,fn,options});return this;}
    closeButton(){return this;}
    isShowing(){return !!this.showing;}
    show(){this.shows++;this.showing=true;return new Promise(resolve=>{this.finish=resolve;});}
    close(){this.showing=false;this.finish?.('closed');}
  }
  const customFormApi = {CustomForm,ObservableString:Observable,ObservableNumber:Observable,ObservableBoolean:Observable};
  class ActionFormData {constructor(){this.buttons=[];forms.push(this);}title(){return this;}body(){return this;}button(...args){this.buttons.push(args);return this;}async show(){return {canceled:true};}}
  const context=vm.createContext({ItemStack,system,world,ActionFormData,customFormApi,console:{warn(){},error(){}}});
  vm.runInContext(['cooking_data.js','inventory_icons.generated.js','custom_cooking_ui.js','custom_cooking_bridge.js','main.js'].map(source).join('\n')+
    '\nglobalThis.api={COOKING_RECIPES,KNIFE_MAX,KNIFE_BY_PLACED,KNIFE_RANK_LIMIT,placeKnife,retrieveKnife,knifeStack,placedDamage,damagePlacedKnife,craftCookingRecipe,canCraftRecipe,hasRoomAfterCraft,customCookingUi,openBoard};',context);
  const api=context.api;
  const drain=()=>{let n=0;while(queue.length){assert.ok(++n<100);queue.shift()();}};
  drain();
  const knife=(material='copper',damage=0)=>{const e=dimension.spawnEntity('pinene_cooking:placed_'+material+'_knife',{x:.5,y:.145,z:.5});e.setDynamicProperty('pinene_cooking:knife_damage',damage);return e;};
  const materials=recipe=>{slots.fill(undefined);recipe.ingredients.forEach((v,i)=>container.setItem(i,new ItemStack(v.id??v.ids[0],v.count)));};
  const count=id=>slots.filter(s=>s?.typeId===id).reduce((n,s)=>n+s.amount,0);
  return {api,slots,container,ItemStack,system,intervals,handlers,forms,player,block,dimension,entities,drops,messages,drain,knife,materials,count,customFormApi};
}
test('every knife durability/rank matches shipped item definitions',()=>{const e=env();for(const [id,max] of Object.entries(e.api.KNIFE_MAX))assert.equal(max,maxima[id]);});
for (const material of ['copper','iron','gold','diamond','netherite']) {
  test(`${material}: used knife placement and retrieval preserve remaining durability`,()=>{
    const e=env();const id='pinene_cooking:'+material+'_knife';const damage=maxima[id]-3;
    e.container.setItem(0,e.api.knifeStack(id,damage));assert.equal(e.api.placeKnife(e.player,e.block),true);
    const placed=e.entities[0];assert.equal(e.api.placedDamage(placed),damage);assert.equal(e.count(id),0);
    assert.equal(e.api.retrieveKnife(e.player,placed),true);assert.equal(e.slots.find(s=>s?.typeId===id).damage,damage);assert.equal(placed.isValid,false);
  });
  test(`${material}: crafting with last durability breaks once and cannot repeat`,()=>{
    const e=env();const recipe=e.api.COOKING_RECIPES.find(r=>r.id==='pine:butter');e.materials(recipe);
    const k=e.knife(material,maxima['pinene_cooking:'+material+'_knife']-1);
    assert.equal(e.api.craftCookingRecipe(e.player,k,recipe),true);assert.equal(e.count(recipe.id),recipe.resultCount);assert.equal(k.isValid,false);
    assert.equal(e.messages.filter(s=>s.includes('が壊れた')).length,1);
    const before=JSON.stringify(e.slots);assert.equal(e.api.craftCookingRecipe(e.player,k,recipe),false);assert.equal(JSON.stringify(e.slots),before);
  });
}
test('ordinary batch consumes one durability per output; failed craft consumes none',()=>{
  const e=env();const r=e.api.COOKING_RECIPES.find(r=>r.resultCount>1);e.materials(r);const k=e.knife('netherite',7);
  assert.equal(e.api.craftCookingRecipe(e.player,k,r),true);assert.equal(e.api.placedDamage(k),7+r.resultCount);
  const before=JSON.stringify(e.slots);assert.equal(e.api.craftCookingRecipe(e.player,k,r),false);assert.equal(JSON.stringify(e.slots),before);assert.equal(e.api.placedDamage(k),7+r.resultCount);
});
test('full inventory rejects craft without consuming ingredients or durability',()=>{
  const e=env();const r=e.api.COOKING_RECIPES.find(r=>r.id==='pine:butter');e.materials(r);
  for(let i=0;i<r.ingredients.length;i++)e.slots[i].amount+=r.ingredients[i].count;
  for(let i=r.ingredients.length;i<36;i++)e.slots[i]=new e.ItemStack('minecraft:stone',64);
  const before=JSON.stringify(e.slots),k=e.knife();assert.equal(e.api.craftCookingRecipe(e.player,k,r),false);assert.equal(JSON.stringify(e.slots),before);assert.equal(e.api.placedDamage(k),0);
});
test('oil accepts a mixture of allowed seeds and spends exact counts',()=>{
  const e=env(),r=e.api.COOKING_RECIPES.find(r=>r.id==='pine:cooking_oil');e.materials(r);
  const i=r.ingredients.findIndex(x=>x.ids);e.slots[i].amount=3;e.slots[10]=new e.ItemStack('minecraft:pumpkin_seeds',5);
  assert.equal(e.api.craftCookingRecipe(e.player,e.knife(),r),true);assert.equal(e.count('minecraft:wheat_seeds')+e.count('minecraft:pumpkin_seeds'),0);assert.equal(e.count(r.id),r.resultCount);
});
test('returned buckets fit in slots released by ingredients',()=>{
  const e=env(),r=e.api.COOKING_RECIPES.find(r=>r.id==='pine:butter');e.materials(r);
  assert.equal(e.api.craftCookingRecipe(e.player,e.knife(),r),true);assert.equal(e.count('minecraft:bucket'),r.ingredients.find(x=>x.id==='minecraft:milk_bucket').count);assert.equal(e.drops.length,0);
});
test('knife rank and unknown recipes cannot bypass crafting requirements',()=>{
  const e=env(),r=e.api.COOKING_RECIPES.find(r=>r.rank>2);e.materials(r);const before=JSON.stringify(e.slots);
  assert.equal(e.api.craftCookingRecipe(e.player,e.knife('copper'),r),false);assert.equal(JSON.stringify(e.slots),before);
  assert.equal(e.api.craftCookingRecipe(e.player,e.knife('netherite'),{...r}),false);
});
test('board destruction drops a used knife without repairing it',()=>{
  const e=env();e.knife('iron',71);e.handlers.break({brokenBlockPermutation:{type:{id:e.block.typeId}},block:e.block,dimension:e.dimension,player:e.player});
  assert.equal(e.slots.find(s=>s?.typeId==='pinene_cooking:iron_knife').damage,71);assert.equal(e.entities[0].isValid,false);
});
test('opt-in continuous UI: two clicks in one tick craft once; one show call',async()=>{
  const e=env(),r=e.api.COOKING_RECIPES[0];e.materials(r);e.knife('netherite');assert.equal(e.api.customCookingUi.enabled(e.player),false);
  const done=e.api.customCookingUi.openAt(e.player,e.block),f=e.forms[0];assert.equal(f.shows,1);
  f.buttons[0].fn();f.buttons[0].fn();e.drain();assert.equal(e.count(r.id),r.resultCount);assert.equal(f.shows,1);
  f.close();await done;assert.equal(e.api.customCookingUi.activeCount(),0);
});
test('closing before queued click prevents material/durability changes',async()=>{
  const e=env(),r=e.api.COOKING_RECIPES[0];e.materials(r);const k=e.knife('netherite'),before=JSON.stringify(e.slots);
  const done=e.api.customCookingUi.openAt(e.player,e.block),f=e.forms[0];f.buttons[0].fn();f.close();await done;e.drain();assert.equal(JSON.stringify(e.slots),before);assert.equal(e.api.placedDamage(k),0);
});
test('board removal before queued craft closes form without crafting',async()=>{
  const e=env(),r=e.api.COOKING_RECIPES[0];e.materials(r);e.knife('netherite');const before=JSON.stringify(e.slots);
  const done=e.api.customCookingUi.openAt(e.player,e.block),f=e.forms[0];f.buttons[0].fn();e.block.typeId='minecraft:air';e.drain();await done;
  assert.equal(JSON.stringify(e.slots),before);assert.equal(e.api.customCookingUi.activeCount(),0);
});
test('out-of-range and dimension changes invalidate open UI',async()=>{
  for(const mode of ['distance','dimension']) {const e=env();e.knife();const done=e.api.customCookingUi.openAt(e.player,e.block);
    if(mode==='distance')e.player.location.x=99;else e.player.dimension={id:'minecraft:nether'};
    [...e.intervals.values()].at(-1)();await done;assert.equal(e.api.customCookingUi.activeCount(),0);}
});
test('unsupported native UI falls back to grid and manual off remains available',async()=>{
  const e=env();e.knife();e.player.addTag('pinene_cooking:customform_test');delete e.customFormApi.CustomForm;await e.api.openBoard(e.player,e.block);assert.equal(e.forms[0].buttons.length,79);
  e.handlers.script({id:'pinene_cooking:customform',sourceEntity:e.player,message:'off'});e.drain();assert.equal(e.api.customCookingUi.enabled(e.player),false);
});
test('invalid selector values cannot select an arbitrary recipe',async()=>{
  const e=env();e.knife();const done=e.api.customCookingUi.openAt(e.player,e.block),f=e.forms[0];f.fields[0].value.setData(999);assert.equal(f.fields[0].value.getData(),0);f.close();await done;
});
test('normal players open the 79-button icon grid even when CustomForm is available',async()=>{
  const e=env();e.knife();await e.api.openBoard(e.player,e.block);
  assert.equal(e.forms.length,1);assert.equal(e.forms[0].buttons.length,79);
  assert.equal(e.api.customCookingUi.activeCount(),0);
});
test('dropdown requires explicit opt-in and off restores icon grid',async()=>{
  const e=env();assert.equal(e.api.customCookingUi.enabled(e.player),false);
  e.handlers.script({id:'pinene_cooking:customform',sourceEntity:e.player,message:'on'});e.drain();assert.equal(e.api.customCookingUi.enabled(e.player),true);
  e.handlers.script({id:'pinene_cooking:customform',sourceEntity:e.player,message:'off'});e.drain();assert.equal(e.api.customCookingUi.enabled(e.player),false);
});
