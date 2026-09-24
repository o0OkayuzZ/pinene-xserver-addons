import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
const path='../behavior_packs/bp_15_4f6cac3a-cc5c-45b7-8ab5-9290d52b9639/scripts/main.js';
const source=readFileSync(new URL(path,import.meta.url),'utf8');
function fixture() {
  let onDie;
  const drops=[];
  const context={world:{afterEvents:{entityDie:{subscribe(fn){onDie=fn;}}}},
    ItemStack:class {constructor(typeId,amount){Object.assign(this,{typeId,amount});}},
    system:{run(fn){fn();}},console};
  const safe=source.match(/function safeSubscribe\([^]*?\n\}/)[0];
  const start=source.indexOf('const FIGURE_DEFINITIONS =');
  const end=source.indexOf('// Trader reroll',start);
  assert.ok(start>=0&&end>start);
  runInNewContext(safe+'\n'+source.slice(start,end)+'\nthis.pick=tryPickupFigureEntity;',context);
  assert.equal(typeof onDie,'function');
  function entity(extra={}) {
    const tags=new Set();
    return {typeId:'myname:figure_fossil_placed',location:{x:1,y:2,z:3},
      dimension:{spawnItem(item,location){drops.push({item,location});}},
      hasTag(t){return tags.has(t);},addTag(t){tags.add(t);},remove(){this.removed=true;},...extra};
  }
  return {onDie,drops,entity,pick:context.pick};
}
test('ordinary death does not touch figure tag or location APIs',()=>{
  const f=fixture(); const e={typeId:'minecraft:zombie',hasTag(){throw Error('must not call');}};
  assert.doesNotThrow(()=>f.onDie({deadEntity:e})); assert.equal(f.drops.length,0);
});
test('figure death returns exactly one correct item without missing helpers',()=>{
  const f=fixture(); f.onDie({deadEntity:f.entity()}); assert.equal(f.drops.length,1);
  assert.equal(f.drops[0].item.typeId,'myname:figure_fossil'); assert.equal(f.drops[0].item.amount,1);
  assert.equal(JSON.stringify(f.drops[0].location),JSON.stringify({x:1,y:2,z:3}));
});
test('picked-up figure death does not emit a second item',()=>{
  const f=fixture(),e=f.entity(); assert.equal(f.pick(e),true); assert.equal(e.removed,true);
  f.onDie({deadEntity:e}); assert.equal(f.drops.length,1);
});
test('legacy figure aliases resolve to the canonical item',()=>{
  const f=fixture(); f.onDie({deadEntity:f.entity({typeId:'myname:oyu_placed'})});
  assert.equal(f.drops[0].item.typeId,'myname:figure_oyu');
});
test('missing entity and invalid type getter do not escape the event',()=>{
  const f=fixture(); assert.doesNotThrow(()=>f.onDie({deadEntity:null}));
  assert.doesNotThrow(()=>f.onDie({deadEntity:{get typeId(){throw Error('removed');}}}));
  assert.equal(f.drops.length,0);
});
test('invalid location getter is handled without an unhandled event error',()=>{
  const f=fixture(),e=f.entity(); Object.defineProperty(e,'location',{get(){throw Error('removed');}});
  assert.doesNotThrow(()=>f.onDie({deadEntity:e})); assert.equal(f.drops.length,0);
});
test('nonfinite location is not passed to spawnItem',()=>{
  for(const x of [NaN,Infinity]){
    const f=fixture();f.onDie({deadEntity:f.entity({location:{x,y:1,z:2}})});assert.equal(f.drops.length,0);
  }
});
test('missing or throwing tag access is exception-safe',()=>{
  for(const hasTag of [undefined,()=>{throw Error('removed');}]){
    const f=fixture();assert.doesNotThrow(()=>f.onDie({deadEntity:f.entity({hasTag})}));
  }
});
test('spawn API exception remains contained in the event',()=>{
  const f=fixture();assert.doesNotThrow(()=>f.onDie({deadEntity:f.entity({dimension:{spawnItem(){throw Error('unloaded');}}})}));
});
