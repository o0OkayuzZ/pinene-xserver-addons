import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const BP = path.join(ROOT, "behavior_packs/bp_09_7c8ac348-47ad-4f71-8503-dc40a6f813f1");
const RP = path.join(ROOT, "resource_packs/rp_07_4ab7ea5c-8d31-44e6-b3d6-42cc32ad2f10");
const json = (p) => JSON.parse(fs.readFileSync(p, "utf8").replace(/^\uFEFF/, ""));

const defs = [
  ["sniper_crossbow.item.json", "pinene:sniper_crossbow", 0, false, 14],
  ["sniper_crossbow_awakened_1.item.json", "pinene:sniper_crossbow_awakened_1", 1, false, 18],
  ["sniper_crossbow_awakened_2.item.json", "pinene:sniper_crossbow_awakened_2", 2, false, 22],
  ["sniper_crossbow_awakened_3.item.json", "pinene:sniper_crossbow_awakened_3", 3, false, 26],
  ["sniper_tnt_crossbow.item.json", "pinene:sniper_tnt_crossbow", 0, true, 10],
  ["sniper_tnt_crossbow_awakened_1.item.json", "pinene:sniper_tnt_crossbow_awakened_1", 1, true, 13],
  ["sniper_tnt_crossbow_awakened_2.item.json", "pinene:sniper_tnt_crossbow_awakened_2", 2, true, 16],
  ["sniper_tnt_crossbow_awakened_3.item.json", "pinene:sniper_tnt_crossbow_awakened_3", 3, true, 19]
];

test("all eight sniper variants exist with the agreed charge, durability, ammo and depth", () => {
  for (const [file, id, depth, tnt, direct] of defs) {
    const item = json(path.join(BP, "items", file))["minecraft:item"];
    assert.equal(item.description.identifier, id);
    assert.equal(item.components["minecraft:durability"].max_durability, 520);
    assert.equal(item.components["minecraft:shooter"].max_draw_duration, 2.2);
    assert.equal(item.components["minecraft:use_modifiers"].movement_modifier, 0.25);
    assert.ok(item.components["minecraft:tags"].tags.includes("pinene:sniper_crossbow"));
    assert.ok(item.components["minecraft:tags"].tags.includes("pinene:sniper_depth_" + depth));
    assert.equal(item.components["minecraft:shooter"].ammunition[0].item, tnt ? "pinene:bomb_bolt" : "minecraft:arrow");
    assert.ok(item.components["minecraft:display_name"].value.includes("直撃 " + direct));
    if (tnt) {
      assert.ok(item.components["minecraft:tags"].tags.includes("pinene:tnt_crossbow"));
      assert.ok(item.components["minecraft:display_name"].value.includes("爆発半径 " + (4 + depth)));
      assert.ok(item.components["minecraft:display_name"].value.includes("発火なし"));
    }
  }
});

test("sniper projectile is fast, low-gravity and zero-spread", () => {
  const entity = json(path.join(BP, "entities/sniper_bolt.entity.json"))["minecraft:entity"];
  assert.equal(entity.description.identifier, "pinene:sniper_bolt_projectile");
  const projectile = entity.components["minecraft:projectile"];
  assert.equal(projectile.power, 8);
  assert.equal(projectile.gravity, 0.012);
  assert.equal(projectile.uncertainty_base, 0);
  assert.equal(projectile.uncertainty_multiplier, 0);
  assert.equal(projectile.on_hit.impact_damage.damage, 0);
});

test("scope mode is sneak-held, camera FOV 20 and uses a conditional spyglass-style HUD", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/sniper_crossbow.js"), "utf8");
  assert.ok(source.includes("const SCOPE_FOV = 20"));
  assert.ok(source.includes("player.isSneaking && isScopedWeapon"));
  assert.ok(source.includes("player.camera.setFov({ fov: SCOPE_FOV })"));
  assert.ok(source.includes("HudElement.Crosshair"));
  assert.ok(source.includes('setActionBar(SCOPE_MARKER)'));
  assert.ok(source.includes("player.camera.setFov()"));

  const hud = json(path.join(RP, "ui/hud_screen.json"));
  const text = JSON.stringify(hud);
  assert.ok(text.includes("__PINENE_SNIPER_SCOPE__"));
  assert.ok(text.includes("textures/ui/sniper_scope"));
  assert.ok(text.includes("100%y"));
  assert.ok(text.includes("textures/ui/Black"));

  const png = fs.readFileSync(path.join(RP, "textures/ui/sniper_scope.png"));
  assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.equal(png.readUInt32BE(16), 256);
  assert.equal(png.readUInt32BE(20), 256);
  assert.equal(png[25], 6);
});

