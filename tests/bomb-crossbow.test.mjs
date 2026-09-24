import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1");
const RP = path.join(ROOT, "resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10");
const LEGACY_RP = path.join(ROOT, "resource_packs/rp_05_608f921e-6be8-4a27-85d6-27945fa3a1ef");
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

test("all Bomb Crossbow depths use dedicated bomb bolts", () => {
  const defs = [
    ["bomb_crossbow.item.json", "pinene:bomb_crossbow", 0],
    ["bomb_crossbow_awakened_1.item.json", "pinene:bomb_crossbow_awakened_1", 1],
    ["bomb_crossbow_awakened_2.item.json", "pinene:bomb_crossbow_awakened_2", 2],
    ["bomb_crossbow_awakened_3.item.json", "pinene:bomb_crossbow_awakened_3", 3]
  ];
  for (const [file, id, depth] of defs) {
    const item = json(path.join(BP, "items", file))["minecraft:item"];
    assert.equal(item.description.identifier, id);
    assert.equal(item.components["minecraft:durability"].max_durability, 465);
    assert.equal(item.components["minecraft:shooter"].max_draw_duration, 1.8);
    assert.deepEqual(item.components["minecraft:shooter"].ammunition.map((x) => x.item), ["pinene:bomb_bolt"]);
    assert.ok(item.components["minecraft:tags"].tags.includes("pinene:bomb_crossbow_depth_" + depth));
  }
});

test("Bomb bolt keeps direct-hit and crafting contract", () => {
  const ammo = json(path.join(BP, "items/bomb_bolt.item.json"))["minecraft:item"];
  assert.equal(ammo.components["minecraft:projectile"].projectile_entity, "pinene:bomb_bolt_projectile");
  assert.equal(ammo.components["minecraft:max_stack_size"], 16);
  const projectile = json(path.join(BP, "entities/bomb_bolt.entity.json"))["minecraft:entity"];
  assert.equal(projectile.description.identifier, "pinene:bomb_bolt_projectile");
  assert.equal(projectile.components["minecraft:projectile"].on_hit.impact_damage.damage, 6);
  const boltRecipe = json(path.join(BP, "recipes/bomb_bolt.recipe.json"))["minecraft:recipe_shaped"];
  assert.deepEqual(boltRecipe.pattern, [" A ", "ATA", " A "]);
  assert.equal(boltRecipe.result.count, 4);
});

test("awakening depth scales real terrain explosion and never creates fire", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/bomb_crossbow.js"), "utf8");
  assert.ok(source.includes('"pinene:bomb_crossbow": { depth: 0, radius: 4 }'));
  assert.ok(source.includes('"pinene:bomb_crossbow_awakened_1": { depth: 1, radius: 5 }'));
  assert.ok(source.includes('"pinene:bomb_crossbow_awakened_2": { depth: 2, radius: 6 }'));
  assert.ok(source.includes('"pinene:bomb_crossbow_awakened_3": { depth: 3, radius: 7 }'));
  assert.ok(source.includes("dimension.createExplosion(location, profile.radius, options)"));
  assert.ok(source.includes("breaksBlocks: true"));
  assert.ok(source.includes("causesFire: false"));
  assert.ok(!source.includes("causesFire: true"));
  assert.ok(source.includes("world.afterEvents.entitySpawn.subscribe"));
  assert.ok(source.includes('setDynamicProperty("pinene:bomb_depth", profile.depth)'));
});

test("awakened RP visuals reuse the three legacy System Crossbow depth assets", () => {
  const atlas = json(path.join(RP, "textures/item_texture.json")).texture_data;
  assert.equal(atlas.bomb_crossbow.textures, "textures/items/explosive_crossbow_standby");
  assert.equal(atlas.bomb_crossbow_awakened_1.textures, "textures/items/explosive_crossbow_aw1_standby");
  assert.equal(atlas.bomb_crossbow_awakened_2.textures, "textures/items/explosive_crossbow_aw2_standby");
  assert.equal(atlas.bomb_crossbow_awakened_3.textures, "textures/items/explosive_crossbow_aw3_standby");
  assert.equal(atlas.bomb_bolt.textures, "textures/items/arrow/tnt_arrow");
  for (const depth of [1, 2, 3]) {
    const attachable = json(path.join(RP, "attachables/crossbow/bomb_crossbow_awakened_" + depth + ".json"))["minecraft:attachable"];
    assert.equal(attachable.description.identifier, "pinene:bomb_crossbow_awakened_" + depth);
  }
});


test("Pure Crossbow Soul awakening is handled by the shared crossbow forge and preserves state", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/sniper_crossbow.js"), "utf8");
  assert.ok(source.includes('const SOUL_ID = "pinematerials:zyunzentarucrossbownotamashii"'));
  assert.ok(source.includes('key: "awaken"'));
  assert.ok(source.includes("depth: state.depth + 1"));
  assert.ok(source.includes('event.block?.typeId !== "minecraft:smithing_table"'));
  assert.ok(source.includes("player.isSneaking"));
  assert.ok(source.includes("copyCrossbowState"));
  assert.ok(source.includes("dstEnchantable.addEnchantments(enchantments)"));
  assert.ok(source.includes("dstDurability.damage"));
  assert.ok(source.includes("target.setDynamicProperty"));
  assert.ok(source.includes("consumeRequirements"));
});

test("restored Pure Crossbow Soul texture exists as a real PNG", () => {
  const texture = path.join(RP, "textures/items/zyunzentarucrossbownotamashii.png");
  const staleDuplicate = path.join(LEGACY_RP, "textures/items/zyunzentarucrossbownotamashii.png");
  assert.equal(fs.existsSync(texture), true);
  assert.equal(fs.existsSync(staleDuplicate), false, "legacy RP must not shadow Pure Crossbow Soul");
  const bytes = fs.readFileSync(texture);
  assert.equal(bytes.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(bytes.readUInt32BE(16), 256);
  assert.equal(bytes.readUInt32BE(20), 256);
  assert.equal(bytes[25], 6); // PNG RGBA
  assert.ok(bytes.length > 1000);
});

test("Bomb Crossbow pack versions and dependency stay synchronized", () => {
  const bp = json(path.join(BP, "manifest.json"));
  const rp = json(path.join(RP, "manifest.json"));
  assert.deepEqual(bp.header.version, [1, 2, 16]);
  assert.deepEqual(rp.header.version, [1, 2, 18]);
  const dep = rp.dependencies.find((x) => x.uuid === bp.header.uuid);
  assert.deepEqual(dep.version, bp.header.version);
});
