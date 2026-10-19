import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../',import.meta.url),read=p=>JSON.parse(readFileSync(new URL(p,root),'utf8'));
const source='resource_packs/rp_02_3d6a685e-83f1-4a8a-b6a6-27d8d9a3db7a/';
test('trader llama uses complete vanilla textures, adult and baby models and animation',()=>{
 const d=read(source+'entity/trader_llama.entity.json')['minecraft:client_entity'].description;
 assert.equal(d.textures.creamy,'textures/entity/llama/llama_creamy');assert.equal(d.geometry.default,'geometry.llama.v1.8');assert.equal(d.geometry.baby,'geometry.llama.baby');
 assert.equal(d.render_controllers[0],'controller.render.llama.v2');assert.ok(d.textures.decor_wandering_trader);assert.ok(d.textures.baby_creamy);
 assert.equal(d.animations.move,'controller.animation.llama.move');assert.ok(d.scripts.animate.includes('move'));
});
test('higher priority outline uses the restored vanilla models and texture selection',()=>{
 const d=read('resource_packs/pinenite_outline/entity/minecraft_trader_llama.entity.json')['minecraft:client_entity'].description;
 assert.equal(d.render_controllers[0],'controller.render.llama.v2');assert.equal(d.geometry.pn_outline_baby,'geometry.pinenite_outline.geometry_llama_baby');
 const rc=read('resource_packs/pinenite_outline/render_controllers/pinenite_outline.json').render_controllers['controller.render.pinenite_outline.minecraft_trader_llama_0'];assert.match(rc.geometry,/Geometry.pn_outline_baby/);assert.ok(rc.arrays.textures['Array.base']);
});
test('natural marker retains all native trader behavior, trades, timer and companions',()=>{
 const actual=read('behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/entities/wandering_trader.json');
 const expected=read('tests/fixtures/wandering-trader-1.26.52.json');
 assert.deepEqual(actual['minecraft:entity'].events['minecraft:scheduled'].set_property,{'pinene:natural_trader':true});
 delete actual['minecraft:entity'].events['minecraft:scheduled'].set_property;
 delete actual['minecraft:entity'].description.properties;
 assert.deepEqual(actual,expected);
});