test("crossbow forge supports sniper, TNT and awakening in either order while preserving item state", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/sniper_crossbow.js"), "utf8");

  assert.ok(source.includes('"minecraft:crossbow": { sniper: false, tnt: false, depth: 0 }'));
  assert.ok(source.includes('"pinene:bomb_crossbow_awakened_2": { sniper: false, tnt: true, depth: 2 }'));
  assert.ok(source.includes('"pinene:sniper_crossbow_awakened_2": { sniper: true, tnt: false, depth: 2 }'));
  assert.ok(source.includes('"pinene:sniper_tnt_crossbow_awakened_2": { sniper: true, tnt: true, depth: 2 }'));

  assert.ok(source.includes('key: "sniper"'));
  assert.ok(source.includes('key: "tnt"'));
  assert.ok(source.includes('key: "awaken"'));

  assert.ok(source.includes('{ typeId: "minecraft:spyglass", count: 1'));
  assert.ok(source.includes('{ typeId: "minecraft:iron_ingot", count: 1'));
  assert.ok(source.includes('{ typeId: "minecraft:tnt", count: 1'));
  assert.ok(source.includes('{ typeId: "minecraft:iron_ingot", count: 3'));
  assert.ok(source.includes('{ typeId: "minecraft:string", count: 2'));
  assert.ok(source.includes('const SOUL_ID = "pinematerials:zyunzentarucrossbownotamashii"'));

  for (const preserved of [
    "dstDurability.damage",
    "target.nameTag = source.nameTag",
    "target.setLore(source.getLore())",
    "target.keepOnDeath = source.keepOnDeath",
    "target.lockMode = source.lockMode",
    "target.setCanDestroy(source.getCanDestroy())",
    "target.setCanPlaceOn(source.getCanPlaceOn())",
    "target.setDynamicProperty",
    "dstEnchantable.addEnchantments"
  ]) assert.ok(source.includes(preserved), preserved);
});

test("sniper normal arrows are replaced by precision projectiles; sniper TNT keeps bomb bolts", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/sniper_crossbow.js"), "utf8");
  assert.ok(source.includes('projectile.typeId !== "minecraft:arrow" && projectile.typeId !== BOMB_PROJECTILE_ID'));
  assert.ok(source.includes("replaceVanillaArrowWithSniper"));
  assert.ok(source.includes("tagBombSniperProjectile"));
  assert.ok(source.includes('setDynamicProperty("pinene:sniper_direct_damage"'));
  assert.ok(source.includes("SNIPER_DIRECT = Object.freeze([14, 18, 22, 26])"));
  assert.ok(source.includes("SNIPER_TNT_DIRECT = Object.freeze([10, 13, 16, 19])"));
});

test("sniper TNT variants share the Bomb Crossbow 4/5/6/7 real explosion contract", () => {
  const source = fs.readFileSync(path.join(BP, "scripts/bomb_crossbow.js"), "utf8");
  assert.ok(source.includes('"pinene:sniper_tnt_crossbow": { depth: 0, radius: 4 }'));
  assert.ok(source.includes('"pinene:sniper_tnt_crossbow_awakened_1": { depth: 1, radius: 5 }'));
  assert.ok(source.includes('"pinene:sniper_tnt_crossbow_awakened_2": { depth: 2, radius: 6 }'));
  assert.ok(source.includes('"pinene:sniper_tnt_crossbow_awakened_3": { depth: 3, radius: 7 }'));
  assert.ok(source.includes("breaksBlocks: true"));
  assert.ok(source.includes("causesFire: false"));
});

test("RP atlas, attachables and projectile client entity cover all sniper variants", () => {
  const atlas = json(path.join(RP, "textures/item_texture.json")).texture_data;
  for (const [, id] of defs) {
    const key = id.split(":")[1];
    assert.ok(atlas[key], key);
    const attachable = json(path.join(RP, "attachables/crossbow", key + ".json"))["minecraft:attachable"];
    assert.equal(attachable.description.identifier, id);
  }
  const client = json(path.join(RP, "entity/sniper_bolt.json"))["minecraft:client_entity"];
  assert.equal(client.description.identifier, "pinene:sniper_bolt_projectile");
});

test("sniper pack versions, RP dependency and server-ui dependency stay synchronized", () => {
  const bp = json(path.join(BP, "manifest.json"));
  const rp = json(path.join(RP, "manifest.json"));
  assert.deepEqual(bp.header.version, [1, 2, 16]);
  assert.deepEqual(rp.header.version, [1, 2, 18]);
  assert.deepEqual(rp.dependencies.find(x => x.uuid === bp.header.uuid)?.version, bp.header.version);
  assert.equal(bp.dependencies.find(x => x.module_name === "@minecraft/server-ui")?.version, "2.0.0");
});
