import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createSourcePartsPlan, sourcePartsTopologyIds } from "../scripts/infinite_castle/sourcePartsPlanner.js";
import { createSourcePartsDemoProgression } from "../scripts/infinite_castle/sourcePartsDemoProgression.js";
import { createAnchoredSourcePartsReconstruction } from "../scripts/infinite_castle/sourcePartsDynamicReconstruction.js";
import { materialVariantId, serializeRoomMaterials, restoreRoomMaterials } from "../scripts/infinite_castle/sourceRoomMaterials.js";

let rare = 0;
let cases = 0;
for (const style of ["castle", "floating"]) {
    for (const topology of sourcePartsTopologyIds(style)) {
        for (let seed = 0; seed < 16; seed++) {
            const plan = createSourcePartsPlan(seed, { x: 1000, y: 96, z: 1000 }, { style, topology });
            const roles = new Map(plan.placements.map(r => [r.placementId, r.encounterRole]));
            assert.equal(plan.placements.filter(p => p.materialTheme === "boss").length, 1);
            for (const placement of plan.placements) {
                const role = roles.get(placement.placementId);
                if (role?.encounterType === 'elite') assert.equal(placement.materialTheme, "boss");
                if (placement.materialTheme === "rare") { assert.ok(['healing_garden','treasure_vault'].includes(role.kind)); rare++; }
                if (placement.category !== "room") assert.equal(materialVariantId(placement), placement.variantId);
                assert.ok(existsSync(new URL(`../structures/infinite_castle/generated_variants/${materialVariantId(placement)}.mcstructure`, import.meta.url)));
            }
            const saved = serializeRoomMaterials(plan);
            restoreRoomMaterials(plan, JSON.parse(JSON.stringify(saved)));
            assert.deepEqual(serializeRoomMaterials(plan), saved);
            restoreRoomMaterials(plan, undefined);
            assert.ok(plan.placements.filter(p => p.category === "room").every(p => p.materialTheme === "normal"));
            cases++;
        }
    }
}
assert.ok(rare > 0);

// Deliberately override a room's seeded choice, as happens when it survives an
// earlier reconstruction. Matching by geometry must retain that actual material.
const old = createSourcePartsPlan(42, { x: 1000, y: 96, z: 1000 });
old.dimensionId = "infinite_castle:dungeon";
const occupied = old.placements.find(p => p.materialTheme === "boss");
occupied.materialTheme = "rare";
occupied.rareRoomType = "treasure_vault";
const next = createAnchoredSourcePartsReconstruction(old, [{
    x: occupied.origin.x + occupied.size.x / 2,
    y: occupied.origin.y + 2,
    z: occupied.origin.z + occupied.size.z / 2,
}], 123, { min: -64, max: 320 });
for (let i = 0; i < next.protectedOldPlacementIds.length; i++) {
    const before = old.placements.find(p => p.placementId === next.protectedOldPlacementIds[i]);
    const after = next.plan.placements.find(p => p.placementId === next.protectedNewPlacementIds[i]);
    assert.equal(after.materialTheme, before.materialTheme ?? "normal");
    assert.equal(after.rareRoomType, before.rareRoomType);
}
const snapshot = serializeRoomMaterials(next.plan);
const reloaded = createSourcePartsPlan(next.plan.seed, next.plan.tierBases.lower, {
    style: next.plan.style, topology: next.plan.topologyId,
});
restoreRoomMaterials(reloaded, snapshot);
assert.deepEqual(serializeRoomMaterials(reloaded), snapshot);
assert.throws(() => restoreRoomMaterials(reloaded, [["p01", "invalid"]]));
console.log(`ROOM_MATERIALS_OK plans=${cases} rare=${rare} protected=${next.protectedOldPlacementIds.length}`);
