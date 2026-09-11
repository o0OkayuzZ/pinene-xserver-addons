import test from "node:test";
import assert from "node:assert/strict";
import { createCombatScheduler, inCone } from "../scripts/infinite_castle/phase1Combat.js";
function harness(mob, selected = ["weak_summon", "plague_bolt"]) {
    let now = 0;
    const log = { effects: [], damage: [], summons: [], speed: [], particles: [], sounds: [], unlocks: 0 };
    const room = { state: "Active", overseerAbilities: selected };
    const player = { id: "p", location: { x: 0, y: 0, z: 3 }, getEffect() {} };
    const entity = {
        id: "mob",
        location: { x: 0, y: 0, z: 0 },
        health: { currentValue: 100, effectiveMax: 100 },
        getComponent() {
            return this.health;
        },
        getViewDirection() {
            return { x: 0, y: 0, z: 1 };
        },
        teleport(p) {
            this.location = p;
        },
    };
    const api = {
        tick: () => now,
        players: () => [player],
        slot: () => ({ mob }),
        damage: (p, n) => log.damage.push(n),
        effect: (p, id, t, amp) => log.effects.push({ id, t, amp }),
        particle(p, id) { log.particles.push({ p, id }); },
        sound(id) { log.sounds.push(id); },
        warn(e) {
            throw e;
        },
        safeTeleport: () => ({ x: 0, y: 0, z: 7 }),
        solid: () => false,
        summon: (r, o, n, limit, type) => log.summons.push({ n, limit, type }),
        speed: (e, n) => log.speed.push(n),
        unlock: () => log.unlocks++,
    };
    const scheduler = createCombatScheduler(api);
    scheduler.register(room, { mob }, entity);
    return {
        room,
        entity,
        player,
        log,
        scheduler,
        at(t) {
            now = t;
            scheduler.update(t);
        },
    };
}
test("captain commands, formation spacing, and sweep use scheduled telegraphs", () => {
    const h = harness("captain");
    h.at(140);
    assert.equal(h.log.damage.length, 0);
    h.at(160);
    assert.ok(h.log.damage.includes(14));
    h.at(360);
    h.at(390);
    assert.ok(h.log.effects.some((e) => e.id === "resistance" && e.t === 120));
    h.at(440);
    h.at(480);
    assert.ok(h.log.effects.some((e) => e.id === "strength" && e.t === 160));
});
test("arch curse summons are bounded and threshold field is once only", () => {
    const h = harness("arch_curse");
    h.at(360);
    h.at(400);
    assert.deepEqual(h.log.summons, [{ n: 2, limit: 4, type: "zombie" }]);
    h.entity.health.currentValue = 49;
    h.at(405);
    assert.equal(h.scheduler.metrics().hazards, 1);
    h.at(410);
    assert.equal(h.scheduler.metrics().hazards, 1);
    h.scheduler.clear(h.room);
    assert.deepEqual(h.scheduler.metrics(), { hazards: 0, abilityTimers: 0, projectiles: 0 });
});
test("wraith fire, escape and safe-center burst", () => {
    const h = harness("wraith_lord");
    h.at(160);
    h.at(190);
    assert.equal(h.scheduler.metrics().hazards, 3);
    h.at(280);
    assert.ok(h.log.effects.some((e) => e.id === "invisibility" && e.t === 14));
    h.at(294);
    assert.equal(h.entity.location.z, 7);
    h.entity.health.currentValue = 49;
    h.player.location = { x: 0, y: 0, z: 7 };
    h.at(300);
    h.at(350);
    assert.ok(!h.log.damage.includes(18), "center is safe");
});
test("iron general rage increases speed once; crimson transform delays shockwave", () => {
    const iron = harness("iron_general");
    iron.entity.health.currentValue = 30;
    iron.at(1);
    iron.at(2);
    assert.deepEqual(iron.log.speed, [1.3]);
    iron.at(180);
    iron.at(212);
    assert.ok(iron.log.damage.includes(20));
    const h = harness("crimson");
    h.entity.health.currentValue = 50;
    h.at(10);
    h.at(65);
    assert.equal(h.log.speed.length, 0);
    h.at(70);
    assert.deepEqual(h.log.speed, [1.25]);
    assert.ok(h.log.damage.includes(10));
    h.at(75);
    assert.equal(h.log.speed.length, 1);
});
test("overseer uses only its two persisted abilities", () => {
    const h = harness("overseer");
    assert.deepEqual([...h.scheduler.actors.get("mob").next.keys()], ["weak_summon", "plague_bolt"]);
    h.at(440);
    h.at(480);
    assert.deepEqual(h.log.summons, [{ n: 2, limit: 3, type: "zombie" }]);
});
test("debuffer projectiles, two distinct plague effects, clones and coordinate hazards", () => {
    for (const [mob, cd, ids] of [
        ["nightmare", 180, ["blindness", "darkness"]],
        ["rot", 160, ["poison", "hunger"]],
        ["plague", 160, null],
    ]) {
        const h = harness(mob);
        h.at(cd);
        h.at(cd + 5);
        if (ids) assert.ok(ids.every((id) => h.log.effects.some((e) => e.id === id)));
        else assert.equal(new Set(h.log.effects.map((e) => e.id)).size, 2);
        if (mob === "nightmare") {
            h.entity.health.currentValue = 50;
            h.at(cd + 10);
            h.at(cd + 15);
            assert.deepEqual(h.log.summons, [{ n: 2, limit: 2, type: "clone" }]);
        }
        if (mob === "plague") {
            h.entity.health.currentValue = 50;
            h.at(cd + 10);
            assert.equal(h.scheduler.metrics().hazards, 3);
            h.at(cd + 15);
            assert.equal(h.scheduler.metrics().hazards, 3);
        }
    }
});
test("gold key flight unlocks once and cleanup cancels pending work", () => {
    const h = harness("captain");
    h.scheduler.unlockFlight(h.room, { x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, false);
    h.at(25);
    assert.equal(h.log.unlocks, 0);
    h.at(55);
    assert.equal(h.log.unlocks, 0);
    h.at(60);
    h.at(90);
    assert.equal(h.log.unlocks, 1);
    assert.ok(h.log.particles.filter(p => p.id === "infinite_castle:key_gold").length > 100);
    assert.ok(h.log.sounds.includes("random.chestopen"));
    h.scheduler.unlockFlight(h.room, { x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, false);
    h.scheduler.clear(h.room);
    h.at(100);
    assert.equal(h.log.unlocks, 1);
});
test("crimson key becomes gold before arrival; retired rooms never unlock", () => {
    const h = harness("crimson");
    h.scheduler.unlockFlight(h.room, { x: 0, y: 1, z: 0 }, { x: 10, y: 1, z: 0 }, true);
    h.at(10);
    assert.ok(h.log.particles.some(p => p.id === "infinite_castle:key_crimson"));
    h.log.particles.length = 0;
    h.at(30);
    assert.ok(h.log.particles.some(p => p.id === "infinite_castle:key_gold"));
    assert.ok(!h.log.particles.some(p => p.id === "infinite_castle:key_crimson"));
    h.room.retired = true;
    h.at(60);
    assert.equal(h.log.unlocks, 0);
});
test("cone rejects rear and vertical targets", () => {
    const o = { x: 0, y: 0, z: 0 },
        f = { x: 0, y: 0, z: 1 };
    assert.ok(inCone(o, f, { x: 0, y: 0, z: 4 }, 4.5, 120));
    assert.ok(!inCone(o, f, { x: 0, y: 0, z: -4 }, 4.5, 120));
    assert.ok(!inCone(o, f, { x: 0, y: 4, z: 1 }, 4.5, 120));
});
