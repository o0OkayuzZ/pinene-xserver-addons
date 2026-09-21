import test from 'node:test';
import assert from 'node:assert/strict';
import { world,system,FakeEntity,ItemStack,reset } from './mock-minecraft.mjs';
import { createNFRuntime } from '../pack/BP/scripts/mycology/nf_runtime.js';

// Synthetic fixtures; never included in gameplay registry.
const definitions=new Map(Array.from({length:105},(_,i)=>{
 const id=`NF-${String(i+1).padStart(3,'0')}`;
 return [id,{id,displayName:id,status:'approved',duration:100,milkClear:true,tags:[],fatal:{enabled:false},
  triggers:{damage:s=>s.severity++}}];
}));
test('single 20-tick scheduler for active states; no empty player/property records',()=>{
 reset();const r=createNFRuntime(definitions,[]),p=new FakeEntity('p');world.entities.set(p.id,p);
 assert.equal(system.intervals.size,0);
 for(const id of definitions.keys())r.activate(p,id);
 assert.equal(system.intervals.size,1);assert.equal([...system.intervals.values()][0].ticks,20);
 assert.equal(p.props.size,105);
 [...system.intervals.values()][0].f();assert.equal(r.active.get('p').manager.get('NF-105').remainingTime,99);
 r.clear(p,'milk');[...system.intervals.values()][0].f();assert.equal(system.intervals.size,0);assert.equal(p.props.size,0);
});
test('reconnect restores online duration; damage dispatch only affects active states',()=>{
 reset();const r=createNFRuntime(definitions,[]),p=new FakeEntity('p');world.entities.set(p.id,p);
 r.activate(p,'NF-055');[...system.intervals.values()][0].f();r.dispatch(p,'damage',{});
 const q=new FakeEntity('q');q.props=new Map(p.props);world.entities.set(q.id,q);
 const next=createNFRuntime(definitions,[]);next.restore(q);
 const state=next.active.get('q').manager.get('NF-055');assert.equal(state.remainingTime,99);assert.equal(state.severity,1);
 assert.equal(next.active.get('q').manager.states.size,1);
});
test('milk and respawn events clear persisted state without affecting other player',()=>{
 reset();const r=createNFRuntime(definitions,[]);r.install();r.install();
 const p=new FakeEntity('p'),q=new FakeEntity('q');world.entities.set(p.id,p);world.entities.set(q.id,q);
 r.activate(p,'NF-091');r.activate(q,'NF-096');
 world.afterEvents.itemCompleteUse.emit({source:p,itemStack:new ItemStack('minecraft:milk_bucket')});
 assert.equal(p.props.size,0);assert.equal(q.props.size,1);
 world.afterEvents.entityDie.emit({deadEntity:q});world.afterEvents.playerSpawn.emit({player:q,initialSpawn:false});
 assert.equal(q.props.size,0);assert.equal(r.active.size,0);
});
