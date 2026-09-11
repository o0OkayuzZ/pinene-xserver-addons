import assert from "node:assert/strict";
import * as mock from "./minecraft-server-encounter-mock.js";
import { createSourcePartsPlan } from "../scripts/infinite_castle/sourcePartsPlanner.js";
import { serializeRoomMaterials } from "../scripts/infinite_castle/sourceRoomMaterials.js";
import { MOB_BALANCE } from "../scripts/infinite_castle/phase1Config.js";
let api = await import("../scripts/infinite_castle/phase1Runtime.js");
const KEY = "infinite_castle:phase1_v2";
const plan = createSourcePartsPlan(17, { x: 1000, y: 80, z: 1000 });
plan.dimensionId = mock.dimension.id;
mock.setup(plan);
mock.world.setDynamicProperty(
    "infinite_castle:source_parts_test_state_v2",
    JSON.stringify({ status: "complete" }),
);
mock.world.setDynamicProperty(
    "infinite_castle:source_parts_detailed_plan_v1",
    JSON.stringify({
        v: 2,
        d: plan.dimensionId,
        s: plan.seed,
        t: plan.style,
        o: plan.topologyId,
        a: Object.values(plan.tierBases.lower),
        m: serializeRoomMaterials(plan),
    }),
);
api.activateRoomEncounterPlan(plan);
const ledger = () => api.phase1Snapshot();
const room = (id) => ledger().rooms.find((r) => r.roomInstanceId === id);
const guard = ledger().rooms.find((r) => r.encounterType === "guard");
const player = {
    id: "one",
    dimension: mock.dimension,
    location: { x: guard.origin.x + 21, y: guard.origin.y + 1, z: guard.origin.z + 21 },
    getGameMode: () => "Survival",
    getComponent: () => ({ currentValue: 20, effectiveMax: 20 }),
    getEffect() {},
    addEffect() {},
    applyDamage() {},
    applyKnockback() {},
    sendMessage() {},
    onScreenDisplay: { setActionBar() {}, setTitle() {} },
};
const tick = (n = 1) => {
    for (let i = 0; i < n; i++) {
        mock.advance();
        api.updateRoomEncounters();
    }
};
mock.setPlayers([player]);
api.phase1Enter(player);
tick(10);
assert.equal(room(guard.roomInstanceId).state, "Dormant", "arrival grace");
tick(12);
assert.equal(room(guard.roomInstanceId).state, "Active");
assert.equal(room(guard.roomInstanceId).wave, 1);
assert.equal(room(guard.roomInstanceId).slots.filter((s) => s.phase === "alive").length, 6);
for (const slot of room(guard.roomInstanceId).slots) {
    const entity = mock.world.getEntity(slot.id);
    assert.equal(entity.spawnOptions.initialPersistence, true);
    assert.equal(entity.spawnOptions.spawnEvent, `infinite_castle:${slot.mob}_1`,
        "managed mobs bypass native randomized spawn transformations");
    for (const mitigated of [0, 0.8, 3.2]) {
        const hurt = { hurtEntity: player, damageSource: { damagingEntity: entity }, damage: mitigated };
        mock.emit("hurtBefore", hurt);
        assert.equal(hurt.damage, mitigated, "native armor and Resistance mitigation survives managed attacks");
    }
}
assert.doesNotThrow(() => mock.emit("entitySpawn", {entity: {
    isValid: false,
    get dimension() { throw new Error("entity was removed before event dispatch"); },
}}));
const archer = room(guard.roomInstanceId).slots.find(s => s.mob === "skeleton");
const arrowEvents = [];
for (const owner of [mock.world.getEntity(archer.id), player]) {
    mock.emit("entitySpawn", { entity: {
        id: `arrow-${owner.id}`, typeId: "minecraft:arrow", dimension: mock.dimension,
        getComponent: () => ({ owner }), triggerEvent: event => arrowEvents.push(event),
    }});
}
mock.advance();
assert.deepEqual(arrowEvents, ["infinite_castle:skeleton_arrow"], "only managed skeleton arrows receive fixed raw damage");
const chest = mock.dimension.getBlock(room(guard.roomInstanceId).chest);
const interaction = { player, block: chest };
mock.emit("interact", interaction);
assert.equal(interaction.cancel, true);
const before = mock.metrics.lootCalls;
for (const s of room(guard.roomInstanceId).slots.slice(0, 4)) mock.kill(mock.world.getEntity(s.id));
tick(8);
assert.equal(room(guard.roomInstanceId).wave, 2, "two remaining starts next wave");
const key = room(guard.roomInstanceId).slots.find((s) => MOB_BALANCE[s.mob].keyHolder);
assert.ok(key?.id);
mock.kill(mock.world.getEntity(key.id));
assert.equal(room(guard.roomInstanceId).keyDefeated, true);
assert.equal(room(guard.roomInstanceId).state, "Active");
tick(13);
assert.equal(room(guard.roomInstanceId).reward, "stocked");
assert.equal(mock.metrics.lootCalls, before + 27);
assert.ok(mock.allEntities().length > 0, "survivors remain after key death");
tick(8);
assert.equal(mock.metrics.lootCalls, before + 27, "reward does not reroll");
mock.setPlayers([]);
tick(20);
assert.equal(room(guard.roomInstanceId).state, "Active", "grace protects empty room");
tick(23);
assert.equal(room(guard.roomInstanceId).state, "Cleared");
assert.equal(mock.allEntities().length, 0);
assert.equal(api.phase1RunState(), "ACTIVE", "logout never ends run");
mock.resetSubscriptions();
api = await import("../scripts/infinite_castle/phase1Runtime.js?restart=runtime");
tick();
assert.equal(room(guard.roomInstanceId).reward, "stocked");
assert.equal(mock.metrics.lootCalls, before + 27);
mock.setPlayers([player]);
api.phase1Enter(player);
tick(15);
assert.equal(room(guard.roomInstanceId).state, "Cleared", "completed room never restarts");
api.phase1Exit(player);
assert.equal(api.phase1RunState(), "ENDED_PENDING_REBUILD");
assert.equal(api.phase1Landing(), null);
const oldRun = ledger().runId;
api.beginPhase1Run();
assert.equal(api.phase1RunState(), "BUILDING");
assert.equal(api.phase1Landing(), null, "no landing in unfinished rebuild");
api.activateRoomEncounterPlan(plan);
assert.notEqual(ledger().runId, oldRun);
assert.equal(ledger().rooms.filter((r) => r.kind === "entrance").length, 1);
// Eight simultaneous encounters exercise the real spawn queue and pending base priority.
const party = ledger()
    .rooms.filter((r) => r.kind === "combat")
    .slice(0, 8)
    .map((r, i) => ({
        ...player,
        id: "cap" + i,
        location: { x: r.origin.x + 21, y: r.origin.y + 1, z: r.origin.z + 21 },
    }));
