import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const file=new URL('../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/budding_amethyst_policy.js',import.meta.url);
const {shouldRecoverBuddingAmethyst}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(file)).toString('base64'));
function event({block='minecraft:budding_amethyst',mode='Survival',tool='minecraft:diamond_pickaxe',silk=true}={}){return {brokenBlockPermutation:{type:{id:block}},player:{getGameMode(){return mode}},itemStackBeforeBreak:tool?{typeId:tool,getComponent(){return {hasEnchantment(id){assert.equal(id,'silk_touch');return silk}}}}:undefined};}
test('silk pickaxes including addon tools recover the native budding block',()=>{for(const tool of ['minecraft:diamond_pickaxe','minecraft:netherite_pickaxe','true:deathnerite_pickaxe'])assert.equal(shouldRecoverBuddingAmethyst(event({tool}),true),true)});
test('ordinary pickaxe, fortune, wrong tool and bare hand do not create bonus blocks',()=>{for(const options of [{silk:false},{tool:'minecraft:diamond_axe'},{tool:null}])assert.equal(shouldRecoverBuddingAmethyst(event(options),true),false)});
test('creative, spectator and disabled tile drops do not duplicate blocks',()=>{for(const mode of ['Creative','Spectator'])assert.equal(shouldRecoverBuddingAmethyst(event({mode}),true),false);assert.equal(shouldRecoverBuddingAmethyst(event(),false),false)});
test('ordinary amethyst, clusters and other budding ores remain untouched',()=>{for(const block of ['minecraft:amethyst_block','minecraft:amethyst_cluster','mygeode:budding_diamond','minecraft:stone'])assert.equal(shouldRecoverBuddingAmethyst(event({block}),true),false)});
