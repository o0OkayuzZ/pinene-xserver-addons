import test from "node:test";
import assert from "node:assert/strict";
import { acquireLandingArea, isSafeCastleFloor, blocksCastleProjectile } from "../scripts/infinite_castle/phase1Landing.js";

test("stable Block objects without preview isSolid allow authored floors and airborne projectiles", () => {
    for (const typeId of ["oak_planks", "moss_block", "gold_block", "stone", "polished_blackstone", "polished_deepslate"])
        assert.equal(isSafeCastleFloor({typeId: `minecraft:${typeId}`}), true);
    for (const typeId of ["air", "water", "lava", "oak_fence", "chest"])
        assert.equal(isSafeCastleFloor({typeId: `minecraft:${typeId}`}), false);
    assert.equal(isSafeCastleFloor(undefined), false);
    assert.equal(blocksCastleProjectile({typeId:"minecraft:air", isAir:true}), false);
    assert.equal(blocksCastleProjectile({typeId:"minecraft:light_block_15"}), false);
    assert.equal(blocksCastleProjectile({typeId:"minecraft:water", isLiquid:true}), false);
    assert.equal(blocksCastleProjectile({typeId:"minecraft:oak_planks"}), true);
    assert.equal(blocksCastleProjectile(undefined), true);
});

const bounds = { from: { x: 1000, y: 80, z: 1000 }, to: { x: 1030, y: 110, z: 1030 } };
const dimension = { id: "infinite_castle:dungeon" };
function fixture() {
    let area, removed = 0, waits = 0;
    const manager = {
        hasCapacity: () => true,
        createTickingArea() { area = { isFullyLoaded: false }; return new Promise(() => {}); },
        getTickingArea: () => area,
        hasTickingArea: () => !!area,
        removeTickingArea() { area = null; removed++; },
    };
    return { manager, get removed() { return removed; }, async wait() {
        if (++waits === 3) area.isFullyLoaded = true;
    } };
}
test("unloaded arrival waits before block validation and holds chunks through teleport", async () => {
    const f = fixture();
    let checked = 0;
    const target = await acquireLandingArea(f.manager, dimension, bounds, () => {
        assert.equal(f.manager.getTickingArea().isFullyLoaded, true);
        checked++;
        return { x: 1014.5, y: 81, z: 1014.5 };
    }, f.wait);
    assert.equal(checked, 1);
    assert.equal(target.dimensionId, dimension.id);
    assert.equal(f.removed, 0, "area retained for delayed entrance animation");
    target.release(); target.release();
    assert.equal(f.removed, 1);
});
test("blocked landing and validator exceptions release their temporary area", async () => {
    for (const throws of [false, true]) {
        const f = fixture();
        const operation = acquireLandingArea(f.manager, dimension, bounds,
            () => { if (throws) throw new Error("blocked"); return null; }, f.wait);
        if (throws) await assert.rejects(operation, /blocked/);
        else assert.equal(await operation, null);
        assert.equal(f.removed, 1);
    }
});
test("native creation promise cannot hang forever; capacity failure creates no area", async () => {
    const f = fixture();
    let waits = 0;
    await assert.rejects(acquireLandingArea(f.manager, dimension, bounds,
        () => assert.fail("unloaded blocks must not be checked"), async () => { waits++; }), /timed out/);
    assert.equal(waits, 400);
    assert.equal(f.removed, 1);
    f.manager.hasCapacity = () => false;
    await assert.rejects(acquireLandingArea(f.manager, dimension, bounds, () => null, f.wait), /capacity/);
    assert.equal(f.removed, 1);
});
