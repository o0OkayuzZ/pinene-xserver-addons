import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const bp='behavior_packs/bp_19_211f47f7-5f1d-4b02-a162-e7546cf3fdc4/scripts/';
const rp='resource_packs/rp_22_392fe57f-87d4-4146-a8ba-5c548001ab45/ui/server_form.json';
const ui=JSON.parse(fs.readFileSync(rp,'utf8'));
const source=fs.readFileSync(bp+'main.js','utf8');
function context() {
 const forms=[];
 class Form {
  constructor(){ this.buttons=[]; forms.push(this); }
  title(t){this.titleText=t;return this;} body(t){this.bodyText=t;return this;}
  button(text,icon){this.buttons.push({text,icon});return this;}
  async show(){return {canceled:true};}
 }
 const listener={subscribe(){}};
 const ctx=vm.createContext({console,ActionFormData:Form,ItemStack:class {},system:{runInterval(){},run(){}},world:{beforeEvents:{playerInteractWithBlock:listener},afterEvents:{playerBreakBlock:listener}}});
 const data=fs.readFileSync(bp+'cooking_data.js','utf8').replace(/\bexport\s+/g,'');
 const icons=fs.readFileSync(bp+'inventory_icons.generated.js','utf8').replace(/\bexport\s+/g,'');
 vm.runInContext(data+'\n'+icons+'\n'+source.replace(/^import .*;\r?\n/gm,'')+'\nglobalThis.api={openBoard,recipePage,inventoryIcon,appendInventorySnapshot,countIngredient,canCraftRecipe,UI_INDEX,COOKING_RECIPES};',ctx);
 return {api:ctx.api,forms,Form};
}
const bindings=[];
function walk(obj) {
 if (!obj || typeof obj!=='object')return;
 if (Number.isInteger(obj.collection_index))bindings.push(obj.collection_index);
 for(const value of Object.values(obj))walk(value);
}
walk(ui.pinene_cooking_content);
test('the UI owns its whole canvas instead of inheriting a shorter dialog child',()=>{
 assert.equal(ui.pinene_cooking_long_form.type,'panel');
 assert.deepEqual(ui.pinene_cooking_long_form.size,[398,236]);
 assert.ok(!Object.keys(ui).some(k=>k.includes('main_panel_no_buttons')));
});
test('all 79 form buttons have exactly one rendered slot',()=>{
 assert.deepEqual(bindings.sort((a,b)=>a-b),Array.from({length:79},(_,i)=>i));
});
test('all positioned top-level controls fit within the panel',()=>{
 for(const wrapper of ui.pinene_cooking_content.controls){
  const [name,c]=Object.entries(wrapper)[0];const [x,y]=c.offset??[0,0];const [w,h]=c.size??[0,0];
  if(typeof w==='number'&&typeof h==='number')assert.ok(x>=0&&y>=0&&x+w<=398&&y+h<=236,`${name} exceeds canvas`);
 }
});
test('inventory is 9x3 plus a separate 9-slot hotbar, all on the right',()=>{
 const c=Object.assign({},...ui.pinene_cooking_content.controls);
 assert.equal(c.inventory_grid.controls.length,27);assert.equal(c.hotbar_grid.controls.length,9);
 assert.ok(c.inventory_grid.offset[0]>c.recipe_grid.offset[0]+c.recipe_grid.size[0]);
 assert.ok(c.hotbar_grid.offset[1]>c.inventory_grid.offset[1]+c.inventory_grid.size[1]);
});
test('no description/knife widgets; arrow is geometry, not an unsupported glyph',()=>{
 const str=JSON.stringify(ui.pinene_cooking_content);assert.ok(!str.includes('description'));assert.ok(!str.includes('knife'));assert.ok(!str.includes('→'));assert.ok(str.includes('arrow_tip'));
});
test('recipe paging reaches entries beyond the first 20 and clamps invalid pages',()=>{
 const {api}=context(); const recipes=Array.from({length:47},(_,id)=>({id}));
 assert.equal(api.recipePage(recipes,2).recipes[6].id,46);
 assert.equal(api.recipePage(recipes,99).index,2);assert.equal(api.recipePage(recipes,-1).index,0);assert.equal(api.recipePage([],1).count,1);
});
test('snapshot reads slots 9-35 then 0-8 without mutating inventory',()=>{
 const {api,Form}=context(); const reads=[];const f=new Form();
 const player={getComponent:()=>({container:{size:36,getItem(i){reads.push(i);return {typeId:'minecraft:stone',amount:i+1};},setItem(){throw Error('must not write');}}})};
 api.appendInventorySnapshot(f,player);
 assert.deepEqual(reads,[...Array.from({length:27},(_,i)=>i+9),...Array.from({length:9},(_,i)=>i)]);
 assert.equal(f.buttons.length,36);assert.equal(f.buttons[0].text,'§f10');assert.equal(f.buttons[27].text,'§f');
});
test('missing texture paths are not guessed and unknown slots remain visible',()=>{
 const {api,Form}=context();assert.equal(api.inventoryIcon('unknown:item'),undefined);
 assert.equal(api.inventoryIcon('minecraft:jukebox'),'textures/blocks/jukebox_side');
 assert.equal(api.inventoryIcon('minecraft:gold_block'),'textures/blocks/gold_block');
 assert.equal(api.inventoryIcon('minecraft:chest'),'textures/blocks/chest_front');
 assert.ok(!source.includes('"textures/items/" + id'));
 const f=new Form();api.appendInventorySnapshot(f,{getComponent:()=>({container:{size:36,getItem:()=>({typeId:'unknown:item',amount:2})}})});
 assert.ok(f.buttons[0].text.includes('?'));assert.equal(f.buttons[0].icon,undefined);
});
test('actual form builder agrees with the JSON indices and only shows the selected name',async()=>{
 const {api,forms}=context();
 const block={typeId:'pinene_cooking:oak_cutting_board',location:{x:0,y:0,z:0},permutation:{getState:()=> 'netherite'}};
 block.dimension={getEntities:()=>[{typeId:'pinene_cooking:placed_netherite_knife'}]};
 const player={getComponent:()=>({container:{size:36,getItem:()=>undefined}})};
 await api.openBoard(player,block,{category:0,recipeId:'pine:noodles'});
 const f=forms[0];assert.equal(f.buttons.length,79);assert.equal(f.bodyText,'麺');
 assert.equal(f.buttons[37].icon,'textures/items/noodles');assert.equal(f.buttons[38].text,'§8材料不足');assert.equal(f.buttons[78].text,'§0x');
});
test('all four seed types still count together; insufficient seeds fail',()=>{
 const {api}=context();const oil=api.COOKING_RECIPES.find(r=>r.id==='pine:cooking_oil');
 const stacks=oil.ingredients[0].ids.map(typeId=>({typeId,amount:2}));stacks.push({typeId:'minecraft:glass_bottle',amount:1});
 const player={getComponent:()=>({container:{size:stacks.length,getItem:i=>stacks[i]}})};
 const knife={typeId:'pinene_cooking:placed_netherite_knife'};
 assert.equal(api.canCraftRecipe(player,knife,oil),true);stacks[0].amount=1;assert.equal(api.canCraftRecipe(player,knife,oil),false);
});

test('the eight missing items observed in the actual screen now have explicit mappings',()=>{
 const {api}=context();
 for(const id of ['a:egchorus_fruit','pinecd:cd_05','infinite_castle:entrance_marker','new:config_key','pinene_pvp:dragon_relic','true_dn:parcanite_sword','pinene:pinene_boss_spawn_egg','pinene:enchanted_golden_pumpkin_pie']) assert.ok(api.inventoryIcon(id),id);
});
test('temporary runtime probe is not included in the shipped script',()=>{assert.ok(!source.includes('TEMP_UI_PROBE'));});