mock.setPlayers(party);
for (const p of party) api.phase1Enter(p);
let max = 0;
for (let i = 0; i < 300; i++) {
    tick();
    max = Math.max(max, mock.allEntities().length);
    assert.ok(mock.allEntities().length <= 45);
}
assert.equal(max, 45);
const caster = ledger().rooms.flatMap(r => r.slots).find(s => s.mob === "necromancer" && s.id);
assert.ok(caster, "cap fixture includes a native ranged caster");
const shotEvents = [];
mock.emit("entitySpawn", { entity: {
    id: "managed-necromancer-shot", typeId: "dungeons:necromancer_shot", dimension: mock.dimension,
    getComponent: () => ({ owner: mock.world.getEntity(caster.id) }),
    triggerEvent: event => shotEvents.push(event),
}});
mock.advance();
assert.deepEqual(shotEvents, ["infinite_castle:necromancer_shot"]);
assert.ok(Buffer.byteLength(mock.world.getDynamicProperty(KEY), "utf8") < 20000, "persistent ledger stays compact at the cap");
assert.ok(JSON.parse(mock.world.getDynamicProperty(KEY)).rooms.every(r => r.slots.length === 0), "restart-only state omits live actor queues");
assert.ok(
    ledger()
        .rooms.flatMap((r) => r.slots)
        .some((s) => s.phase === "new"),
    "cap leaves pending original mobs",
);
assert.ok(
    ledger()
        .rooms.filter((r) => r.kind === "combat")
        .slice(0, 8)
        .every((r) => r.wave === 2),
    "900-tick timeout works at cap",
);
const exit = ledger().rooms.find((r) => r.kind === "exit");
api.beginEncounterReconstruction();
party[0].location = { x: exit.origin.x + 21, y: exit.origin.y + 1, z: exit.origin.z + 21 };
tick(2);
assert.equal(room(exit.roomInstanceId).exitState, "ANCHORED");
assert.throws(() => api.assertEncounterRevision(), /replan/, "new anchor invalidates pending writes");
api.endEncounterReconstruction();
assert.throws(
    () => api.prepareRoomEncounterRemoval(mock.dimension, { from: party[0].location, to: party[0].location }),
    /protected/,
);
mock.setPlayers([]);
tick(42);
assert.equal(mock.allEntities().length, 0);
assert.equal(api.phase1RunState(), "ACTIVE");
console.log(
    "PHASE1_RUNTIME_OK: waves, arrival/exit grace, rewards, restart, run rebuild, cap45, anchor revision",
);
