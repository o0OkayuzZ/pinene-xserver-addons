import test from "node:test";
import assert from "node:assert/strict";
import { deliverRoomReward } from "../scripts/infinite_castle/phase1Rewards.js";
import { slotLootTableFor } from "../scripts/infinite_castle/phase1Config.js";
function fixture(overrides = {}) {
    const items = Array(27), room = { kind: "combat", unlockComplete: true, reward: "locked", rewardVersion: 3, ...overrides };
    const container = { size: 27, getItem: i => items[i] }, calls = [];
    const api = { persist() {}, random: () => .5, insert(slot, guaranteed) {
        calls.push({slot, guaranteed});
        if (guaranteed || slot === 4 || slot === 24) items[slot] = { typeId: "minecraft:diamond", amount: 2, nameTag: "native metadata" };
        return { successCount: guaranteed ? 1 : 0 };
    } };
    return { room, items, container, api, calls, deliver: () => deliverRoomReward(room, container, api) };
}
test("slot commands use relative BSL paths", () => {
    assert.equal(slotLootTableFor("guard"), "chests/infinite_castle/slots/guard");
    assert.equal(slotLootTableFor("treasure_vault", true), "chests/infinite_castle/slots/treasure_vault_base");
});
test("each slot is drawn once; empty outcomes stay empty and native item metadata stays in place", () => {
    const h = fixture(); h.deliver();
    assert.equal(h.calls.length, 27);
    assert.equal(new Set(h.calls.map(c => c.slot)).size, 27);
    assert.deepEqual(h.calls[0], {slot:13,guaranteed:true});
    assert.equal(h.calls.filter(c => c.guaranteed).length, 1);
    assert.deepEqual(h.items.map((item,i) => item ? i : null).filter(v => v !== null), [4,13,24]);
    assert.equal(h.items[24].nameTag, "native metadata");
    assert.equal(h.room.reward, "stocked");
    h.items.fill(undefined); h.deliver(); assert.equal(h.calls.length, 27);
});
test("all possible guaranteed positions cover all 27 slots without collisions", () => {
    for (let anchor=0; anchor<27; anchor++) {
        const h=fixture(); h.api.random=()=> (anchor+.1)/27; h.deliver();
        assert.equal(h.calls[0].slot, anchor);
        assert.deepEqual(h.calls.map(c=>c.slot).sort((a,b)=>a-b), Array.from({length:27},(_,i)=>i));
    }
});
test("a missing guaranteed reward stays retryable instead of accepting a falsely successful command", () => {
    const h=fixture(), good=h.api.insert;
    for (const insert of [()=>({successCount:0}),()=>({successCount:1}),()=>{throw new Error("unloaded");}]) {
        h.api.insert=insert; assert.throws(h.deliver);
        assert.equal(h.room.reward,"stocking"); assert.equal(h.room.rewardDraw.next,0);
    }
    h.api.insert=good; h.deliver(); assert.equal(h.room.reward,"stocked");
});
test("old broken receipts repair once while version 2 and 3 claimed rewards never refill", () => {
    const h=fixture({reward:"stocked",rewardVersion:undefined}); h.deliver();
    assert.equal(h.calls.length,27); h.items.fill(undefined); h.deliver(); assert.equal(h.calls.length,27);
    for (const version of [2,3]) {
        const claimed=fixture({reward:"stocked",rewardVersion:version}); claimed.deliver();
        assert.equal(claimed.calls.length,0);
    }
    const legacy=fixture({reward:"stocked",rewardVersion:undefined}); legacy.items[0]={typeId:"minecraft:iron_ingot"};
    legacy.deliver(); assert.equal(legacy.calls.length,0);
});
test("a partial failure resumes at the unfilled slot without redrawing earlier slots", () => {
    const h=fixture(), good=h.api.insert;
    h.api.insert=(slot,guaranteed)=>{if(slot===8)throw new Error("unloaded");return good(slot,guaranteed);};
    assert.throws(h.deliver,/unloaded/); assert.equal(h.room.reward,"stocking");
    h.api.insert=good; h.deliver();
    assert.equal(h.calls.length,27); assert.equal(new Set(h.calls.map(c=>c.slot)).size,27);
});
test("a write followed by an exception is not repeated", () => {
    const h=fixture(),good=h.api.insert;
    h.api.insert=(slot,g)=>{const r=good(slot,g);if(slot===4)throw new Error("after write");return r;};
    assert.throws(h.deliver,/after write/);
    h.api.insert=good; h.deliver(); assert.equal(h.calls.filter(c=>c.slot===4).length,1);
});
test("reloaded pending empty outcomes are not rerolled and incomplete draws finish", () => {
    const h=fixture({reward:"stocking",rewardDraw:{anchor:13,next:5,pending:5}});
    h.items[13]={typeId:"minecraft:diamond"};
    const restored=JSON.parse(JSON.stringify(h.room));
    deliverRoomReward(restored,h.container,h.api);
    assert.equal(h.calls.some(c=>c.slot===4),false);
    assert.equal(h.calls.length,21); assert.equal(restored.reward,"stocked");
    const first=fixture({reward:"stocking",rewardDraw:{anchor:13,next:0,pending:0}});
    first.deliver(); assert.equal(first.calls.length,27);
});
test("old interrupted inserts reconcile inventory; protected and foreign chests stay untouched", () => {
    const old=fixture({reward:"stocking",rewardVersion:2}); old.items[2]={typeId:"minecraft:emerald"};
    old.deliver(); assert.equal(old.calls.length,0);
    for(const o of [{debug:true},{unlockComplete:false}]) {const h=fixture(o);h.deliver();assert.equal(h.calls.length,0);}
    const h=fixture();h.container.size=54;assert.throws(h.deliver,/merged/);
    h.container.size=27;h.items[5]={typeId:"minecraft:stone"};assert.throws(h.deliver,/already contains/);
});
