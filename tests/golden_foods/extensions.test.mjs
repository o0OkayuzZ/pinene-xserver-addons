import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext,runInContext,createContext} from 'node:vm';
import * as math from '../../docs/golden_extensions/stage/bp/scripts/golden_extensions/math.js';
import * as safety from '../../docs/golden_extensions/stage/bp/scripts/golden_extensions/safety.js';
import {EXTENSION_GUIDE} from '../../docs/golden_extensions/stage/bp/scripts/golden_extensions/guide_data.js';
import {chooseEffect} from '../../behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/core.js';
const root=new URL('../../',import.meta.url),stage='docs/golden_extensions/stage/';
const read=p=>readFileSync(new URL(p,root),'utf8');
function dimension(options={}){
 return {id:options.id??'minecraft:overworld',heightRange:{min:0,max:320},getBlock(p){
  if(options.unloaded?.(p))throw Error('unloaded');
  const solid=p.y<64||options.wall?.(p),typeId=solid?(options.floor??'minecraft:stone'):'minecraft:air';
  return {isAir:!solid,typeId};
 },getBlockFromRay:()=>undefined,getEntitiesFromRay:()=>[],getPlayers:()=>[]};
}
const origin={x:.5,y:64,z:.5},view={x:1,y:0,z:0};
test('four identifiers, eight ingots/blocks, no edible component, matching enchanted texture and glint',()=>{
 for(const [g,e] of [['gegg','egegg'],['gchorus_fruit','egchorus_fruit']]){
  const items=[g,e].map(i=>JSON.parse(read(stage+`bp/items/${i}.json`))['minecraft:item']);
  assert.equal(items[0].components['minecraft:icon'],items[1].components['minecraft:icon']);assert.equal(items[1].components['minecraft:glint'],true);
  for(const [i,item] of items.entries()){
   assert.equal(item.components['minecraft:food'],undefined);assert.equal(item.description.identifier,'a:'+([g,e][i]));
   const rec=JSON.parse(read(stage+`bp/recipes/golden_extension_${[g,e][i]}.json`))['minecraft:recipe_shaped'];
   assert.equal(rec.pattern.join('').split('G').length-1,8);assert.equal(rec.key.G.item,i?'minecraft:gold_block':'minecraft:gold_ingot');
  }
 }
});
test('projectile definitions have zero damage, zero knockback, no hatching and bounded lifetime',()=>{
 for(const name of ['golden_egg_projectile','enchanted_golden_egg_projectile']){
  const text=read(stage+`bp/entities/${name}.json`),d=JSON.parse(text)['minecraft:entity'].components;
  const hit=d['minecraft:projectile'].on_hit;
  assert.equal(hit.impact_damage.damage,0);assert.equal(hit.impact_damage.knockback,false);assert.ok(!text.includes('chicken'));assert.ok(!text.includes('spawn_chance'));
  assert.equal(d['minecraft:timer'].time,20);
 }
});
test('homing selects smallest angle, excludes owner, out-of-range and occluded targets',()=>{
 const p=(id,x,z)=>({id,point:{x,y:0,z}});
 assert.equal(math.selectTarget({x:0,y:0,z:0},view,[p('owner',1,0),p('close',2,0.5),p('aim',20,.1),p('outside',40,0)],'owner').id,'aim');
 assert.equal(math.selectTarget({x:0,y:0,z:0},view,[p('side',2,2)],'owner'),undefined);
 assert.equal(math.selectTarget({x:0,y:0,z:0},view,[p('hidden',2,0)],'owner',()=>false),undefined);
});
test('homing preserves speed, turns at most 6 degrees and handles zero/opposite vectors',()=>{
 const v={x:1.5,y:0,z:0},n=math.turnToward(v,{x:0,y:0,z:10});
 assert.ok(Math.abs(math.length(n)-1.5)<1e-8);assert.ok(Math.acos(math.dot(math.unit(n),math.unit(v)))<=Math.PI/30+1e-8);
 assert.deepEqual(math.turnToward(v,{x:-1,y:0,z:0}),v);assert.deepEqual(math.turnToward(v,{x:0,y:0,z:0}),v);
});
test('absolute and relative coordinate parsing rejects commands, NaN and infinities',()=>{
 assert.equal(math.parseAxis('~100',1250),1350);assert.equal(math.parseAxis('~',72),72);assert.equal(math.parseAxis('~-50',0),-50);assert.equal(math.parseAxis('-430',0),-430);
 for(const value of ['Infinity','NaN','1e9','^1','1 2','~foo','/tp @s 0 0 0','30000001'])assert.throws(()=>math.parseAxis(value,0));
});
test('blink ranges are 24/64/96 and coordinate ranges are 256/256/1024',()=>{
 assert.equal(math.limits('minecraft:overworld',false).blink,24);assert.equal(math.limits('minecraft:overworld',true).blink,64);assert.equal(math.limits('minecraft:the_end',true).blink,96);
 assert.equal(math.limits('minecraft:nether',true).coordinate,256);assert.equal(math.limits('minecraft:the_end',true).coordinate,1024);
});
test('clear ground reaches limit; walls and one-block ceilings block blinks',()=>{
 assert.equal(safety.blinkPoint(dimension(),origin,view,24).x,24.5);
 const wall=dimension({wall:p=>p.x>=10&&p.x<11});const stop=safety.blinkPoint(wall,origin,view,24);assert.ok(stop.x<9.7);
 assert.equal(safety.blinkPoint(dimension({wall:p=>p.y>=65&&p.y<66}),origin,view,24),undefined);
});
test('safe destinations refuse lava, magma, void, unloaded chunks and unknown floors',()=>{
 for(const floor of ['minecraft:lava','minecraft:magma','minecraft:cactus','custom:unknown'])assert.equal(safety.safeStanding(dimension({floor}),origin),false);
 assert.equal(safety.safeStanding(dimension(),{x:.5,y:90,z:.5}),false);
 assert.equal(safety.safeStanding(dimension({unloaded:()=>true}),origin),false);
});
test('long coordinate paths cannot skip one-block walls, including diagonal corner clipping',()=>{
 assert.equal(safety.pathClear(dimension({wall:p=>p.x>=100&&p.x<101}),origin,{x:200.5,y:64,z:.5}),false);
 assert.equal(safety.pathClear(dimension({wall:p=>Math.floor(p.x)===10&&Math.floor(p.z)===9}),origin,{x:20.5,y:64,z:20.5}),false);
});
test('coordinate destination uses nearby safe space but never bypasses walls or distance limits',()=>{
 assert.ok(safety.coordinatePoint(dimension(),origin,{x:100.5,y:64,z:.5},256));
 assert.equal(safety.coordinatePoint(dimension(),origin,{x:300.5,y:64,z:.5},256),undefined);
 assert.equal(safety.coordinatePoint(dimension({wall:p=>p.x>=10&&p.x<11}),origin,{x:20.5,y:64,z:.5},256),undefined);
 assert.equal(safety.coordinatePoint(dimension({unloaded:p=>p.x>3}),origin,{x:100.5,y:64,z:.5},256),undefined);
});
function environment(){
 const callbacks={},players=new Map(),projectiles=[],forms=[],responses=[];let tick;
 const world={afterEvents:new Proxy({}, {get:(_,name)=>({subscribe:fn=>callbacks[name]=fn})}),getEntity:id=>players.get(id)};
 const system={currentTick:100,run:fn=>fn(),runInterval:fn=>tick=fn};
 class Form{constructor(){forms.push(this);}title(t){this.titleText=t;return this;}body(t){this.bodyText=t;return this;}button(){return this;}textField(){return this;}async show(){return responses.shift()??{canceled:true};}}
 const ctx=createContext({...math,...safety,chooseEffect,world,system,GameMode:{Creative:'Creative',Spectator:'Spectator'},ActionFormData:Form,ModalFormData:Form,console});
 runInContext(read(stage+'bp/scripts/golden_extensions/runtime.js').replace(/^import .*;$/gm,'').replace('export function','function'),ctx);
 function player(id,item,dim=dimension()){
  let stack={typeId:item,amount:4};const effects=new Map(),calls=[];
  const container={getItem:()=>stack?{...stack}:undefined,setItem:(_,v)=>stack=v};
  const p={id,typeId:'minecraft:player',isValid:true,isSneaking:false,selectedSlotIndex:0,location:{...origin},dimension:dim,getViewDirection:()=>view,getHeadLocation:()=>math.add(p.location,{x:0,y:1.62,z:0}),getVelocity:()=>({x:0,y:-1,z:0}),getGameMode:()=> 'Survival',getComponent:id=>id==='minecraft:inventory'?{container}:{currentValue:20},getEffect:id=>effects.get(id),addEffect:(id,duration,opts)=>{effects.set(id,{duration,...opts});calls.push(id);},tryTeleport:(to,opts)=>{p.location={...to};return true;}};
  dim.spawnEntity=(typeId,location)=>{
   const e={id:'shot'+projectiles.length,typeId,location,isValid:true,dimension:dim,getVelocity:()=>e.velocity,remove:()=>e.isValid=false,getComponent:()=>({shoot:v=>e.velocity=v})};projectiles.push(e);return e;
  };
  dim.getPlayers=()=>[...players.values()].filter(p=>p.dimension===dim);players.set(id,p);
  return {p,effects,calls,amount:()=>stack?.amount??0};
 }
 return {ctx,world,system,callbacks,player,projectiles,forms,responses,tick:()=>tick()};
}
test('egg consumes exactly once and buffs players only, never mobs or double-hit overlap',()=>{
 const env=environment(),owner=env.player('owner','a:gegg'),target=env.player('enemy','a:gegg');
 env.ctx.useExtension({source:owner.p,itemStack:{typeId:'a:gegg'}});assert.equal(owner.amount(),3);
 const projectile=env.projectiles[0];env.callbacks.projectileHitEntity({projectile,getEntityHit:()=>({entity:target.p})});
 assert.equal(target.effects.get('regeneration').amplifier,1);assert.equal(target.effects.get('strength').duration,1200);
 assert.equal(target.effects.get('saturation').duration,1);assert.equal(target.calls.length,3);
 env.callbacks.projectileHitEntity({projectile,getEntityHit:()=>({entity:target.p})});assert.equal(target.calls.length,3);
 env.system.currentTick++;
 env.ctx.useExtension({source:owner.p,itemStack:{typeId:'a:gegg'}});
 env.callbacks.projectileHitEntity({projectile:env.projectiles[1],getEntityHit:()=>({entity:{typeId:'minecraft:zombie',addEffect:assert.fail}})});
 assert.equal(env.projectiles[1].isValid,false);assert.equal(env.forms.length,0);
});
test('enchanted egg exact buffs, no resistance/fire resistance, no amplifier stacking',()=>{
 const env=environment(),p=env.player('p','a:egegg');
 env.ctx.buff(p.p,true);env.ctx.buff(p.p,true);
 assert.equal(p.effects.get('strength').amplifier,1);assert.equal(p.effects.get('strength').duration,1800);assert.equal(p.effects.get('regeneration').duration,400);assert.equal(p.calls.length,3);
 assert.equal(p.effects.has('resistance'),false);assert.equal(p.effects.has('fire_resistance'),false);
});
test('projectile disappears on blocks and after lifetime; missing homing target retains forward velocity',()=>{
 const env=environment(),p=env.player('p','a:egegg');env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egegg'}});
 const shot=env.projectiles[0],velocity={...shot.velocity};env.tick();assert.deepEqual(shot.velocity,velocity);
 env.system.currentTick+=401;env.tick();assert.equal(shot.isValid,false);
 env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egegg'}});env.callbacks.projectileHitBlock({projectile:env.projectiles[1]});assert.equal(env.projectiles[1].isValid,false);
});
test('ordinary chorus use blinks and consumes only on success without UI; failed teleport never consumes',()=>{
 const env=environment(),p=env.player('p','a:gchorus_fruit');env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:gchorus_fruit'}});
 assert.equal(p.p.location.x,24.5);assert.equal(p.amount(),3);assert.equal(env.forms.length,0);
 const blocked=env.player('b','a:gchorus_fruit',dimension({wall:q=>q.x>=1}));env.ctx.useExtension({source:blocked.p,itemStack:{typeId:'a:gchorus_fruit'}});assert.equal(blocked.amount(),4);
 const failed=env.player('f','a:gchorus_fruit');failed.p.tryTeleport=()=>false;env.ctx.useExtension({source:failed.p,itemStack:{typeId:'a:gchorus_fruit'}});assert.equal(failed.amount(),4);
});
test('only enchanted sneaking opens UI; cancel and changed held item are nonconsuming',async()=>{
 const env=environment(),p=env.player('p','a:egchorus_fruit');p.p.isSneaking=true;
 env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egchorus_fruit'}});await new Promise(r=>setImmediate(r));assert.equal(env.forms.length,1);assert.equal(p.amount(),4);
 const t=env.ctx.ticket(p.p,'a:egchorus_fruit');p.p.selectedSlotIndex=1;assert.equal(env.ctx.warp(p.p,t),false);assert.equal(p.amount(),4);
});
test('End void anchor saves pre-warp safe point for 60 seconds, rescues once before death, clears on dimension change',()=>{
 const env=environment(),p=env.player('p','a:egchorus_fruit',dimension({id:'minecraft:the_end'}));env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egchorus_fruit'}});
 assert.equal(p.p.location.x,96.5);p.p.location.y=-9;env.tick();assert.equal(p.p.location.x,.5);assert.equal(p.p.location.y,64);assert.equal(p.amount(),3);
 p.p.location.y=-9;env.tick();assert.equal(p.p.location.y,-9);
 p.p.location={...origin};env.system.currentTick++;env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egchorus_fruit'}});env.callbacks.playerDimensionChange({player:p.p});p.p.location.y=-9;env.tick();assert.equal(p.p.location.y,-9);
});
test('expired anchors do not rescue',()=>{
 const env=environment(),p=env.player('p','a:egchorus_fruit',dimension({id:'minecraft:the_end'}));env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egchorus_fruit'}});
 env.system.currentTick+=1200;p.p.location.y=-9;env.tick();assert.equal(p.p.location.y,-9);
});
test('aimed entity and block shorten enhanced blink to the near side of the target',()=>{
 const env=environment(),p=env.player('p','a:egchorus_fruit');
 p.p.dimension.getEntitiesFromRay=()=>[{entity:{id:'target',typeId:'minecraft:zombie'},distance:10}];
 env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egchorus_fruit'}});assert.ok(p.p.location.x<=9.75&&p.p.location.x>8);
 p.p.location={...origin};env.system.currentTick++;p.p.dimension.getEntitiesFromRay=()=>[];
 p.p.dimension.getBlockFromRay=()=>({block:{location:{x:20,y:65,z:0}},faceLocation:{x:0,y:.62,z:.5}});
 env.ctx.useExtension({source:p.p,itemStack:{typeId:'a:egchorus_fruit'}});assert.ok(p.p.location.x<20&&p.p.location.x>18);
});
test('coordinate UI accepts relative values; invalid input and dimension change never consume',async()=>{
 const env=environment(),p=env.player('p','a:egchorus_fruit');
 env.responses.push({selection:2},{formValues:['~10','~','~']});await env.ctx.advanced(p.p,env.ctx.ticket(p.p,'a:egchorus_fruit'));
 assert.equal(p.p.location.x,10.5);assert.equal(p.amount(),3);
 env.responses.push({selection:2},{formValues:['no','~','~']},{canceled:true});await env.ctx.advanced(p.p,env.ctx.ticket(p.p,'a:egchorus_fruit'));assert.equal(p.amount(),3);
 const t=env.ctx.ticket(p.p,'a:egchorus_fruit');p.p.dimension=dimension({id:'minecraft:nether'});assert.equal(env.ctx.warp(p.p,t),false);assert.equal(p.amount(),3);
});
test('homing discards dead target and relocks a visible player; swept-wall hits never grant buffs',()=>{
 const env=environment(),owner=env.player('owner','a:egegg'),target=env.player('target','a:egegg',owner.p.dimension);target.p.location={x:10,y:64,z:.5};
 env.ctx.useExtension({source:owner.p,itemStack:{typeId:'a:egegg'}});
 assert.equal(runInContext('[...shots.values()][0].target.id',env.ctx),'target');
 target.p.isValid=false;const replacement=env.player('replacement','a:egegg',owner.p.dimension);replacement.p.location={x:15,y:64,z:.5};env.tick();
 assert.equal(runInContext('[...shots.values()][0].target.id',env.ctx),'replacement');
 owner.p.dimension.getBlockFromRay=()=>({block:{}});env.callbacks.projectileHitEntity({projectile:env.projectiles[0],location:replacement.p.location,getEntityHit:()=>({entity:replacement.p})});
 assert.equal(replacement.calls.length,0);
});
test('guide includes four new non-edible/utility entries and never restores ordinary apple stew',async()=>{
 const FOODS=JSON.parse(read('behavior_packs/bp_02_ef6e99cf-077d-4b55-9e11-f86bb9e66880/scripts/golden_foods/data.js').split(' = ')[1].trim().replace(/;$/,''));
 const code=read(stage+'bp/scripts/golden_foods/guide.js').replace(/^import .*;$/gm,'').replace('export async function','async function');
 const listed=Object.entries({...FOODS,...EXTENSION_GUIDE}).filter(([id])=>id!=='a:astew');
 for(const id of Object.keys(EXTENSION_GUIDE)){
  const forms=[];class Form{constructor(){forms.push(this);this.buttons=[];}title(){return this;}body(v){this.text=v;return this;}button(v){this.buttons.push(v);return this;}async show(){return forms.length===1?{selection:listed.findIndex(([key])=>key===id)}:{canceled:true};}}
  const ctx={FOODS,EXTENSION_GUIDE,SCIENCE:{},effectLines:()=>[],ActionFormData:Form};runInNewContext(code,ctx);await ctx.showGuide({id:'p',isValid:true},assert.fail);
  assert.equal(forms[0].buttons.length,23);assert.ok(!forms[0].buttons.includes('リンゴシチュー'));assert.equal(forms[1].text,EXTENSION_GUIDE[id].extensionBody);
 }
});
