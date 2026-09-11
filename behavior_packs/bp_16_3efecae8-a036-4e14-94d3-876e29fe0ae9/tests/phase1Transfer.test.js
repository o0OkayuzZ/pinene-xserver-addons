import test from "node:test";
import assert from "node:assert/strict";
import { startEntranceTransition } from "../scripts/infinite_castle/entranceTransition.js";
test("transfer reserves arrival grace immediately before teleport and finishes once", () => {
    const calls = [],
        scheduled = [];
    const player = {
        location: { x: 0, y: 0, z: 0 },
        dimension: { spawnParticle() {} },
        camera: { setCamera() {}, clear() {}, fade() {} },
        playSound() {},
        teleport() {
            calls.push("teleport");
        },
    };
    startEntranceTransition({
        player,
        dungeonDimension: {},
        landingLocation: { x: 1, y: 2, z: 3 },
        beforeTeleport: () => calls.push("grace"),
        onFinished: ({ teleported }) => calls.push(teleported ? "done" : "failed"),
        schedule: (f, t) => scheduled.push({ f, t }),
    });
    scheduled.sort((a, b) => a.t - b.t).forEach((x) => x.f());
    assert.deepEqual(calls, ["grace", "teleport", "done"]);
});
test("death during exit animation cancels teleport and never records a normal exit", () => {
    const calls = [],
        scheduled = [];
    const player = {
        location: { x: 0, y: 0, z: 0 },
        dimension: { spawnParticle() {} },
        camera: { setCamera() {}, clear() {}, fade() {} },
        playSound() {},
        teleport() {
            calls.push("teleport");
        },
    };
    startEntranceTransition({
        player,
        dungeonDimension: {},
        landingLocation: { x: 1, y: 2, z: 3 },
        canTeleport: () => false,
        onFinished: ({ teleported }) => calls.push(teleported ? "exited" : "cancelled"),
        schedule: (f, t) => scheduled.push({ f, t }),
    });
    scheduled.sort((a, b) => a.t - b.t).forEach((x) => x.f());
    assert.deepEqual(calls, ["cancelled"]);
});
