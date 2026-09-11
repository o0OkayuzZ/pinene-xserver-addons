import test from "node:test";
import assert from "node:assert/strict";
import { PHASE1, ENCOUNTER_TYPES, WAVES } from "../scripts/infinite_castle/phase1Config.js";
import {
    allocateRoles,
    specialRole,
    multiplayerScaling,
    waveRoster,
    shouldStartWave2,
    newRun,
    joinRun,
    exitRun,
    createRoom,
    restoreCombat,
    graphDistances,
} from "../scripts/infinite_castle/phase1State.js";
import { createSourcePartsPlan } from "../scripts/infinite_castle/sourcePartsPlanner.js";
import { socketContract, validateSocketContracts } from "../scripts/infinite_castle/phase1Sockets.js";
import { interiorBlocks } from "../scripts/infinite_castle/phase1Interiors.js";

test("absolute special probability boundaries", () => {
    for (const [n, role] of [
        [0, "treasure_vault"],
        [0.029999, "treasure_vault"],
        [0.03, "healing_garden"],
        [0.079999, "healing_garden"],
        [0.08, "combat"],
        [0.999999, "combat"],
    ])
        assert.equal(specialRole(n), role);
    assert.throws(() => specialRole(1));
    assert.throws(() => specialRole(-1));
});
test("initial 15 rooms guarantee all encounters and a distant exit across seeds", () => {
    for (let seed = 0; seed < 100; seed++) {
        const plan = createSourcePartsPlan(seed, { x: 0, y: 80, z: 0 }),
            roles = allocateRoles(plan);
        assert.equal(roles.length, 15);
        assert.equal(roles.filter((r) => r.kind === "entrance").length, 1);
        assert.equal(roles.filter((r) => r.kind === "exit").length, 1);
        for (const type of ENCOUNTER_TYPES) assert.ok(roles.some((r) => r.encounterType === type));
        assert.equal(roles.filter((r) => r.encounterType === "elite").length, 1);
        const distances = graphDistances(plan, roles.find((r) => r.kind === "entrance").placementId);
        assert.ok(distances.get(roles.find((r) => r.kind === "exit").placementId) > 1);
        assert.ok(roles.every((r) => !["lower_moon", "upper_moon", "muzan"].includes(r.encounterType)));
    }
});
test("Hard Locks preserve role, retired elite is replaced, entrance is not regenerated", () => {
    const plan = createSourcePartsPlan(7, { x: 0, y: 80, z: 0 }),
        initial = allocateRoles(plan),
        elite = initial.find((r) => r.encounterType === "elite");
    const carried = allocateRoles(plan, [elite], false);
    assert.deepEqual(
        carried.find((r) => r.placementId === elite.placementId),
        elite,
    );
    assert.equal(carried.filter((r) => r.encounterType === "elite").length, 1);
    assert.ok(!carried.some((r) => r.kind === "entrance"));
    const replaced = allocateRoles(plan, [], false);
    assert.equal(replaced.filter((r) => r.encounterType === "elite").length, 1);
    const allLocked = allocateRoles(plan, initial, false);
    assert.deepEqual(allLocked, initial);
});
test("multiplayer snapshots stop at 4; exact base wave rosters and key only in wave 2", () => {
    const totals = [10, 10, 10, 8, 11, 8];
    for (const [type, index] of ENCOUNTER_TYPES.map((t, i) => [t, i])) {
        assert.equal(WAVES[type].flat().length, totals[index]);
        assert.equal(waveRoster(type, 1, 4).length, WAVES[type][0].length + 3);
    }
    for (let n = 1; n <= 8; n++) {
        const s = multiplayerScaling(n);
        assert.equal(s.extra, Math.min(n - 1, 3));
        assert.equal(s.keyHpMultiplier, 1 + 0.15 * Math.min(n - 1, 3));
    }
});
test("wave thresholds include pending and scaling, exclude summons; timeout retains wave 1", () => {
    const room = {
        state: "Active",
        wave: 1,
        waveStarted: 0,
        slots: [0, 0, 1].map((priority) => ({ priority, wave: 1, phase: "alive" })),
    };
    assert.equal(shouldStartWave2(room, 899), false);
    assert.equal(shouldStartWave2(room, 900), true);
    assert.equal(room.slots.length, 3);
    room.slots[0].phase = "dead";
    room.slots.push({ priority: 2, wave: 0, phase: "alive" });
    assert.equal(shouldStartWave2(room, 1), true);
});
test("instance and receipt persist only for retained instances; restart recovers without reroll", () => {
    const run = newRun("run"),
        p = { variantId: "room", origin: { x: 0, y: 0, z: 0 } },
        role = { kind: "combat", encounterType: "guard" };
    const first = createRoom(run, p, role),
        next = createRoom(run, p, role);
    assert.notEqual(first.roomInstanceId, next.roomInstanceId);
    first.state = "Active";
    first.reward = "stocking";
    first.keyDefeated = true;
    const restored = restoreCombat(JSON.parse(JSON.stringify(first)));
    assert.equal(restored.state, "Cleared");
    assert.equal(restored.reward, "stocking", "loaded inventory must reconcile the incomplete transaction");
    assert.deepEqual(restored.overseerAbilities, first.overseerAbilities);
    next.state = "Active";
    restoreCombat(next);
    assert.equal(next.state, "Dormant");
});
test("all participants must normally exit; disconnect/death/restart leave participation active", () => {
    const run = newRun("run");
    assert.throws(() => joinRun(run, "a"));
    run.runState = "ACTIVE";
    joinRun(run, "a");
    joinRun(run, "b");
    assert.equal(exitRun(run, "a"), false);
    const restored = JSON.parse(JSON.stringify(run));
    assert.equal(restored.participants.b, "active");
    joinRun(restored, "a");
    exitRun(restored, "b");
    assert.equal(exitRun(restored, "a"), true);
    assert.equal(restored.runState, "ENDED_PENDING_REBUILD");
});
test("socket contracts reject open/sealed, floor, width, landing and direction changes", () => {
    const plan = createSourcePartsPlan(42, { x: 0, y: 80, z: 0 }),
        id = plan.connections[0].fromPlacementId;
    assert.equal(validateSocketContracts(plan, plan, [id], [id]), true);
    assert.ok(socketContract(plan, id).length);
    for (const change of [
        (c) => c.opening.width++,
        (c) => (c.floorNormal = "down"),
        (c) => c.from.y++,
        (c) => (c.fromDirection = "east"),
        (c) => c.opening.height++,
    ]) {
        const copy = structuredClone(plan);
        change(copy.connections[0]);
        assert.throws(() => validateSocketContracts(plan, copy, [id], [id]));
    }
    const copy = structuredClone(plan);
    copy.connections.shift();
    assert.throws(() => validateSocketContracts(plan, copy, [id], [id]));
});
test("three gardens and two vaults have distinct interiors confined away from sockets", () => {
    for (const [kind, count] of [
        ["healing_garden", 3],
        ["treasure_vault", 2],
    ]) {
        const variants = [];
        for (let interiorVariant = 0; interiorVariant < count; interiorVariant++) {
            const blocks = interiorBlocks({ kind, interiorVariant, origin: { x: 0, y: 0, z: 0 } });
            assert.ok(blocks.length);
            assert.ok(
                blocks.every(
                    (b) => b.position.x > 5 && b.position.x < 37 && b.position.z > 5 && b.position.z < 37,
                ),
            );
            variants.push(JSON.stringify(blocks));
        }
        assert.equal(new Set(variants).size, count);
    }
    assert.equal(PHASE1.enemyCap, 45);
    assert.equal(PHASE1.protectionHops, 0);
});
