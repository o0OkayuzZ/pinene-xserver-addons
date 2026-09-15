import test from 'node:test';
import assert from 'node:assert/strict';
import {deliverRoomReward, rewardSlotRange, selectRewardSlots} from '../scripts/infinite_castle/phase1Rewards.js';
function fixture(extra={}) {
 const room={kind:'combat',encounterType:'guard',unlockComplete:true,reward:'locked',rewardVersion:4,...extra};
 const items=Array(27),calls=[];
 const container={size:27,getItem:i=>items[i]};
 const api={persist(){},random:()=>0,insert(i){calls.push(i);items[i]={typeId:'minecraft:diamond'};},insertLegacy(i){calls.push(i);items[i]={typeId:'minecraft:diamond'};}};
 return {room,items,calls,container,api,deliver:()=>deliverRoomReward(room,container,api)};
}
test('new rewards increase slots modestly and never exceed chest capacity',()=>{
 for(const [room,range] of [[{},[17,21]],[{encounterType:'elite'},[20,24]],[{kind:'treasure_vault'},[24,27]]]) {
  assert.deepEqual(rewardSlotRange(room),range);
  for(const roll of [0,.5,.999999]) {
   const selected=selectRewardSlots(room,()=>roll);
   assert(selected.length>=range[0]&&selected.length<=range[1]);
   assert.equal(new Set(selected).size,selected.length);
   assert(selected.every(n=>n>=0&&n<27));
  }
 }
 const f=fixture();f.deliver();assert.equal(f.calls.length,17);assert.equal(f.room.rewardVersion,5);
});
test('V4 interrupted receipts retain their lower slot count and resume without extra rolls',()=>{
 const f=fixture({reward:'stocking',rewardDraw:{selectedSlots:Array.from({length:16},(_,i)=>i),next:3}});
 f.items[0]={};f.items[1]={};f.items[2]={};f.deliver();
 assert.equal(f.room.rewardVersion,4);assert.equal(f.calls.length,13);assert.equal(f.calls[0],3);
});
test('empty pending V4 slot is retried across reload',()=>{
 const f=fixture({reward:'stocking',rewardDraw:{selectedSlots:Array.from({length:16},(_,i)=>i),next:3,pending:3}});
 f.items[0]={};f.items[1]={};f.items[2]={};f.deliver();
 assert.equal(f.calls.length,13);assert.equal(f.calls[0],3);
});
test('claimed old and new rewards never refill',()=>{
 for(const rewardVersion of [2,3,4,5]) {const f=fixture({reward:'stocked',rewardVersion});f.deliver();assert.equal(f.calls.length,0);}
 const f=fixture();f.deliver();f.items.fill(undefined);f.deliver();assert.equal(f.calls.length,17);
});
test('V5 failure resumes without duplicating delivered slots; invalid receipts are retained',()=>{
 const f=fixture(),insert=f.api.insert;
 f.api.insert=i=>{if(f.calls.length===2)throw Error('unloaded');insert(i);};
 assert.throws(f.deliver,/unloaded/);f.api.insert=insert;f.deliver();
 assert.equal(f.calls.length,17);assert.equal(new Set(f.calls).size,17);
 const broken=fixture({rewardVersion:5,reward:'stocking',rewardDraw:{selectedSlots:Array(17).fill(1),next:0}});
 assert.throws(broken.deliver,/receipt/);assert.equal(broken.calls.length,0);
});
test('partially issued V3 reward keeps its legacy path',()=>{
 const f=fixture({rewardVersion:3,reward:'stocking',rewardDraw:{anchor:13,next:25}});
 f.deliver();assert.equal(f.calls.length,2);assert.equal(f.room.rewardVersion,3);
});
