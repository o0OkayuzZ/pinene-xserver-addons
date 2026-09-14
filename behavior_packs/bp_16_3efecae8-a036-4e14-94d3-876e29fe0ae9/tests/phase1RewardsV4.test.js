import test from 'node:test';
import assert from 'node:assert/strict';
import { deliverRoomReward, selectRewardSlots, rewardSlotRange } from '../scripts/infinite_castle/phase1Rewards.js';
function fixture(overrides={}) {
    const room={kind:'combat',encounterType:'guard',unlockComplete:true,reward:'locked',rewardVersion:3,...overrides};
    const items=Array(27), calls=[];
    const container={size:27,getItem:i=>items[i]};
    const api={random:()=>.5,persist(){},insert(slot){
        assert.equal(room.rewardDraw.pending,room.rewardDraw.next);
        assert.equal(room.rewardVersion,4);
        calls.push(slot); items[slot]={typeId:'minecraft:potion',amount:1,potion:'strong_healing'};
    },insertLegacy(slot,guaranteed){calls.push(slot);if(guaranteed)items[slot]={typeId:'minecraft:iron_ingot'};}};
    return {room,items,calls,api,container,deliver:()=>deliverRoomReward(room,container,api)};
}
test('V4 uses exact distinct slot counts and keeps identical native items in separate slots',()=>{
    for(const [kind,encounterType,expected] of [['combat','guard',18],['combat','elite',21],['treasure_vault',null,25]]) {
        const f=fixture({kind,encounterType});f.deliver();
        assert.equal(f.calls.length,expected);assert.equal(new Set(f.calls).size,expected);
        assert.equal(f.items.filter(Boolean).length,expected);
        assert.ok(f.items.filter(Boolean).every(i=>i.potion==='strong_healing'));
        f.items.fill(undefined);f.deliver();assert.equal(f.calls.length,expected);
    }
});
test('V4 draws stay in range over 10000 chests per tier, with every physical slot reachable',()=>{
    let seed=123456;
    const random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/2**32);
    for(const r of [{},{encounterType:'elite'},{kind:'treasure_vault'}]) {
        const [min,max]=rewardSlotRange(r), reached=new Set();let sum=0;
        for(let i=0;i<10000;i++) {
            const slots=selectRewardSlots(r,random);sum+=slots.length;
            assert.ok(slots.length>=min && slots.length<=max);
            assert.equal(new Set(slots).size,slots.length);
            slots.forEach(s=>reached.add(s));
        }
        assert.equal(reached.size,27);assert.ok(Math.abs(sum/10000-(min+max)/2)<.1);
    }
});
test('stocked V2/V3/V4 receipts never refill, even if all loot was taken',()=>{
    for(const rewardVersion of [2,3,4]) {
        const f=fixture({rewardVersion,reward:'stocked'});f.deliver();assert.equal(f.calls.length,0);
    }
});
test('V3 partial draws finish against V3 tables without adding V4 rewards',()=>{
    const f=fixture({reward:'stocking',rewardDraw:{anchor:13,next:26}});
    f.items[13]={typeId:'minecraft:iron_ingot'};f.deliver();
    assert.deepEqual(f.calls,[26]);assert.equal(f.room.rewardVersion,3);assert.equal(f.room.reward,'stocked');
});
test('failed native write retries the same selected slot; successful write then throw never duplicates',()=>{
    const f=fixture(),good=f.api.insert;
    f.api.insert=()=>{throw Error('unloaded');};assert.throws(f.deliver,/unloaded/);
    const selected=[...f.room.rewardDraw.selectedSlots];assert.equal(f.room.rewardDraw.next,0);
    f.api.insert=s=>{good(s);throw Error('after write');};assert.throws(f.deliver,/after write/);
    assert.equal(f.room.rewardDraw.next,1);
    f.api.insert=good;f.deliver();assert.deepEqual(f.calls,selected);
});
test('restart never rerolls a pending outcome even when an item may have been taken',()=>{
    for(const occupied of [false,true]) {
        const f=fixture();const slots=selectRewardSlots(f.room,()=>.5);
        f.room.rewardVersion=4;f.room.reward='stocking';f.room.rewardDraw={selectedSlots:slots,next:2,pending:2};
        if(occupied)f.items[slots[2]]={typeId:'minecraft:diamond'};
        f.deliver();assert.deepEqual(f.calls,slots.slice(3));assert.equal(f.room.reward,'stocked');
    }
});
test('empty successful command is rejected; protected chests and invalid receipts are not overwritten',()=>{
    const f=fixture();f.api.insert=()=>({successCount:1});assert.throws(f.deliver,/no items/);
    assert.equal(f.room.rewardDraw.next,0);
    for(const overrides of [{debug:true},{unlockComplete:false}]) {
        const h=fixture(overrides);h.deliver();assert.equal(h.calls.length,0);
    }
    const h=fixture();h.items[0]={typeId:'minecraft:stone'};assert.throws(h.deliver,/already contains/);
    h.container.size=54;assert.throws(h.deliver,/merged/);
    const bad=fixture({reward:'stocking',rewardVersion:4,rewardDraw:{selectedSlots:Array(18).fill(1),next:0}});
    assert.throws(bad.deliver,/invalid/);assert.equal(bad.calls.length,0);
});
