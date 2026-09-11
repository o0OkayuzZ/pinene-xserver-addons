import test from "node:test";
import assert from "node:assert/strict";
import { createRebuildStartCue } from "../scripts/infinite_castle/sourcePartsRebuildFeedback.js";

test("scenery uses each listener's position at mutation time; core remains close and clear", () => {
    const heard = [];
    const a = { location: { x: 1, y: 80, z: 2 }, playSound: (id, options) => heard.push({ player: "a", id, options }) };
    const b = { location: { x: 200, y: 250, z: -100 }, playSound: (id, options) => heard.push({ player: "b", id, options }) };
    const d = { id: "infinite_castle:dungeon", getPlayers: () => [a, b] };
    const cue = createRebuildStartCue(d, { scenery: true });
    a.location = { x: 30, y: 81, z: 50 };
    assert.equal(cue(), 2);
    assert.equal(cue(), 0);
    assert.equal(heard.length, 2);
    assert.deepEqual(heard[0].options.location, { x: 36, y: 83, z: 54 });
    assert.deepEqual(heard[1].options.location, { x: 206, y: 252, z: -96 });
    assert.ok(heard.every(s => s.id === "infinite_castle.koto_distant" && s.options.pitch === 1));
    assert.equal(createRebuildStartCue(d)(), 2);
    assert.ok(heard.slice(2).every(s => s.id === "infinite_castle.koto" && s.options.volume === 1 && !s.options.location));
});

test("disconnecting listener does not suppress others, and disabled or wrong-dimension cues stay silent", () => {
    const heard = [];
    const d = { id: "infinite_castle:dungeon", getPlayers: () => [
        { get location() { throw new Error("disconnected"); } },
        { location: { x: 0, y: 80, z: 0 }, playSound: (...args) => heard.push(args) },
    ] };
    assert.equal(createRebuildStartCue(d, { scenery: true })(), 1);
    assert.equal(heard.length, 1);
    assert.equal(createRebuildStartCue(d, { enabled: false })(), 0);
    assert.equal(createRebuildStartCue({ ...d, id: "minecraft:overworld" })(), 0);
    assert.equal(heard.length, 1);
});
